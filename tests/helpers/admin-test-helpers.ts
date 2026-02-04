/**
 * Test helpers for admin API routes
 * Provides utilities for setting up test database and authentication
 */

import { newDb } from 'pg-mem';
import { Client, Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { ADMIN_EMAIL, JWT_SECRET } from '@/lib/admin-constants';

export interface TestDatabase {
  db: any;
  client: Client;
  pool: Pool;
}

/**
 * Set up an in-memory PostgreSQL database for testing
 */
export async function setupTestDatabase(): Promise<TestDatabase> {
  const db = newDb();
  
  db.public.registerFunction({
    name: 'current_database',
    implementation: () => 'test',
  });

  // Register DATE_TRUNC function for pg-mem
  // pg-mem requires registering overloads with explicit type signatures
  const dateTruncImpl = (part: string, date: any) => {
    // Convert any date-like value to Date
    let d: Date;
    if (date instanceof Date) {
      d = new Date(date);
    } else if (typeof date === 'string') {
      d = new Date(date);
    } else if (date && typeof date === 'object' && 'getTime' in date) {
      d = new Date(date.getTime());
    } else {
      d = new Date(String(date));
    }
    
    if (part === 'day') {
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (part === 'week') {
      // PostgreSQL week starts on Monday
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      d.setDate(diff);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return d;
  };
  
  // Register for timestamp with time zone (most common in our queries)
  db.public.registerFunction({
    name: 'date_trunc',
    args: [{ type: 'text' }, { type: 'timestamptz' }],
    returns: 'timestamptz',
    implementation: dateTruncImpl,
  });
  
  // Register for timestamp (without time zone)
  db.public.registerFunction({
    name: 'date_trunc',
    args: [{ type: 'text' }, { type: 'timestamp' }],
    returns: 'timestamp',
    implementation: dateTruncImpl,
  });
  
  // Register for date type (used with ::date casting)
  db.public.registerFunction({
    name: 'date_trunc',
    args: [{ type: 'text' }, { type: 'date' }],
    returns: 'date',
    implementation: dateTruncImpl,
  });

  // Register EXTRACT function
  db.public.registerFunction({
    name: 'extract',
    implementation: (field: string, from: Date | string | any) => {
      const date = from instanceof Date ? from : new Date(from);
      if (field === 'epoch') {
        return date.getTime() / 1000;
      }
      return 0;
    },
  });
  
  // Register MIN and MAX aggregate functions (pg-mem should have these, but ensure they work)
  // These are usually built-in, but we can register if needed

  const adapter = db.adapters.createPg();
  const MockClient = adapter.Client;
  const client = new MockClient();
  await client.connect();

  const pool = {
    connect: async () => client,
    query: client.query.bind(client),
    end: async () => {},
  } as unknown as Pool;

  // Create admin dashboard schema
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      completed_at TIMESTAMP WITH TIME ZONE,
      last_step INTEGER DEFAULT 0,
      motivation TEXT,
      emotional_state TEXT[],
      email_validated BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true
    );

    CREATE TABLE IF NOT EXISTS l1_user_permissions (
      id SERIAL PRIMARY KEY,
      password_hash TEXT NOT NULL,
      login_attempts INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      email_validated BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS l0_pii_users (
      internal_user_id INTEGER PRIMARY KEY REFERENCES l1_user_permissions(id),
      email TEXT NOT NULL,
      display_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS l0_user_tokenization (
      internal_user_id INTEGER PRIMARY KEY REFERENCES l1_user_permissions(id),
      tokenized_user_id TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES l1_user_permissions(id),
      account TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      upload_session_id TEXT
    );

    CREATE TABLE IF NOT EXISTS user_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES l1_user_permissions(id),
      event_type TEXT NOT NULL,
      event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB
    );

    CREATE TABLE IF NOT EXISTS l1_event_facts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES l1_user_permissions(id),
      tokenized_user_id TEXT REFERENCES l0_user_tokenization(tokenized_user_id),
      event_type TEXT NOT NULL,
      event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB,
      is_admin BOOLEAN DEFAULT FALSE,
      session_id TEXT
    );

    CREATE TABLE IF NOT EXISTS categorization_learning (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES l1_user_permissions(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return { db, client, pool };
}

/**
 * Generate an admin JWT token for testing
 */
export function generateAdminToken(): string {
  return jwt.sign(
    { email: ADMIN_EMAIL, role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Create a test user with optional onboarding data
 */
export async function createTestUser(
  pool: Pool,
  options: {
    email?: string;
    createdAt?: Date;
    completedAt?: Date;
    lastStep?: number;
    motivation?: string;
    emailValidated?: boolean;
  } = {}
): Promise<number> {
  const email = options.email || `test${Date.now()}@test.com`;
  const createdAt = options.createdAt || new Date();
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, created_at, completed_at, last_step, motivation, email_validated)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      email,
      'hashed_password',
      createdAt,
      options.completedAt || null,
      options.lastStep || 0,
      options.motivation || null,
      options.emailValidated || false,
    ]
  );
  return result.rows[0].id;
}

/**
 * Create test transactions for a user
 */
export async function createTestTransactions(
  pool: Pool,
  userId: number,
  count: number,
  options: { createdAt?: Date; uploadSessionId?: string } = {}
): Promise<void> {
  const createdAt = options.createdAt || new Date();
  for (let i = 0; i < count; i++) {
    await pool.query(
      `INSERT INTO transactions (user_id, account, created_at, upload_session_id)
       VALUES ($1, $2, $3, $4)`,
      [userId, `Account ${i}`, createdAt, options.uploadSessionId || null]
    );
  }
}

/**
 * Create test user events (logins)
 */
export async function createTestUserEvents(
  pool: Pool,
  userId: number,
  eventType: string,
  timestamps: Date[]
): Promise<void> {
  for (const timestamp of timestamps) {
    await pool.query(
      `INSERT INTO user_events (user_id, event_type, event_timestamp)
       VALUES ($1, $2, $3)`,
      [userId, eventType, timestamp]
    );
  }
}

/**
 * Create a NextRequest mock with admin authorization
 */
export function createAdminRequest(url: string, token?: string): any {
  const adminToken = token || generateAdminToken();
  return {
    url,
    headers: {
      get: (name: string) => {
        if (name === 'authorization') {
          return `Bearer ${adminToken}`;
        }
        return null;
      },
    },
  };
}

