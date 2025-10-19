const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { parse } = require('csv-parse');
const dayjs = require('dayjs');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const __dirnameResolved = __dirname;
const dataDir = path.join(__dirnameResolved, 'data');
const sampleTransactionsPath = path.join(dataDir, 'test-account-transactions.json');
const TEST_ACCOUNT_EMAIL = 'test@gmail.com';
const TEST_ACCOUNT_PASSWORD = 'password';
let sampleTransactions = [];

try {
  const raw = fs.readFileSync(sampleTransactionsPath, 'utf8');
  sampleTransactions = JSON.parse(raw);
} catch (error) {
  console.warn('Failed to load sample transactions from file', error.message);
  sampleTransactions = [];
}
const disableDb = process.env.DISABLE_DB === '1';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 6,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static(__dirnameResolved));

let pool = null;
if (disableDb) {
  console.warn('DISABLE_DB is set. The server will use in-memory data only.');
} else {
  const useSSL = process.env.DATABASE_SSL !== 'false';
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. The server will attempt to use default PG environment variables.');
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
  });
}

function toCurrency(value) {
  return Number.parseFloat(value || 0);
}

function normaliseMerchant(description) {
  return description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const memoryUsers = new Map();
memoryUsers.set(TEST_ACCOUNT_EMAIL, { password: TEST_ACCOUNT_PASSWORD });

const inMemoryTransactions = [];
let nextInMemoryId = 1;

if (sampleTransactions.length) {
  sampleTransactions.forEach((tx, index) => {
    const id = tx.id || index + 1;
    inMemoryTransactions.push({
      ...tx,
      id,
      user: TEST_ACCOUNT_EMAIL,
      merchant: tx.merchant || normaliseMerchant(tx.description),
    });
    nextInMemoryId = Math.max(nextInMemoryId, id + 1);
  });
}

const sessionStore = new Map();

function getMemoryTransactions(email) {
  return inMemoryTransactions.filter((tx) => tx.user === email);
}

function ensureMemoryUser(email, password) {
  const existing = memoryUsers.get(email);
  if (!existing) {
    memoryUsers.set(email, { password });
    return { email };
  }
  if (existing.password !== password) {
    return null;
  }
  return { email };
}

async function ensureDbUser(email, password) {
  const existing = await pool.query('SELECT id, password FROM users WHERE email = $1', [email]);
  if (!existing.rows.length) {
    const inserted = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
      [email, password]
    );
    return { id: inserted.rows[0].id, password };
  }
  const row = existing.rows[0];
  if (row.password !== password) {
    return null;
  }
  return { id: row.id, password: row.password };
}

function createSession(userContext) {
  const token = crypto.randomUUID();
  sessionStore.set(token, userContext);
  return token;
}

function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const session = sessionStore.get(token);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = session;
  req.userToken = token;
  next();
}

