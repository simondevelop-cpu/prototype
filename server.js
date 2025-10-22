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
      [DEMO_EMAIL.toLowerCase()]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('[DB] Demo user already exists (ID:', existingUser.rows[0].id, ')');
      return existingUser.rows[0].id;
    }
    
    // Create demo user
    const passwordHash = hashPassword(DEMO_PASSWORD);
  const result = await pool.query(
      'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id',
      [DEMO_EMAIL.toLowerCase(), passwordHash, 'Taylor Nguyen']
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
      console.log('[DB] Demo transactions already exist, checking if refresh needed...');
      // Check if data is old (more than 30 days)
      const oldestDate = await pool.query(
        'SELECT MAX(date) as latest FROM transactions WHERE user_id = $1',
        [userId]
      );
      if (oldestDate.rows[0]?.latest) {
        const daysSinceLatest = dayjs().diff(dayjs(oldestDate.rows[0].latest), 'day');
        if (daysSinceLatest > 30) {
          console.log('[DB] Data is outdated, refreshing with current dates...');
          await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
        } else {
          console.log('[DB] Data is current, skipping reseed');
          return;
        }
      } else {
        return;
      }
    }

    console.log('[DB] Seeding 12 months of realistic Canadian demo transactions...');
    
    // Generate 12 months of realistic Canadian transactions (last 12 months from today)
    const transactions = [];
    const today = dayjs();
    const startDate = today.subtract(11, 'month').startOf('month');
    
    // Monthly recurring transactions
    for (let month = 0; month < 12; month++) {
      const monthStart = startDate.add(month, 'month');
      
      // Income (1st of month)
      transactions.push({
        date: monthStart.format('YYYY-MM-DD'),
        description: 'Salary Deposit - ACME Corp',
        amount: 4800,
        cashflow: 'income',
        category: 'Employment',
        account: 'Checking',
        label: 'Regular Income'
      });
      
      // Rent (1st of month)
      transactions.push({
        date: monthStart.format('YYYY-MM-DD'),
        description: 'Rent Payment',
        amount: -1650,
        cashflow: 'expense',
        category: 'Housing',
        account: 'Checking',
        label: 'Essential'
      });
      
      // Internet (5th)
      transactions.push({
        date: monthStart.add(4, 'day').format('YYYY-MM-DD'),
        description: 'Rogers Internet',
        amount: -85,
        cashflow: 'expense',
        category: 'Utilities',
        account: 'Credit Card',
        label: 'Essential'
      });
      
      // Phone (5th)
      transactions.push({
        date: monthStart.add(4, 'day').format('YYYY-MM-DD'),
        description: 'Telus Mobile',
        amount: -65,
        cashflow: 'expense',
        category: 'Utilities',
        account: 'Credit Card',
        label: 'Essential'
      });
      
      // Hydro (10th)
      transactions.push({
        date: monthStart.add(9, 'day').format('YYYY-MM-DD'),
        description: 'Hydro-Québec',
        amount: Math.floor(Math.random() * 60) + 90, // $90-150
        cashflow: 'expense',
        category: 'Utilities',
        account: 'Checking',
        label: 'Essential'
      });
      
      // Weekly groceries (4 times per month)
      for (let week = 0; week < 4; week++) {
        transactions.push({
          date: monthStart.add(week * 7 + 3, 'day').format('YYYY-MM-DD'),
          description: ['Loblaws', 'Metro', 'Sobeys', 'No Frills'][week % 4],
          amount: -(Math.floor(Math.random() * 80) + 120), // $120-200
          cashflow: 'expense',
          category: 'Groceries',
          account: 'Credit Card',
          label: 'Food'
        });
      }
      
      // Transit pass (5th)
      transactions.push({
        date: monthStart.add(4, 'day').format('YYYY-MM-DD'),
        description: 'Presto Card Load',
        amount: -156,
        cashflow: 'expense',
        category: 'Transportation',
        account: 'Debit Card',
        label: 'Commute'
      });
      
      // Coffee/food (15-20 times per month)
      const coffeeCount = 15 + Math.floor(Math.random() * 6);
      for (let i = 0; i < coffeeCount; i++) {
        const dayOffset = Math.floor(Math.random() * 28);
        transactions.push({
          date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
          description: ['Tim Hortons', 'Starbucks', 'Second Cup', 'local café'][Math.floor(Math.random() * 4)],
          amount: -(Math.random() * 8 + 4).toFixed(2), // $4-12
          cashflow: 'expense',
          category: 'Dining',
          account: 'Credit Card',
          label: 'Coffee & Snacks'
        });
      }
      
      // Restaurants (3-5 times per month)
      const restaurantCount = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < restaurantCount; i++) {
        const dayOffset = Math.floor(Math.random() * 28);
        transactions.push({
          date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
          description: ['Swiss Chalet', 'Boston Pizza', 'Local Restaurant', 'East Side Marios'][Math.floor(Math.random() * 4)],
          amount: -(Math.random() * 60 + 40).toFixed(2), // $40-100
          cashflow: 'expense',
          category: 'Dining',
          account: 'Credit Card',
          label: 'Restaurants'
        });
      }
      
      // Gas (2-3 times per month in months with car usage)
      if (month % 3 !== 0) { // Skip every 3rd month
        const gasCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < gasCount; i++) {
          const dayOffset = Math.floor(Math.random() * 28);
          transactions.push({
            date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
            description: ['Petro-Canada', 'Shell', 'Esso'][Math.floor(Math.random() * 3)],
            amount: -(Math.random() * 30 + 50).toFixed(2), // $50-80
            cashflow: 'expense',
            category: 'Transportation',
            account: 'Credit Card',
            label: 'Fuel'
          });
        }
      }
      
      // Shopping (2-4 times per month)
      const shoppingCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < shoppingCount; i++) {
        const dayOffset = Math.floor(Math.random() * 28);
        transactions.push({
          date: monthStart.add(dayOffset, 'day').format('YYYY-MM-DD'),
          description: ['Amazon.ca', 'Winners', 'Canadian Tire', 'Shoppers Drug Mart'][Math.floor(Math.random() * 4)],
          amount: -(Math.random() * 100 + 30).toFixed(2), // $30-130
          cashflow: 'expense',
          category: 'Shopping',
          account: 'Credit Card',
          label: 'Retail'
        });
      }
      
      // Entertainment (1-2 times per month)
      if (Math.random() > 0.3) {
        transactions.push({
          date: monthStart.add(Math.floor(Math.random() * 28), 'day').format('YYYY-MM-DD'),
          description: ['Cineplex', 'Netflix', 'Spotify', 'Disney+'][Math.floor(Math.random() * 4)],
          amount: -(Math.random() * 40 + 15).toFixed(2), // $15-55
          cashflow: 'expense',
          category: 'Entertainment',
          account: 'Credit Card',
          label: 'Leisure'
        });
      }
      
      // Savings transfer (15th of month)
      transactions.push({
        date: monthStart.add(14, 'day').format('YYYY-MM-DD'),
        description: 'Transfer to Savings',
        amount: -500,
        cashflow: 'other',
        category: 'Transfers',
        account: 'Checking',
        label: 'Savings'
      });
      
      // Occasional freelance income (every 3 months)
      if (month % 3 === 0) {
        transactions.push({
          date: monthStart.add(20, 'day').format('YYYY-MM-DD'),
          description: 'Freelance Payment',
          amount: Math.floor(Math.random() * 500) + 600, // $600-1100
          cashflow: 'income',
          category: 'Self-Employment',
          account: 'Checking',
          label: 'Side Income'
        });
      }
    }
    
    // Shuffle to make dates more realistic
    transactions.sort((a, b) => a.date.localeCompare(b.date));
    
    // Insert all transactions
    for (const tx of transactions) {
      await pool.query(
        `INSERT INTO transactions (user_id, description, merchant, date, cashflow, account, category, label, amount)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, tx.description, tx.description, tx.date, tx.cashflow, tx.account, tx.category, tx.label, tx.amount]
      );
    }
    
    console.log(`[DB] Seeded ${transactions.length} sample transactions across 12 months`);
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

// Reset demo data endpoint (admin only - use carefully!)
app.post('/api/reset-demo-data', async (req, res) => {
  if (disableDb || !pool) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    console.log('[RESET] Resetting demo data...');
    
    // Delete all transactions for demo user
    await pool.query('DELETE FROM transactions WHERE user_id = (SELECT id FROM users WHERE email = $1)', [DEMO_EMAIL.toLowerCase()]);
    console.log('[RESET] Deleted existing transactions');
    
    // Get demo user ID
    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [DEMO_EMAIL.toLowerCase()]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Demo user not found' });
    }
    
    const userId = userResult.rows[0].id;
    
    // Reseed transactions
    await seedSampleTransactions(userId);
    console.log('[RESET] Reseeded demo data');
    
    // Count transactions
    const count = await pool.query('SELECT COUNT(*) as count FROM transactions WHERE user_id = $1', [userId]);
    
    res.json({ 
      success: true, 
      message: 'Demo data reset successfully',
      transactionCount: parseInt(count.rows[0].count)
    });
  } catch (error) {
    console.error('[RESET] Failed to reset demo data:', error);
    res.status(500).json({ error: 'Failed to reset demo data', details: error.message });
  }
});

// ============================================================================
// DATA ENDPOINTS (simplified - add full implementation)
// ============================================================================

app.get('/api/transactions', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 500;
    const userId = req.userId;
    
    const result = await pool.query(
      `SELECT id, description, merchant, date, cashflow, account, category, label, amount
      FROM transactions
       WHERE user_id = $1
      ORDER BY date DESC, id DESC
       LIMIT $2`,
      [userId, limit]
    );

    const transactions = result.rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      date: dayjs(row.date).format('YYYY-MM-DD'),
    }));

    const categoriesResult = await pool.query(
      'SELECT DISTINCT category FROM transactions WHERE user_id = $1 ORDER BY category ASC',
      [userId]
    );
    
    const labelsResult = await pool.query(
      "SELECT DISTINCT label FROM transactions WHERE user_id = $1 AND label <> '' ORDER BY label ASC",
      [userId]
    );

    res.json({
      transactions,
      categories: categoriesResult.rows.map((row) => row.category),
      labels: labelsResult.rows.map((row) => row.label),
    });
  } catch (error) {
    console.error('[API] Transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/summary', authenticate, async (req, res) => {
  try {
    const window = req.query.window || '3m';
    const monthCount = Number.parseInt(window, 10) || 3;
    const userId = req.userId;
    
    const { start, end } = await ensureRangeMonths(monthCount, userId);
    const labels = monthLabels(start, monthCount);

    const summaryResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') AS month, cashflow, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1 AND date BETWEEN $2 AND $3
       GROUP BY month, cashflow`,
      [userId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
    );

    const chart = {
      months: labels.map((label) => dayjs(label).format('MMM YY')),
      income: Array(monthCount).fill(0),
      expense: Array(monthCount).fill(0),
      other: Array(monthCount).fill(0),
    };

    const labelIndex = new Map(labels.map((label, idx) => [label, idx]));

    summaryResult.rows.forEach((row) => {
      const month = row.month;
      const total = Number(row.total);
      if (!labelIndex.has(month)) return;
      const index = labelIndex.get(month);
      if (row.cashflow === 'income') chart.income[index] = Math.abs(total);
      if (row.cashflow === 'expense') chart.expense[index] = Math.abs(total);
      if (row.cashflow === 'other') chart.other[index] = Math.abs(total);
    });

    const latestMonth = labels[labels.length - 1];
    const categoriesResult = await pool.query(
      `SELECT category, ABS(SUM(amount)) as value
       FROM transactions
       WHERE user_id = $1 AND TO_CHAR(date, 'YYYY-MM') = $2 AND cashflow = 'expense'
       GROUP BY category
       ORDER BY value DESC
       LIMIT 12`,
      [userId, latestMonth]
    );

    const categories = categoriesResult.rows.map(row => ({
      name: row.category,
      value: Number(row.value)
    }));

    res.json({ ...chart, categories, monthKeys: labels });
  } catch (error) {
    console.error('[API] Summary error:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Helper functions for date ranges
async function ensureRangeMonths(monthCount, userId) {
  // For demo data, use the actual date range of transactions
  if (pool && userId) {
    try {
      const result = await pool.query(
        'SELECT MAX(date) as latest FROM transactions WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows[0]?.latest) {
        const end = dayjs(result.rows[0].latest).endOf('month');
        const start = end.subtract(monthCount - 1, 'month').startOf('month');
        return { start, end };
      }
    } catch (error) {
      console.error('[DATE] Error getting date range:', error);
    }
  }
  
  // Fallback to current date
  const end = dayjs().endOf('month');
  const start = end.subtract(monthCount - 1, 'month').startOf('month');
  return { start, end };
}

function monthLabels(start, months) {
  const labels = [];
  for (let i = 0; i < months; i += 1) {
    labels.push(start.add(i, 'month').format('YYYY-MM'));
  }
  return labels;
}

async function getLatestMonthRange(months, userId) {
  if (!pool) {
    const end = dayjs().endOf('month');
    const start = end.subtract(months - 1, 'month').startOf('month');
    return { start, end };
  }

  const result = await pool.query(
    'SELECT MAX(date) as latest FROM transactions WHERE user_id = $1',
    [userId]
  );

  if (!result.rows[0]?.latest) {
    const end = dayjs().endOf('month');
    const start = end.subtract(months - 1, 'month').startOf('month');
    return { start, end };
  }

  const latest = dayjs(result.rows[0].latest);
  const end = latest.endOf('month');
  const start = end.subtract(months - 1, 'month').startOf('month');
  return { start, end };
}

// Budget endpoint
app.get('/api/budget', authenticate, async (req, res) => {
  try {
    const period = req.query.period === 'quarterly' ? 'quarterly' : 'monthly';
    const months = period === 'quarterly' ? 3 : 1;
    const userId = req.userId;
    
    const { start, end } = await getLatestMonthRange(months, userId);
    const monthLabelsDisplay = [];

    if (period === 'quarterly') {
      monthLabelsDisplay.push(`${start.format('MMM YYYY')} - ${end.format('MMM YYYY')}`);
    } else {
      monthLabelsDisplay.push(end.format('MMMM YYYY'));
    }

    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');

    const expenseRow = await pool.query(
      `SELECT COALESCE(ABS(SUM(amount)), 0) AS spent
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND date BETWEEN $2 AND $3`,
      [userId, startDate, endDate]
    );

    const incomeRow = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS income
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'income' AND date BETWEEN $2 AND $3`,
      [userId, startDate, endDate]
    );

    const otherRow = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS other
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'other' AND date BETWEEN $2 AND $3`,
      [userId, startDate, endDate]
    );

    const spent = Math.abs(Number(expenseRow.rows[0].spent));
    const income = Number(incomeRow.rows[0].income);
    const other = Number(otherRow.rows[0].other);
    const saved = income + other - spent;

    // Calculate baseline average
    const baselineMonths = period === 'quarterly' ? 6 : 3;
    const baselineRange = await getLatestMonthRange(baselineMonths, userId);
    const baselineResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, ABS(SUM(amount)) as total
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND date BETWEEN $2 AND $3
       GROUP BY month`,
      [userId, baselineRange.start.format('YYYY-MM-DD'), baselineRange.end.format('YYYY-MM-DD')]
    );

    const baselineValues = baselineResult.rows.map(r => Number(r.total));
    const averageExpense = baselineValues.length
      ? baselineValues.reduce((sum, val) => sum + val, 0) / baselineValues.length
      : spent;

    // Category breakdown
    const categoriesResult = await pool.query(
      `SELECT category, ABS(SUM(amount)) as spent
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND date BETWEEN $2 AND $3
       GROUP BY category
       ORDER BY spent DESC
       LIMIT 10`,
      [userId, startDate, endDate]
    );

    const categories = categoriesResult.rows.map(row => ({
        name: row.category,
      spent: Number(row.spent),
      target: Number(row.spent) * 0.95 // 5% reduction goal
    }));

    res.json({
      months: monthLabelsDisplay,
      summary: {
        budget: averageExpense,
        spent,
        saved,
      },
      categories,
    });
  } catch (error) {
    console.error('[API] Budget error:', error);
    res.status(500).json({ error: 'Failed to fetch budget' });
  }
});

// Savings endpoint
app.get('/api/savings', authenticate, async (req, res) => {
  try {
    const rangeParam = req.query.range || 'last-month';
    const userId = req.userId;

    let startDate, endDate, label;

    if (rangeParam === 'since-start') {
      const result = await pool.query(
        'SELECT MIN(date) as first FROM transactions WHERE user_id = $1',
        [userId]
      );
      startDate = result.rows[0]?.first
        ? dayjs(result.rows[0].first).format('YYYY-MM-DD')
        : dayjs().subtract(1, 'year').format('YYYY-MM-DD');
      endDate = dayjs().format('YYYY-MM-DD');
      label = 'Since starting';
    } else if (rangeParam === 'year-to-date') {
      startDate = dayjs().startOf('year').format('YYYY-MM-DD');
      endDate = dayjs().format('YYYY-MM-DD');
      label = 'Year to date';
    } else {
      startDate = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      endDate = dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
      label = 'Last month';
    }

    const totalsResult = await pool.query(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN cashflow = 'other' THEN amount ELSE 0 END) AS other,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
      [userId, startDate, endDate]
    );

    const totalsRow = totalsResult.rows[0] || { income: 0, other: 0, expense: 0 };
    const income = Number(totalsRow.income) || 0;
    const other = Number(totalsRow.other) || 0;
    const expense = Number(totalsRow.expense) || 0;
    const last = income + other + expense;

    const cumulativeResult = await pool.query(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN cashflow = 'other' THEN amount ELSE 0 END) AS other,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    );

    const cumRow = cumulativeResult.rows[0] || { income: 0, other: 0, expense: 0 };
    const cumulative = Number(cumRow.income) + Number(cumRow.other) + Number(cumRow.expense);

    // Savings goals (placeholder)
    const goals = [
      { name: 'Emergency Fund', target: 10000, current: Math.max(0, cumulative * 0.3) },
      { name: 'Vacation', target: 5000, current: Math.max(0, cumulative * 0.1) },
    ];

    res.json({
      summary: {
        label,
        last,
        cumulative,
      },
      goals,
    });
  } catch (error) {
    console.error('[API] Savings error:', error);
    res.status(500).json({ error: 'Failed to fetch savings' });
  }
});

// Insights endpoint
app.get('/api/insights', authenticate, async (req, res) => {
  try {
    const cohort = req.query.cohort || 'all';
    const userId = req.userId;

    const insights = [];

    // Top spending category
    const topCategoryResult = await pool.query(
      `SELECT category, ABS(SUM(amount)) as total
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense'
       GROUP BY category
       ORDER BY total DESC
       LIMIT 1`,
      [userId]
    );

    if (topCategoryResult.rows.length > 0) {
      const top = topCategoryResult.rows[0];
      insights.push({
        title: `Top Spending: ${top.category}`,
        description: `You've spent $${Number(top.total).toFixed(2)} on ${top.category} this period.`,
        type: 'spending'
      });
    }

    // Average monthly spending
    const avgResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, ABS(SUM(amount)) as total
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense'
       GROUP BY month
       ORDER BY month DESC
       LIMIT 3`,
      [userId]
    );

    if (avgResult.rows.length > 0) {
      const avg = avgResult.rows.reduce((sum, r) => sum + Number(r.total), 0) / avgResult.rows.length;
      insights.push({
        title: 'Average Monthly Spending',
        description: `Your average monthly spending is $${avg.toFixed(2)}.`,
        type: 'trend'
      });
    }

    // Savings rate
    const savingsResult = await pool.query(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) as expense
       FROM transactions
       WHERE user_id = $1`,
      [userId]
    );

    if (savingsResult.rows.length > 0) {
      const row = savingsResult.rows[0];
      const income = Number(row.income);
      const expense = Math.abs(Number(row.expense));
      if (income > 0) {
        const rate = ((income - expense) / income * 100).toFixed(1);
        insights.push({
          title: 'Savings Rate',
          description: `You're saving ${rate}% of your income.`,
          type: 'goal'
        });
      }
    }

    res.json({ insights });
  } catch (error) {
    console.error('[API] Insights error:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
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

