const express = require('express');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse');
const dayjs = require('dayjs');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const __dirnameResolved = __dirname;

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

const useSSL = process.env.DATABASE_SSL !== 'false';
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not set. The server will attempt to use default PG environment variables.');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

function toCurrency(value) {
  return Number.parseFloat(value || 0);
}

const sampleTransactions = [
  {
    description: 'Metro - groceries',
    date: '2025-06-12',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -112.45,
  },
  {
    description: 'Rent payment',
    date: '2025-06-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2100,
  },
  {
    description: 'Salary - ACME Corp',
    date: '2025-06-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3150,
  },
  {
    description: 'EQ Bank - transfer',
    date: '2025-06-05',
    cashflow: 'other',
    account: 'cash',
    category: 'Transfers',
    label: 'Savings',
    amount: -400,
  },
  {
    description: 'Spotify subscription',
    date: '2025-06-15',
    cashflow: 'expense',
    account: 'credit',
    category: 'Subscriptions',
    label: 'Music',
    amount: -14.99,
  },
  {
    description: 'Hydro-Québec',
    date: '2025-06-08',
    cashflow: 'expense',
    account: 'cash',
    category: 'Utilities',
    label: 'Household',
    amount: -132.1,
  },
  {
    description: 'Uber trip',
    date: '2025-06-18',
    cashflow: 'expense',
    account: 'credit',
    category: 'Transportation',
    label: 'City travel',
    amount: -24.6,
  },
  {
    description: 'CRA Tax Refund',
    date: '2025-05-15',
    cashflow: 'other',
    account: 'cash',
    category: 'Tax refunds',
    label: 'Windfall',
    amount: 360,
  },
  {
    description: 'Amazon.ca order',
    date: '2025-06-04',
    cashflow: 'expense',
    account: 'credit',
    category: 'Shopping',
    label: 'Home',
    amount: -89.23,
  },
  {
    description: 'Telus Mobility',
    date: '2025-06-09',
    cashflow: 'expense',
    account: 'credit',
    category: 'Mobile phone',
    label: 'Household',
    amount: -76.5,
  },
];