async function ensureSchema() {
  if (disableDb) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      merchant TEXT NOT NULL,
      date DATE NOT NULL,
      cashflow TEXT NOT NULL,
      account TEXT NOT NULL,
      category TEXT NOT NULL,
      label TEXT DEFAULT '',
      amount NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS insight_feedback (
      id SERIAL PRIMARY KEY,
      insight_type TEXT NOT NULL,
      insight_title TEXT NOT NULL,
      response TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'user_id'
      ) THEN
        ALTER TABLE transactions ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'transactions' AND constraint_name = 'transactions_unique'
      ) THEN
        ALTER TABLE transactions DROP CONSTRAINT transactions_unique;
      END IF;
    END $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      BEGIN
        ALTER TABLE transactions
        ADD CONSTRAINT transactions_unique UNIQUE (user_id, date, amount, merchant, cashflow);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END;
    END $$;
  `);
}

async function insertTransaction(transaction, userContext) {
  if (!userContext || !userContext.email) {
    throw new Error('Missing user context for transaction');
  }

  if (disableDb) {
    const email = userContext.email;
    const exists = inMemoryTransactions.some(
      (item) =>
        item.user === email &&
        item.date === transaction.date &&
        item.amount === transaction.amount &&
        item.merchant === (transaction.merchant || normaliseMerchant(transaction.description)) &&
        item.cashflow === transaction.cashflow
    );
    if (exists) {
      return 0;
    }
    const id = transaction.id || nextInMemoryId++;
    nextInMemoryId = Math.max(nextInMemoryId, id + 1);
    inMemoryTransactions.push({
      ...transaction,
      id,
      user: email,
      merchant: transaction.merchant || normaliseMerchant(transaction.description),
    });
    return 1;
  }

  if (!userContext.userId) {
    throw new Error('Missing database user context for transaction');
  }

  const result = await pool.query(
    `INSERT INTO transactions
      (user_id, description, merchant, date, cashflow, account, category, label, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, date, amount, merchant, cashflow) DO NOTHING`,
    [
      userContext.userId,
      transaction.description,
      transaction.merchant,
      transaction.date,
      transaction.cashflow,
      transaction.account,
      transaction.category,
      transaction.label,
      transaction.amount,
    ]
  );
  return result.rowCount;
}

async function seedSampleData() {
  if (disableDb) {
    return;
  }
  const existing = await pool.query(
    'SELECT COUNT(*)::int AS count FROM transactions WHERE user_id = (SELECT id FROM users WHERE email = $1)',
    [TEST_ACCOUNT_EMAIL]
  );
  if ((existing.rows[0] && existing.rows[0].count) > 0) {
    return;
  }

  if (!sampleTransactions.length) {
    return;
  }

  const dbUser = await ensureDbUser(TEST_ACCOUNT_EMAIL, TEST_ACCOUNT_PASSWORD);
  if (!dbUser) {
    throw new Error('Unable to create test account for seeding');
  }

  const today = dayjs();
  for (const [index, tx] of sampleTransactions.entries()) {
    const baseDate = dayjs(tx.date);
    const date = baseDate.isValid() ? baseDate : today.subtract(index, 'day');
    await insertTransaction(
      {
        ...tx,
        date: date.format('YYYY-MM-DD'),
        merchant: normaliseMerchant(tx.description),
      },
      { email: TEST_ACCOUNT_EMAIL, userId: dbUser.id }
    );
  }
}

const readiness = disableDb
  ? Promise.resolve()
  : (async () => {
      try {
        await ensureSchema();
        await seedSampleData();
      } catch (error) {
        console.error('Database initialisation failed', error);
        throw error;
      }
    })();

app.use(async (req, res, next) => {
  try {
    await readiness;
    next();
  } catch (error) {
    next(error);
  }
});

function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    parse(
      buffer.toString('utf8'),
      {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      },
      (error, records) => {
        if (error) {
          reject(error);
        } else {
          resolve(records);
        }
      }
    );
  });
}

const CATEGORY_RULES = [
  { match: ['rent', 'mortgage'], category: 'Housing' },
  { match: ['grocery', 'metro', 'iga', 'sobeys', 'loblaw', 'superstore'], category: 'Groceries' },
  { match: ['uber', 'lyft', 'taxi', 'transit', 'oc transpo', 'ttc'], category: 'Transportation' },
  { match: ['spotify', 'netflix', 'disney', 'crave', 'apple tv', 'prime'], category: 'Subscriptions' },
  { match: ['hydro', 'hydro-qu', 'hydro quebec', 'enmax', 'bc hydro', 'toronto hydro'], category: 'Utilities' },
  { match: ['telus', 'rogers', 'bell', 'freedom', 'fizz', 'public mobile'], category: 'Mobile phone' },
  { match: ['visa payment', 'transfer', 'etransfer', 'e-transfer', 'etrf'], category: 'Transfers' },
  { match: ['insurance'], category: 'Insurance' },
  { match: ['amazon', 'walmart', 'shopping'], category: 'Shopping' },
  { match: ['gas', 'petro', 'esso', 'shell'], category: 'Transportation' },
  { match: ['salary', 'payroll', 'paycheque', 'paycheck'], category: 'Employment income' },
  { match: ['rrsp', 'tfsa', 'wealthsimple', 'questrade'], category: 'Investments' },
  { match: ['fee', 'service charge'], category: 'Bank fees' },
];

function inferCategory(description, cashflow) {
  const normalised = description.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.match.some((keyword) => normalised.includes(keyword))) {
      return rule.category;
    }
  }
  if (cashflow === 'income') return 'Income';
  if (cashflow === 'other') return 'Transfers';
  return 'Other';
}

function inferAccount(rawAccount = '') {
  const value = rawAccount.toLowerCase();
  if (value.includes('credit')) return 'credit';
  if (value.includes('loan') || value.includes('debt')) return 'debt';
  return 'cash';
}

function parseAmount(raw) {
  if (raw === undefined || raw === null) return null;
  const cleaned = raw.toString().replace(/[$,\s]/g, '').replace(/[\u2212]/g, '-');
  const amount = Number.parseFloat(cleaned);
  return Number.isNaN(amount) ? null : amount;
}

const DATE_FORMATS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD/MM/YYYY',
  'MM/DD/YYYY',
  'DD-MM-YYYY',
  'MM-DD-YYYY',
  'MMM D, YYYY',
];

function parseDate(raw) {
  if (!raw) return null;
  const value = raw.toString().trim();
  for (const format of DATE_FORMATS) {
    const parsed = dayjs(value, format, true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
  }
  const fallback = dayjs(value);
  return fallback.isValid() ? fallback.format('YYYY-MM-DD') : null;
}

function normaliseCashflow(amount, provided) {
  if (provided && ['income', 'expense', 'other'].includes(provided.toLowerCase())) {
    return provided.toLowerCase();
  }
  if (amount > 0) return 'income';
  if (amount < 0) return 'expense';
  return 'other';
}

function buildTransaction(record) {
  const normalisedKeys = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key.toLowerCase(), value])
  );
  const description = (
    normalisedKeys.description ||
    normalisedKeys.details ||
    normalisedKeys['transaction details'] ||
    normalisedKeys.memo ||
    'Unknown merchant'
  ).toString();
  const date = parseDate(normalisedKeys.date || normalisedKeys['transaction date']);
  const rawAmount =
    normalisedKeys.amount ||
    normalisedKeys.cad ||
    normalisedKeys['transaction amount'] ||
    normalisedKeys['amount cad'];
  const amountValue = parseAmount(rawAmount);
  if (!date || amountValue === null) {
    return null;
  }
  const cashflow = normaliseCashflow(amountValue, normalisedKeys.cashflow);
  const normalisedAmount = cashflow === 'expense' && amountValue > 0 ? -Math.abs(amountValue) : amountValue;
  const account = inferAccount(normalisedKeys.account);
  const category = normalisedKeys.category || inferCategory(description, cashflow);
  const label = normalisedKeys.label || '';
  return {
    description,
    merchant: normaliseMerchant(description),
    date,
    cashflow,
    account,
    category,
    label,
    amount: toCurrency(normalisedAmount),
  };
}

async function ingestFile(buffer, userContext) {
  const records = await parseCSV(buffer);
  let inserted = 0;
  for (const record of records) {
    const transaction = buildTransaction(record);
    if (!transaction) continue;
    const changes = await insertTransaction(transaction, userContext);
    inserted += changes;
  }
  return inserted;
}

function monthLabels(start, months) {
  const labels = [];
  for (let i = 0; i < months; i += 1) {
    labels.push(start.add(i, 'month').format('YYYY-MM'));
  }
  return labels;
}

function ensureRangeMonths(monthCount) {
  const end = dayjs().endOf('month');
  const start = end.subtract(monthCount - 1, 'month').startOf('month');
  return { start, end };
}

async function getLatestMonthRange(months = 1, userContext = null) {
  if (disableDb) {
    const transactionsForUser = userContext ? getMemoryTransactions(userContext.email) : inMemoryTransactions;
    if (!transactionsForUser.length) {
      const end = dayjs().endOf('month');
      const start = end.subtract(months - 1, 'month').startOf('month');
      return { start, end };
    }
    const latestDate = transactionsForUser
      .map((tx) => dayjs(tx.date))
      .reduce((max, date) => (date.isAfter(max) ? date : max), dayjs(transactionsForUser[0].date));
    const end = latestDate.endOf('month');
    const start = end.subtract(months - 1, 'month').startOf('month');
    return { start, end };
  }
  const userId = userContext ? userContext.userId : null;
  const latest = await pool.query(
    'SELECT date FROM transactions WHERE user_id = $1 ORDER BY date DESC LIMIT 1',
    [userId]
  );
  const latestDate = latest.rows[0] ? latest.rows[0].date : null;
  const end = latestDate ? dayjs(latestDate).endOf('month') : dayjs().endOf('month');
  const start = end.subtract(months - 1, 'month').startOf('month');
  return { start, end };
}

function savingsRange(range) {
  const today = dayjs();
  switch (range) {
    case 'year-to-date':
      return { start: today.startOf('year'), end: today };
    case 'since-start':
      return { start: dayjs('1900-01-01'), end: today };
    case 'last-month':
    default: {
      const lastMonthEnd = today.subtract(1, 'month').endOf('month');
      return {
        start: lastMonthEnd.startOf('month'),
        end: lastMonthEnd,
      };
    }
  }
}

function buildInsightsFromTransactions(transactions, cohort = 'all') {
  const expenses = transactions.filter((tx) => tx.cashflow === 'expense');

  const grouped = expenses.reduce((acc, row) => {
    const key = row.merchant || normaliseMerchant(row.description);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const subscriptionInsights = [];
  Object.values(grouped).forEach((entries) => {
    if (entries.length < 3) return;
    const sorted = entries
      .slice()
      .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    const latest = sorted[sorted.length - 1];
    const amounts = sorted.slice(0, -1).map((row) => Math.abs(Number(row.amount)));
    if (!amounts.length) return;
    const avg = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
    const latestAbs = Math.abs(Number(latest.amount));
    if (latestAbs >= avg * 1.1) {
      subscriptionInsights.push({
        title: `${latest.description} increased to ${latestAbs.toFixed(2)}`,
        body: `Your recent charge is ${((latestAbs / avg - 1) * 100).toFixed(1)}% higher than your usual ${latest.category} spend.`,
      });
    }
  });

  if (!subscriptionInsights.length) {
    expenses.slice(0, 3).forEach((expense) => {
      const amount = Math.abs(Number(expense.amount));
      subscriptionInsights.push({
        title: `${expense.description} tracked at ${amount.toFixed(2)}`,
        body: `We will monitor ${expense.category} for price changes and overlaps.`,
      });
    });
  }

  const duplicateMap = expenses.reduce((acc, row) => {
    const key = `${row.date}|${Number(row.amount).toFixed(2)}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});

  const fraudInsights = [];
  Object.values(duplicateMap).forEach((entries) => {
    if (entries.length < 2) return;
    const sample = entries[0];
    const amount = Math.abs(Number(sample.amount));
    fraudInsights.push({
      title: `Possible duplicate: ${sample.description}`,
      body: `We spotted two charges of $${amount.toFixed(2)} on ${dayjs(sample.date).format('MMM D')}. Confirm both are valid.`,
    });
  });

  if (!fraudInsights.length) {
    const feeCandidates = expenses
      .filter((row) => /fee/.test((row.description || '').toLowerCase()) || /fee/.test((row.category || '').toLowerCase()))
      .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
      .slice(0, 3);

    feeCandidates.forEach((row) => {
      const amount = Math.abs(Number(row.amount));
      fraudInsights.push({
        title: `Bank fee: ${row.description}`,
        body: `A fee of $${amount.toFixed(2)} hit on ${dayjs(row.date).format('MMM D')}. Consider switching to a no-fee account.`,
      });
    });

    if (!fraudInsights.length) {
      fraudInsights.push({
        title: 'All clear for fees this month',
        body: 'We did not detect duplicate charges or unexpected fees. We will keep monitoring incoming statements.',
      });
    }
  }

  const categoryTotals = expenses.reduce((acc, row) => {
    const category = row.category || 'Other';
    acc[category] = (acc[category] || 0) + Math.abs(Number(row.amount));
    return acc;
  }, {});

  const cohortLabelMap = {
    students: 'students across Canada',
    'young-professionals': 'young professionals',
    households: 'similar Canadian households',
    all: 'Canadian households',
  };
  const cohortLabel = cohortLabelMap[cohort] || cohortLabelMap.all;

  const benchmarks = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, spend]) => ({
      title: `${category} spend at $${spend.toFixed(2)}`,
      body: `You spent roughly $${spend.toFixed(2)} on ${category} last period. We'll benchmark this against ${cohortLabel}.`,
      category,
      spend,
    }));

  return {
    subscriptions: subscriptionInsights.slice(0, 5),
    fraud: fraudInsights.slice(0, 5),
    benchmarks,
  };
}

