const express = require('express');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse');
const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
dayjs.extend(isBetween);
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const __dirnameResolved = __dirname;
const disableDb = process.env.DISABLE_DB === '1';
const JWT_SECRET = process.env.JWT_SECRET || 'canadian-insights-demo-secret-key-change-in-production';
const SESSION_TTL_SECONDS = Number(process.env.JWT_TTL_SECONDS || 60 * 60 * 24); // 24 hours
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@canadianinsights.ca';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'northstar-demo';
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirnameResolved));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
  },
});

// Database pool
let pool = null;
if (!disableDb) {
  const useSSL = process.env.DATABASE_SSL !== 'false';
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });
  console.log('[DB] Pool created');
}

// ============================================================================
// AUTHENTICATION UTILITIES
// ============================================================================

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ 
      sub: userId,  // User ID as integer
      exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS 
    })
  ).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [headerPart, payloadPart, signaturePart] = parts;
    
    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${headerPart}.${payloadPart}`)
      .digest('base64url');
    
    if (signaturePart !== expectedSignature) {
      return null;
    }
    
    // Decode payload
    const payloadJson = Buffer.from(payloadPart, 'base64url').toString('utf8');
    const payload = JSON.parse(payloadJson);
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('[AUTH] Token verification failed:', error.message);
    return null;
  }
}

// Middleware to extract user ID from JWT
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const payload = verifyToken(token);
  if (!payload || !payload.sub) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  req.userId = payload.sub; // Integer user ID
  next();
}

// ============================================================================
// DATABASE SCHEMA & INITIALIZATION
// ============================================================================

async function ensureSchema() {
  if (disableDb || !pool) return;
  
  console.log('[DB] Creating schema...');
  
  // Users table with INTEGER primary key
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Transactions table with user_id as INTEGER
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      merchant TEXT,
      date DATE NOT NULL,
      cashflow TEXT NOT NULL CHECK (cashflow IN ('income', 'expense', 'other')),
      account TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT DEFAULT '',
      amount NUMERIC(12, 2) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Indexes for performance
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_cashflow ON transactions(cashflow);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
  `);
  
  console.log('[DB] Schema created successfully');
}

async function seedDemoUser() {
  if (disableDb || !pool) return null;
  
  try {
    // Check if demo user exists
    const existingUser = await pool.query(
      'SELECT id, email, display_name FROM users WHERE email = $1',
      [DEMO_EMAIL]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('[DB] Demo user already exists (ID:', existingUser.rows[0].id, ')');
      return existingUser.rows[0].id;
    }
    
    // Create demo user
    const passwordHash = hashPassword(DEMO_PASSWORD);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
      [DEMO_EMAIL, passwordHash, 'Taylor Nguyen']
    );
    
    const userId = result.rows[0].id;
    console.log('[DB] Demo user created (ID:', userId, ')');
    return userId;
  } catch (error) {
    console.error('[DB] Failed to seed demo user:', error.message);
    throw error;
  }
}