function normaliseMerchant(description) {
  return description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
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
      ALTER TABLE transactions
      ADD CONSTRAINT transactions_unique UNIQUE (date, amount, merchant, cashflow);
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;
  `);
}

async function insertTransaction(transaction) {
  const result = await pool.query(
    `INSERT INTO transactions
      (description, merchant, date, cashflow, account, category, label, amount)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (date, amount, merchant, cashflow) DO NOTHING`,
    [
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
  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM transactions');
  if ((existing.rows[0] && existing.rows[0].count) > 0) {
    return;
  }

  const today = dayjs();
  for (const [index, tx] of sampleTransactions.entries()) {
    const baseDate = dayjs(tx.date);
    const date = baseDate.isValid() ? baseDate : today.subtract(index, 'day');
    await insertTransaction({
      ...tx,
      date: date.format('YYYY-MM-DD'),
      merchant: normaliseMerchant(tx.description),
    });
  }
}

const readiness = (async () => {
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

async function ingestFile(buffer) {
  const records = await parseCSV(buffer);
  let inserted = 0;
  for (const record of records) {
    const transaction = buildTransaction(record);
    if (!transaction) continue;
    const changes = await insertTransaction(transaction);
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

async function getLatestMonthRange(months = 1) {
  const latest = await pool.query('SELECT date FROM transactions ORDER BY date DESC LIMIT 1');
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

async function generateInsights(cohort = 'all') {
  const expensesResult = await pool.query(
    `SELECT id, description, merchant, date, amount, category
     FROM transactions
     WHERE cashflow = 'expense'`
  );

  const expenses = expensesResult.rows.map((row) => ({
    ...row,
    amount: Number(row.amount),
  }));

  const grouped = expenses.reduce((acc, row) => {
    if (!acc[row.merchant]) acc[row.merchant] = [];
    acc[row.merchant].push(row);
    return acc;
  }, {});

  const subscriptionInsights = [];
  Object.values(grouped).forEach((entries) => {
    if (entries.length < 3) return;
    const sorted = entries.sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    const latest = sorted[sorted.length - 1];
    const amounts = sorted.slice(0, -1).map((row) => Math.abs(row.amount));
    if (!amounts.length) return;
    const avg = amounts.reduce((sum, value) => sum + value, 0) / amounts.length;
    const latestAbs = Math.abs(latest.amount);
    if (latestAbs >= avg * 1.1) {
      subscriptionInsights.push({
        title: `${latest.description} increased to ${latestAbs.toFixed(2)}`,
        body: `Your recent charge is ${((latestAbs / avg - 1) * 100).toFixed(1)}% higher than your usual ${latest.category} spend.`,
      });
    }
  });

  if (!subscriptionInsights.length) {
    expenses.slice(0, 3).forEach((expense) => {
      subscriptionInsights.push({
        title: `${expense.description} tracked at ${Math.abs(expense.amount).toFixed(2)}`,
        body: `We will monitor ${expense.category} for price changes and overlaps.`,
      });
    });
  }

  const duplicatesResult = await pool.query(`
    SELECT t1.description, t1.date, ABS(t1.amount) AS amount
    FROM transactions t1
    JOIN transactions t2 ON t1.date = t2.date AND t1.amount = t2.amount AND t1.id != t2.id
    WHERE t1.cashflow = 'expense'
    GROUP BY t1.description, t1.date, t1.amount
  `);

  const fraudInsights = duplicatesResult.rows.map((row) => {
    const amount = Number(row.amount);
    return {
      title: `Possible duplicate: ${row.description}`,
      body: `We spotted two charges of $${amount.toFixed(2)} on ${dayjs(row.date).format('MMM D')}. Confirm both are valid.`,
    };
  });

  if (!fraudInsights.length) {
    const feeRows = await pool.query(`
      SELECT description, ABS(amount) AS amount, date
      FROM transactions
      WHERE lower(description) LIKE '%fee%' OR lower(category) LIKE '%fee%'
      ORDER BY date DESC
      LIMIT 3
    `);

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

  const categorySpendResult = await pool.query(`
    SELECT category, ABS(SUM(amount)) AS total
    FROM transactions
    WHERE cashflow = 'expense'
    GROUP BY category
    ORDER BY total DESC
    LIMIT 5
  `);

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

  return {
    subscriptions: subscriptionInsights.slice(0, 5),
    fraud: fraudInsights.slice(0, 5),
    benchmarks: benchmarks.slice(0, 5),
  };
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const { search = '', cashflow = 'all', account = 'all', category = 'all', label = 'all', limit = 500 } = req.query;
    const filters = [];
    const values = [];
    let index = 1;

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
      'SELECT DISTINCT category FROM transactions ORDER BY category ASC'
    );
    const labelsResult = await pool.query(
      "SELECT DISTINCT label FROM transactions WHERE label <> '' ORDER BY label ASC"
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

app.get('/api/summary', async (req, res) => {
  try {
    const window = req.query.window || '3m';
    const monthCount = Number.parseInt(window, 10) || 3;
    const { start, end } = ensureRangeMonths(monthCount);
    const labels = monthLabels(start, monthCount);

    const summaryResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') AS month, cashflow, SUM(amount) AS total
       FROM transactions
       WHERE date BETWEEN $1 AND $2
       GROUP BY month, cashflow`,
      [start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD')]
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
       WHERE cashflow = 'expense' AND TO_CHAR(date, 'YYYY-MM') = $1
       GROUP BY category
       ORDER BY total DESC
       LIMIT 12`,
      [latestMonth]
    );

    const categories = categoriesResult.rows.map((row) => ({
      name: row.category,
      value: Number(row.total),
    }));

    res.json({ ...chart, categories });
  } catch (error) {
    console.error('Failed to load summary', error);
    res.status(500).json({ error: 'Failed to load summary' });
  }
});

app.get('/api/budget', async (req, res) => {
  try {
    const period = req.query.period === 'quarterly' ? 'quarterly' : 'monthly';
    const months = period === 'quarterly' ? 3 : 1;
    const { start, end } = await getLatestMonthRange(months);
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
       WHERE cashflow = 'expense' AND date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const incomeRow = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS income
       FROM transactions
       WHERE cashflow = 'income' AND date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const otherRow = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS other
       FROM transactions
       WHERE cashflow = 'other' AND date BETWEEN $1 AND $2`,
      [startDate, endDate]
    );

    const spent = Number(expenseRow.rows[0].spent) || 0;
    const income = Number(incomeRow.rows[0].income) || 0;
    const other = Number(otherRow.rows[0].other) || 0;
    const saved = income + other - spent;

    const baselineMonths = period === 'quarterly' ? 6 : 3;
    const baselineRange = await getLatestMonthRange(baselineMonths);
    const baselineExpensesResult = await pool.query(
      `SELECT TO_CHAR(date, 'YYYY-MM') as month, ABS(SUM(amount)) AS total
       FROM transactions
       WHERE cashflow = 'expense' AND date BETWEEN $1 AND $2
       GROUP BY month`,
      [
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
       WHERE cashflow = 'expense' AND date BETWEEN $1 AND $2
       GROUP BY category
       ORDER BY spent DESC
       LIMIT 10`,
      [startDate, endDate]
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

app.get('/api/savings', async (req, res) => {
  try {
    const rangeParam = req.query.range || 'last-month';
    const { start, end } = savingsRange(rangeParam);
    const startDate = start.format('YYYY-MM-DD');
    const endDate = end.format('YYYY-MM-DD');

    const totalsResult = await pool.query(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN cashflow = 'other' THEN amount ELSE 0 END) AS other,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE date BETWEEN $1 AND $2`,
      [startDate, endDate]
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
       FROM transactions`
    );

    const cumulativeRow = cumulativeResult.rows[0] || { income: 0, other: 0, expense: 0 };
    const cumulative =
      (Number(cumulativeRow.income) || 0) +
      (Number(cumulativeRow.other) || 0) +
      (Number(cumulativeRow.expense) || 0);

    const savingsCategoriesResult = await pool.query(
      `SELECT category, SUM(amount) AS total
       FROM transactions
       WHERE amount > 0 AND date BETWEEN $1 AND $2
       GROUP BY category
       ORDER BY total DESC`,
      [startDate, endDate]
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

app.get('/api/insights', async (req, res) => {
  try {
    const cohort = req.query.cohort || 'all';
    const insights = await generateInsights(cohort);
    res.json(insights);
  } catch (error) {
    console.error('Failed to load insights', error);
    res.status(500).json({ error: 'Failed to load insights' });
  }
});

app.post('/api/insights/:type/feedback', async (req, res) => {
  try {
    const { type } = req.params;
    const { title = '', response = '' } = req.body || {};
    if (!['subscriptions', 'fraud', 'benchmarks'].includes(type)) {
      return res.status(400).json({ error: 'Unknown insight type' });
    }
    if (!response) {
      return res.status(400).json({ error: 'Missing response' });
    }
    await pool.query(
      `INSERT INTO insight_feedback (insight_type, insight_title, response)
       VALUES ($1, $2, $3)`,
      [type, title, response]
    );
    res.json({ status: 'stored' });
  } catch (error) {
    console.error('Failed to record insight feedback', error);
    res.status(500).json({ error: 'Failed to store feedback' });
  }
});

app.post('/api/upload', upload.array('statements', 6), async (req, res) => {
  if (!req.files || !req.files.length) {
    return res.status(400).json({ error: 'No files uploaded' });
  }
  const summary = [];
  for (const file of req.files) {
    try {
      const inserted = await ingestFile(file.buffer);
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