async function generateInsights(cohort = 'all', userContext) {
  if (disableDb) {
    const userTransactions = getMemoryTransactions(userContext.email);
    return buildInsightsFromTransactions(userTransactions, cohort);
  }

  const expensesResult = await pool.query(
    `SELECT id, description, merchant, date, amount, category
     FROM transactions
     WHERE user_id = $1 AND cashflow = 'expense'`,
    [userContext.userId]
  );

  const expenses = expensesResult.rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));

  const duplicatesResult = await pool.query(
    `SELECT t1.description, t1.date, ABS(t1.amount) AS amount
     FROM transactions t1
     JOIN transactions t2 ON t1.date = t2.date AND t1.amount = t2.amount AND t1.id != t2.id
     WHERE t1.user_id = $1 AND t1.cashflow = 'expense'
     GROUP BY t1.description, t1.date, t1.amount`,
    [userContext.userId]
  );

  const feeRows = await pool.query(
    `SELECT description, ABS(amount) AS amount, date
     FROM transactions
     WHERE user_id = $1 AND (lower(description) LIKE '%fee%' OR lower(category) LIKE '%fee%')
     ORDER BY date DESC
     LIMIT 3`,
    [userContext.userId]
  );

  const categorySpendResult = await pool.query(
    `SELECT category, ABS(SUM(amount)) AS total
     FROM transactions
     WHERE user_id = $1 AND cashflow = 'expense'
     GROUP BY category
     ORDER BY total DESC
     LIMIT 5`,
    [userContext.userId]
  );

  const insightsFromDb = buildInsightsFromTransactions(expenses, cohort);

  const fraudInsights = duplicatesResult.rows.map((row) => {
    const amount = Number(row.amount);
    return {
      title: `Possible duplicate: ${row.description}`,
      body: `We spotted two charges of $${amount.toFixed(2)} on ${dayjs(row.date).format('MMM D')}. Confirm both are valid.`,
    };
  });

  if (!fraudInsights.length) {
    feeRows.rows.forEach((row) => {
      const amount = Number(row.amount);
      fraudInsights.push({
        title: `Bank fee: ${row.description}`,
        body: `A fee of $${amount.toFixed(2)} hit on ${dayjs(row.date).format('MMM D')}. Consider switching to a no-fee account.`,
      });
    });

    if (!fraudInsights.length) {
      fraudInsights.push({
        title: 'All clear for fees this month',
        body: 'We did not detect duplicate charges or unexpected fees. We will keep monitoring incoming statements.',
      });
    }
  }

  const cohortLabelMap = {
    students: 'students across Canada',
    'young-professionals': 'young professionals',
    households: 'similar Canadian households',
    all: 'Canadian households',
  };
  const cohortLabel = cohortLabelMap[cohort] || cohortLabelMap.all;

  const benchmarks = categorySpendResult.rows.map((row) => {
    const spend = Number(row.total);
    return {
      title: `${row.category} spend at $${spend.toFixed(2)}`,
      body: `You spent roughly $${spend.toFixed(2)} on ${row.category} last period. We'll benchmark this against ${cohortLabel}.`,
      category: row.category,
      spend,
    };
  });

  if (!benchmarks.length) {
    return insightsFromDb;
  }

  return {
    subscriptions: insightsFromDb.subscriptions,
    fraud: fraudInsights.slice(0, 5),
    benchmarks: benchmarks.slice(0, 5),
  };
}