async function seedSampleTransactions(userId) {
  if (disableDb || !pool || !userId) return;
  
  try {
    // Check if transactions already exist
    const existing = await pool.query(
      'SELECT COUNT(*) as count FROM transactions WHERE user_id = $1',
      [userId]
    );
    
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('[DB] Sample transactions already exist');
      return;
    }
    
    console.log('[DB] Seeding sample transactions...');
    
    // Sample transactions (simplified set for testing)
    const transactions = [
      { date: '2024-10-01', description: 'Salary Deposit', amount: 5000, cashflow: 'income', category: 'Employment', account: 'Checking', label: 'Regular Income' },
      { date: '2024-10-02', description: 'Rent Payment', amount: -1500, cashflow: 'expense', category: 'Housing', account: 'Checking', label: 'Essential' },
      { date: '2024-10-03', description: 'Grocery Store', amount: -150.50, cashflow: 'expense', category: 'Groceries', account: 'Credit Card', label: 'Food' },
      { date: '2024-10-05', description: 'Gas Station', amount: -65.00, cashflow: 'expense', category: 'Transportation', account: 'Credit Card', label: 'Fuel' },
      { date: '2024-10-07', description: 'Restaurant', amount: -85.25, cashflow: 'expense', category: 'Dining', account: 'Credit Card', label: 'Entertainment' },
      { date: '2024-10-10', description: 'Electric Bill', amount: -120.00, cashflow: 'expense', category: 'Utilities', account: 'Checking', label: 'Essential' },
      { date: '2024-10-12', description: 'Freelance Payment', amount: 800, cashflow: 'income', category: 'Self-Employment', account: 'Checking', label: 'Side Income' },
      { date: '2024-10-15', description: 'Internet Bill', amount: -80.00, cashflow: 'expense', category: 'Utilities', account: 'Checking', label: 'Essential' },
      { date: '2024-10-18', description: 'Shopping', amount: -200.00, cashflow: 'expense', category: 'Shopping', account: 'Credit Card', label: 'Discretionary' },
      { date: '2024-10-20', description: 'Transfer to Savings', amount: -500, cashflow: 'other', category: 'Transfers', account: 'Checking', label: 'Savings' },
    ];
    
    for (const tx of transactions) {
      await pool.query(
        `INSERT INTO transactions (user_id, description, merchant, date, cashflow, account, category, label, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, tx.description, tx.description, tx.date, tx.cashflow, tx.account, tx.category, tx.label, tx.amount]
      );
    }
    
    console.log(`[DB] Seeded ${transactions.length} sample transactions`);
  } catch (error) {
    console.error('[DB] Failed to seed sample transactions:', error.message);
    throw error;
  }
}

// Lazy database initialization
let dbInitialized = false;
let dbInitPromise = null;

async function ensureDatabaseReady() {
  if (disableDb || !pool) return;
  
  if (dbInitPromise) return dbInitPromise;
  if (dbInitialized) return;
  
  dbInitPromise = (async () => {
    try {
      console.log('[DB] Initializing database...');
      await ensureSchema();
      const demoUserId = await seedDemoUser();
      if (demoUserId) {
        await seedSampleTransactions(demoUserId);
      }
      dbInitialized = true;
      console.log('[DB] Database initialization complete!');
    } catch (error) {
      console.error('[DB] Initialization failed:', error);
      dbInitPromise = null; // Allow retry
      throw error;
    }
  })();
  
  return dbInitPromise;
}

// Initialize immediately in local dev, lazily in Vercel
if (!IS_VERCEL && !disableDb) {
  ensureDatabaseReady().catch(err => {
    console.error('[DB] Failed to initialize on startup:', err);
  });
}

// Middleware to ensure DB is ready before data endpoints
app.use(async (req, res, next) => {
  const path = req.path;
  
  // Skip for static files, health, and auth endpoints
  if (!path.startsWith('/api/') || 
      path === '/api/health' || 
      path.startsWith('/api/auth/')) {
    return next();
  }
  
  // Ensure database is ready for data endpoints
  if (!disableDb && pool) {
    try {
      await ensureDatabaseReady();
    } catch (error) {
      console.error('[DB] Failed to initialize:', error);
      return res.status(500).json({ 
        error: 'Database initialization failed',
        details: IS_VERCEL ? error.message : undefined
      });
    }
  }
  
  next();
});

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (disableDb || !pool) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    // Fetch user from database
    const result = await pool.query(
      'SELECT id, email, password_hash, display_name FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const passwordHash = hashPassword(password);
    
    if (passwordHash !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create JWT token with integer user ID
    const token = createToken(user.id);
    
    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name
      }
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' });
    }
    
    if (disableDb || !pool) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const passwordHash = hashPassword(password);
    
    // Insert new user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
      [email.toLowerCase(), passwordHash, name]
    );
    
    const user = result.rows[0];
    const token = createToken(user.id);
    
    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name
      }
    });
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'Email already exists' });
    }
    console.error('[AUTH] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    if (disableDb || !pool) {
      return res.status(503).json({ error: 'Database not available' });
    }
    
    const result = await pool.query(
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.display_name
      }
    });
  } catch (error) {
    console.error('[AUTH] Me endpoint error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// DATA ENDPOINTS (simplified - add full implementation)
// ============================================================================

app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    
    const result = await pool.query(
      `SELECT id, description, merchant, date, cashflow, account, category, label, amount
       FROM transactions
       WHERE user_id = $1
       ORDER BY date DESC, id DESC
       LIMIT $2`,
      [req.userId, limit]
    );
    
    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('[API] Transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/summary', authenticate, async (req, res) => {
  try {
    const window = parseInt(req.query.window) || 3;
    const startDate = dayjs().subtract(window, 'month').startOf('month').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');
    
    const result = await pool.query(
      `SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        cashflow,
        SUM(amount) as total
       FROM transactions
       WHERE user_id = $1 AND date >= $2 AND date <= $3
       GROUP BY TO_CHAR(date, 'YYYY-MM'), cashflow
       ORDER BY month, cashflow`,
      [req.userId, startDate, endDate]
    );
    
    res.json({ summary: result.rows });
  } catch (error) {
    console.error('[API] Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Placeholder endpoints (implement as needed)
app.get('/api/budget', authenticate, (req, res) => {
  res.json({ budget: { summary: {}, categories: [], months: [] } });
});

app.get('/api/savings', authenticate, (req, res) => {
  res.json({ summary: {}, goals: [] });
});

app.get('/api/insights', authenticate, (req, res) => {
  res.json({ insights: [] });
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[SERVER] Running on http://localhost:${PORT}`);
    console.log(`[SERVER] Environment: ${IS_VERCEL ? 'Vercel' : 'Local'}`);
    console.log(`[SERVER] Database: ${disableDb ? 'Disabled' : 'Enabled'}`);
  });
}

module.exports = app;