app.get('/api/health', async (req, res) => {
  try {
    if (disableDb) {
      return res.json({ status: 'ok', mode: 'memory' });
    }
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    let session = null;
    if (disableDb) {
      const memoryUser = ensureMemoryUser(email, password);
      if (!memoryUser) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      session = { email: memoryUser.email };
    } else {
      const dbUser = await ensureDbUser(email, password);
      if (!dbUser) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      session = { email, userId: dbUser.id };
    }

    const token = createSession(session);
    res.json({ token, user: { email: session.email } });
  } catch (error) {
    console.error('Failed to authenticate user', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

app.post('/api/logout', authenticateRequest, (req, res) => {
  sessionStore.delete(req.userToken);
  res.json({ status: 'signed-out' });
});

app.get('/api/transactions', authenticateRequest, async (req, res) => {
  try {
    const { search = '', cashflow = 'all', account = 'all', category = 'all', label = 'all', limit = 500 } = req.query;
    const filters = [];
    const values = [];
    let index = 1;

    if (disableDb) {
      const userTransactions = getMemoryTransactions(req.user.email);
      const term = search.toLowerCase();
      const limitValue = Number(limit) || 500;
      const filtered = userTransactions
        .filter((tx) => {
          const matchesSearch =
            !term ||
            tx.description.toLowerCase().includes(term) ||
            (tx.category || '').toLowerCase().includes(term) ||
            (tx.label || '').toLowerCase().includes(term) ||
            `${Math.abs(tx.amount)}`.includes(term);
          const matchesFlow = cashflow === 'all' || tx.cashflow === cashflow;
          const matchesAccount = account === 'all' || tx.account === account;
          const matchesCategory = category === 'all' || tx.category === category;
          const matchesLabel = label === 'all' || tx.label === label;
          return matchesSearch && matchesFlow && matchesAccount && matchesCategory && matchesLabel;
        })
        .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf())
        .slice(0, limitValue)
        .map((tx) => ({
          ...tx,
          date: dayjs(tx.date).format('YYYY-MM-DD'),
        }));

      const categories = Array.from(
        new Set(userTransactions.map((tx) => tx.category).filter(Boolean))
      ).sort();
      const labels = Array.from(
        new Set(userTransactions.map((tx) => tx.label).filter((value) => value && value.trim()))
      ).sort();

      return res.json({ transactions: filtered, categories, labels });
    }

    filters.push(`user_id = $${index}`);
    values.push(req.user.userId);
    index += 1;

    if (search) {
      filters.push(`(description ILIKE $${index} OR category ILIKE $${index} OR label ILIKE $${index})`);
      values.push(`%${search}%`);
      index += 1;
    }
    if (cashflow !== 'all') {
      filters.push(`cashflow = $${index}`);
      values.push(cashflow);
      index += 1;
    }
    if (account !== 'all') {
      filters.push(`account = $${index}`);
      values.push(account);
      index += 1;
    }
    if (category !== 'all') {
      filters.push(`category = $${index}`);
      values.push(category);
      index += 1;
    }
    if (label !== 'all') {
      filters.push(`label = $${index}`);
      values.push(label);
      index += 1;
    }

    const limitIndex = index;
    values.push(Number(limit));

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
    const query = `
      SELECT id, description, date, cashflow, account, category, label, amount
      FROM transactions
      ${where}
      ORDER BY date DESC, id DESC
      LIMIT $${limitIndex}
    `;

    const result = await pool.query(query, values);
    const transactions = result.rows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      date: dayjs(row.date).format('YYYY-MM-DD'),
    }));

    const categoriesResult = await pool.query(
      'SELECT DISTINCT category FROM transactions WHERE user_id = $1 ORDER BY category ASC',
      [req.user.userId]
    );
    const labelsResult = await pool.query(
      "SELECT DISTINCT label FROM transactions WHERE user_id = $1 AND label <> '' ORDER BY label ASC",
      [req.user.userId]
    );

    res.json({
      transactions,
      categories: categoriesResult.rows.map((row) => row.category),
      labels: labelsResult.rows.map((row) => row.label),
    });
  } catch (error) {
    console.error('Failed to load transactions', error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

app.get('/api/summary', authenticateRequest, async (req, res) => {
  try {
    const window = req.query.window || '3m';
    const monthCount = Number.parseInt(window, 10) || 3;
    const { start, end } = ensureRangeMonths(monthCount);
    const labels = monthLabels(start, monthCount);

    if (disableDb) {
      const userTransactions = getMemoryTransactions(req.user.email);
      const chart = {
        months: labels.map((label) => dayjs(label).format('MMM YY')),
        income: Array(monthCount).fill(0),
        expense: Array(monthCount).fill(0),
        other: Array(monthCount).fill(0),
      };

      const labelIndex = new Map(labels.map((label, idx) => [label, idx]));

      userTransactions.forEach((tx) => {
        const date = dayjs(tx.date);
        if (!date.isBetween(start, end, 'day', '[]')) return;
        const key = date.format('YYYY-MM');
        if (!labelIndex.has(key)) return;
        const index = labelIndex.get(key);
        const amount = Number(tx.amount);
        if (tx.cashflow === 'income') chart.income[index] += Math.abs(amount);
        if (tx.cashflow === 'expense') chart.expense[index] += Math.abs(amount);
        if (tx.cashflow === 'other') chart.other[index] += Math.abs(amount);
      });

      const latestMonth = labels[labels.length - 1];
      const categoriesMap = new Map();
      userTransactions.forEach((tx) => {
        if (tx.cashflow !== 'expense') return;
        const key = dayjs(tx.date).format('YYYY-MM');
        if (key !== latestMonth) return;
        const current = categoriesMap.get(tx.category) || 0;
        categoriesMap.set(tx.category, current + Math.abs(Number(tx.amount)));
      });

      const categories = Array.from(categoriesMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);

      return res.json({ ...chart, categories, keys: labels });
    }

    const summaryResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') AS month, cashflow, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1 AND date BETWEEN $2 AND $3
       GROUP BY month, cashflow`,
      [req.user.userId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
    );

    const chart = {
      months: labels.map((label) => dayjs(label).format('MMM YY')),
      income: Array(monthCount).fill(0),
      expense: Array(monthCount).fill(0),
      other: Array(monthCount).fill(0),
    };

    summaryResult.rows.forEach((row) => {
      const index = labels.indexOf(row.month);
      if (index === -1) return;
      const total = Number(row.total);
      const value = row.cashflow === 'expense' ? Math.abs(total) : total;
      if (row.cashflow === 'income') chart.income[index] = value;
      if (row.cashflow === 'expense') chart.expense[index] = value;
      if (row.cashflow === 'other') chart.other[index] = Math.abs(total);
    });

    const latestMonth = labels[labels.length - 1];
    const categoriesResult = await pool.query(
      `SELECT category, ABS(SUM(amount)) AS total
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND TO_CHAR(date, 'YYYY-MM') = $2
       GROUP BY category
       ORDER BY total DESC
       LIMIT 12`,
      [req.user.userId, latestMonth]
    );

    const categories = categoriesResult.rows.map((row) => ({
      name: row.category,
      value: Number(row.total),
    }));

    res.json({ ...chart, categories, keys: labels });
  } catch (error) {
    console.error('Failed to load summary', error);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

app.get('/api/budget', authenticateRequest, async (req, res) => {
  try {
    const period = req.query.period === 'quarterly' ? 'quarterly' : 'monthly';
    const months = period === 'quarterly' ? 3 : 1;
    const { start, end } = await getLatestMonthRange(months, req.user);
    const monthLabelsDisplay = [];

    if (period === 'quarterly') {
      monthLabelsDisplay.push(`${start.format('MMM YYYY')} - ${end.format('MMM YYYY')}`);
    } else {
      monthLabelsDisplay.push(end.format('MMMM YYYY'));
    }

    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');

    if (disableDb) {
      const userTransactions = getMemoryTransactions(req.user.email);
      const relevant = userTransactions.filter((tx) =>
        dayjs(tx.date).isBetween(startDate, endDate, 'day', '[]')
      );

      const spent = relevant
        .filter((tx) => tx.cashflow === 'expense')
        .reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
      const income = relevant
        .filter((tx) => tx.cashflow === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const other = relevant
        .filter((tx) => tx.cashflow === 'other')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const saved = income + other - spent;

      const baselineMonths = period === 'quarterly' ? 6 : 3;
      const baselineRange = await getLatestMonthRange(baselineMonths, req.user);
      const baselineExpenses = userTransactions
        .filter((tx) =>
          tx.cashflow === 'expense' &&
          dayjs(tx.date).isBetween(
            baselineRange.start.format('YYYY-MM-DD'),
            baselineRange.end.format('YYYY-MM-DD'),
            'day',
            '[]'
          )
        )
        .reduce((map, tx) => {
          const key = dayjs(tx.date).format('YYYY-MM');
          map.set(key, (map.get(key) || 0) + Math.abs(Number(tx.amount)));
          return map;
        }, new Map());

      const baselineValues = Array.from(baselineExpenses.values());
      const averageExpense = baselineValues.length
        ? baselineValues.reduce((sum, value) => sum + value, 0) / baselineValues.length
        : spent;

      const categoriesMap = relevant
        .filter((tx) => tx.cashflow === 'expense')
        .reduce((acc, tx) => {
          const current = acc.get(tx.category) || 0;
          acc.set(tx.category, current + Math.abs(Number(tx.amount)));
          return acc;
        }, new Map());

      const categories = Array.from(categoriesMap.entries())
        .map(([name, total]) => ({
          name,
          spent: total,
          target: total ? Math.max(total * 0.95, total - 25) : 0,
        }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 10);

      return res.json({
        months: monthLabelsDisplay,
        summary: {
          budget: averageExpense,
          spent,
          saved,
        },
        categories,
      });
    }

    const expenseRow = await pool.query(
      `SELECT COALESCE(ABS(SUM(amount)), 0) AS spent
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND date BETWEEN $2 AND $3`,
      [req.user.userId, startDate, endDate]
    );

    const incomeRow = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS income
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'income' AND date BETWEEN $2 AND $3`,
      [req.user.userId, startDate, endDate]
    );

    const otherRow = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS other
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'other' AND date BETWEEN $2 AND $3`,
      [req.user.userId, startDate, endDate]
    );

    const spent = Number(expenseRow.rows[0].spent) || 0;
    const income = Number(incomeRow.rows[0].income) || 0;
    const other = Number(otherRow.rows[0].other) || 0;
    const saved = income + other - spent;

    const baselineMonths = period === 'quarterly' ? 6 : 3;
    const baselineRange = await getLatestMonthRange(baselineMonths, req.user);
    const baselineExpensesResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, ABS(SUM(amount)) AS total
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND date BETWEEN $2 AND $3
       GROUP BY month`,
      [
        req.user.userId,
        baselineRange.start.format('YYYY-MM-DD'),
        baselineRange.end.format('YYYY-MM-DD'),
      ]
    );

    const baselineExpenses = baselineExpensesResult.rows.map((row) => Number(row.total));
    const averageExpense = baselineExpenses.length
      ? baselineExpenses.reduce((sum, value) => sum + value, 0) / baselineExpenses.length
      : spent;

    const categoriesResult = await pool.query(
      `SELECT category, ABS(SUM(amount)) AS spent
       FROM transactions
       WHERE user_id = $1 AND cashflow = 'expense' AND date BETWEEN $2 AND $3
       GROUP BY category
       ORDER BY spent DESC
       LIMIT 10`,
      [req.user.userId, startDate, endDate]
    );

    const categories = categoriesResult.rows.map((row) => {
      const spentValue = Number(row.spent);
      return {
        name: row.category,
        spent: spentValue,
        target: spentValue ? Math.max(spentValue * 0.95, spentValue - 25) : 0,
      };
    });

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
    console.error('Failed to load budget', error);
    res.status(500).json({ error: 'Failed to load budget' });
  }
});

app.get('/api/savings', authenticateRequest, async (req, res) => {
  try {
    const rangeParam = req.query.range || 'last-month';
    const range = savingsRange(rangeParam);
    const startDate = range.start.format('YYYY-MM-DD');
    const endDate = range.end.format('YYYY-MM-DD');

    if (disableDb) {
      const userTransactions = getMemoryTransactions(req.user.email);
      const relevant = userTransactions.filter((tx) =>
        dayjs(tx.date).isBetween(startDate, endDate, 'day', '[]')
      );

      const income = relevant
        .filter((tx) => tx.cashflow === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const other = relevant
        .filter((tx) => tx.cashflow === 'other')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const expense = relevant
        .filter((tx) => tx.cashflow === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const last = income + other + expense;

      const cumulative = userTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

      const savingsCategories = relevant
        .filter((tx) => Number(tx.amount) > 0)
        .reduce((acc, tx) => {
          const current = acc.get(tx.category) || 0;
          acc.set(tx.category, current + Number(tx.amount));
          return acc;
        }, new Map());

      const goals = Array.from(savingsCategories.entries())
        .filter((entry) => /rrsp|tfsa|invest|savings|fund|travel|goal/i.test(entry[0]))
        .slice(0, 3)
        .map(([name, total], index) => ({
          name,
          target: total * 1.2,
          contributed: total,
          priority: ['High', 'Medium', 'Low'][index] || 'Medium',
        }));

      if (!goals.length) {
        const fallback = Math.max(last, 0);
        goals.push({
          name: 'Emergency fund',
          target: fallback ? fallback * 3 : 1500,
          contributed: fallback,
          priority: 'High',
        });
      }

      return res.json({
        summary: {
          label:
            rangeParam === 'since-start'
              ? 'Since starting'
              : rangeParam === 'year-to-date'
              ? 'Year to date'
              : 'Last month',
          last,
          cumulative,
        },
        goals,
      });
    }

    const totalsResult = await pool.query(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN cashflow = 'other' THEN amount ELSE 0 END) AS other,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
      [req.user.userId, startDate, endDate]
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
      [req.user.userId]
    );

    const cumulativeRow = cumulativeResult.rows[0] || { income: 0, other: 0, expense: 0 };
    const cumulative =
      (Number(cumulativeRow.income) || 0) +
      (Number(cumulativeRow.other) || 0) +
      (Number(cumulativeRow.expense) || 0);

    const savingsCategoriesResult = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1 AND amount > 0 AND date BETWEEN $2 AND $3
       GROUP BY category
       ORDER BY total DESC`,
      [req.user.userId, startDate, endDate]
    );

    const savingsCategories = savingsCategoriesResult.rows.map((row) => ({
      category: row.category,
      total: Number(row.total) || 0,
    }));

    const goals = savingsCategories
      .filter((row) => /rrsp|tfsa|invest|savings|fund|travel|goal/i.test(row.category))
      .slice(0, 3)
      .map((row, index) => ({
        name: row.category,
        target: row.total * 1.2,
        contributed: row.total,
        priority: ['High', 'Medium', 'Low'][index] || 'Medium',
      }));

    if (!goals.length) {
      const fallback = Math.max(last, 0);
      goals.push({
        name: 'Emergency fund',
        target: fallback ? fallback * 3 : 1500,
        contributed: fallback,
        priority: 'High',
      });
    }

    res.json({
      summary: {
        label:
          rangeParam === 'since-start'
            ? 'Since starting'
            : rangeParam === 'year-to-date'
            ? 'Year to date'
            : 'Last month',
        last,
        cumulative,
      },
      goals,
    });
  } catch (error) {
    console.error('Failed to load savings', error);
    res.status(500).json({ error: 'Failed to load savings' });
  }
});

app.get('/api/insights', authenticateRequest, async (req, res) => {
  try {
    const cohort = req.query.cohort || 'all';
    const insights = await generateInsights(cohort, req.user);
    res.json(insights);
  } catch (error) {
    console.error('Failed to load insights', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

app.post('/api/insights/:type/feedback', authenticateRequest, async (req, res) => {
  try {
    const { type } = req.params;
    const { title = '', response = '' } = req.body || {};
    if (!['subscriptions', 'fraud', 'benchmarks'].includes(type)) {
      return res.status(400).json({ error: 'Unknown insight type' });
    }
    if (!response) {
      return res.status(400).json({ error: 'Missing response' });
    }
    if (!disableDb) {
      await pool.query(
        `INSERT INTO insight_feedback (insight_type, insight_title, response)
         VALUES ($1, $2, $3)`,
        [type, title, response]
      );
    }
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Failed to record insight feedback', error);
    res.status(500).json({ error: 'Failed to store feedback' });
  }
});

app.post('/api/upload', authenticateRequest, upload.array('statements', 6), async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const summary = [];
  for (const file of req.files) {
    try {
      const inserted = await ingestFile(file.buffer, req.user);
      summary.push({ file: file.originalname, inserted });
    } catch (error) {
      console.error(`Failed to ingest ${file.originalname}`, error);
      summary.push({ file: file.originalname, inserted: 0, error: error.message });
    }
  }
  res.json({ summary });
});

app.post('/api/feedback', async (req, res) => {
  try {
    const payload = req.body || {};
    if (disableDb) {
      return res.json({ status: 'received' });
    }
    await pool.query(
      `INSERT INTO insight_feedback (insight_type, insight_title, response)
       VALUES ($1, $2, $3)`,
      ['general', payload.title || 'general-feedback', JSON.stringify(payload)]
    );
    res.json({ status: 'received' });
  } catch (error) {
    console.error('Failed to record feedback', error);
    res.status(500).json({ error: 'Failed to store feedback' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirnameResolved, 'index.html'));
});

if (require.main === module) {
  readiness
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Canadian Insights server running on http://localhost:${PORT}`);
      });
    })
    .catch((error) => {
      console.error('Failed to start server', error);
      process.exit(1);
    });
}

module.exports = app;
