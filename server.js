const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { parse } = require('csv-parse');
const Database = require('better-sqlite3');
const dayjs = require('dayjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const __dirnameResolved = __dirname;
const DATA_DIR = path.join(__dirnameResolved, 'data');
const DB_PATH = path.join(DATA_DIR, 'transactions.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    merchant TEXT NOT NULL,
    date TEXT NOT NULL,
    cashflow TEXT NOT NULL,
    account TEXT NOT NULL,
    category TEXT NOT NULL,
    label TEXT DEFAULT '',
    amount REAL NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS insight_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_type TEXT NOT NULL,
    insight_title TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(
  'CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique ON transactions (date, amount, merchant, cashflow)'
);

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

const insertTransaction = db.prepare(`
  INSERT OR IGNORE INTO transactions
    (description, merchant, date, cashflow, account, category, label, amount)
  VALUES
    (@description, @merchant, @date, @cashflow, @account, @category, @label, @amount)
`);

function seedSampleData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
  if (count > 0) {
    return;
  }
  const today = dayjs();
  sampleTransactions.forEach((tx, index) => {
    const baseDate = dayjs(tx.date);
    const date = baseDate.isValid() ? baseDate : today.subtract(index, 'day');
    insertTransaction.run({
      ...tx,
      date: date.format('YYYY-MM-DD'),
      merchant: normaliseMerchant(tx.description),
    });
  });
}

seedSampleData();

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
  const description = (normalisedKeys.description || normalisedKeys.details || normalisedKeys['transaction details'] || normalisedKeys.memo || 'Unknown merchant').toString();
  const date = parseDate(normalisedKeys.date || normalisedKeys['transaction date']);
  const rawAmount =
    normalisedKeys.amount ||
    normalisedKeys['cad'] ||
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
  records.forEach((record) => {
    const tx = buildTransaction(record);
    if (tx) {
      const result = insertTransaction.run(tx);
      if (result.changes > 0) {
        inserted += 1;
      }
    }
  });
  return inserted;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/transactions', (req, res) => {
  const { search = '', cashflow = 'all', account = 'all', category = 'all', label = 'all', limit = 500 } = req.query;
  const filters = [];
  const params = {};
  if (search) {
    filters.push('(description LIKE :search OR category LIKE :search OR label LIKE :search)');
    params.search = `%${search}%`;
  }
  if (cashflow !== 'all') {
    filters.push('cashflow = :cashflow');
    params.cashflow = cashflow;
  }
  if (account !== 'all') {
    filters.push('account = :account');
    params.account = account;
  }
  if (category !== 'all') {
    filters.push('category = :category');
    params.category = category;
  }
  if (label !== 'all') {
    filters.push('label = :label');
    params.label = label;
  }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const stmt = db.prepare(
    `SELECT id, description, date, cashflow, account, category, label, amount
     FROM transactions
     ${where}
     ORDER BY date DESC, id DESC
     LIMIT :limit`
  );
  const transactions = stmt.all({ ...params, limit: Number(limit) });
  const meta = db.prepare('SELECT DISTINCT category FROM transactions ORDER BY category ASC').all();
  const labels = db.prepare('SELECT DISTINCT label FROM transactions WHERE label != "" ORDER BY label ASC').all();
  res.json({
    transactions,
    categories: meta.map((row) => row.category),
    labels: labels.map((row) => row.label),
  });
});

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

app.get('/api/summary', (req, res) => {
  const window = req.query.window || '3m';
  const monthCount = Number.parseInt(window, 10) || 3;
  const { start, end } = ensureRangeMonths(monthCount);
  const labels = monthLabels(start, monthCount);
  const rows = db
    .prepare(
      `SELECT strftime('%Y-%m', date) AS month, cashflow, SUM(amount) AS total
       FROM transactions
       WHERE date BETWEEN :start AND :end
       GROUP BY month, cashflow`
    )
    .all({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') });

  const chart = {
    months: labels.map((label) => dayjs(label).format('MMM YY')),
    income: Array(monthCount).fill(0),
    expense: Array(monthCount).fill(0),
    other: Array(monthCount).fill(0),
  };

  rows.forEach((row) => {
    const index = labels.indexOf(row.month);
    if (index === -1) return;
    const value = row.cashflow === 'expense' ? Math.abs(row.total) : row.total;
    if (row.cashflow === 'income') chart.income[index] = value;
    if (row.cashflow === 'expense') chart.expense[index] = value;
    if (row.cashflow === 'other') chart.other[index] = Math.abs(row.total);
  });

  const latestMonth = labels[labels.length - 1];
  const categories = db
    .prepare(
      `SELECT category, ABS(SUM(amount)) AS total
       FROM transactions
       WHERE cashflow = 'expense' AND strftime('%Y-%m', date) = :month
       GROUP BY category
       ORDER BY total DESC
       LIMIT 12`
    )
    .all({ month: latestMonth })
    .map((row) => ({ name: row.category, value: row.total }));

  res.json({ ...chart, categories });
});

function getLatestMonthRange(months = 1) {
  const latestDate = db.prepare('SELECT date FROM transactions ORDER BY date DESC LIMIT 1').get();
  const end = latestDate ? dayjs(latestDate.date).endOf('month') : dayjs().endOf('month');
  const start = end.subtract(months - 1, 'month').startOf('month');
  return { start, end };
}

app.get('/api/budget', (req, res) => {
  const period = req.query.period === 'quarterly' ? 'quarterly' : 'monthly';
  const months = period === 'quarterly' ? 3 : 1;
  const { start, end } = getLatestMonthRange(months);
  const monthLabelsDisplay = [];
  if (period === 'quarterly') {
    monthLabelsDisplay.push(
      `${start.format('MMM YYYY')} - ${end.format('MMM YYYY')}`
    );
  } else {
    monthLabelsDisplay.push(end.format('MMMM YYYY'));
  }

  const expenseRow = db
    .prepare(
      `SELECT ABS(SUM(amount)) AS spent FROM transactions
       WHERE cashflow = 'expense' AND date BETWEEN :start AND :end`
    )
    .get({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }) || { spent: 0 };

  const incomeRow = db
    .prepare(
      `SELECT SUM(amount) AS income FROM transactions
       WHERE cashflow = 'income' AND date BETWEEN :start AND :end`
    )
    .get({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }) || { income: 0 };

  const otherRow = db
    .prepare(
      `SELECT SUM(amount) AS other FROM transactions
       WHERE cashflow = 'other' AND date BETWEEN :start AND :end`
    )
    .get({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') }) || { other: 0 };

  const spent = expenseRow.spent || 0;
  const income = incomeRow.income || 0;
  const other = otherRow.other || 0;
  const saved = income + other - spent;

  const baselineMonths = period === 'quarterly' ? 6 : 3;
  const baselineRange = getLatestMonthRange(baselineMonths);
  const baselineExpenses = db
    .prepare(
      `SELECT strftime('%Y-%m', date) as month, ABS(SUM(amount)) AS total
       FROM transactions
       WHERE cashflow = 'expense' AND date BETWEEN :start AND :end
       GROUP BY month`
    )
    .all({
      start: baselineRange.start.format('YYYY-MM-DD'),
      end: baselineRange.end.format('YYYY-MM-DD'),
    })
    .map((row) => row.total);
  const averageExpense = baselineExpenses.length
    ? baselineExpenses.reduce((sum, value) => sum + value, 0) / baselineExpenses.length
    : spent;

  const categories = db
    .prepare(
      `SELECT category, ABS(SUM(amount)) AS spent
       FROM transactions
       WHERE cashflow = 'expense' AND date BETWEEN :start AND :end
       GROUP BY category
       ORDER BY spent DESC
       LIMIT 10`
    )
    .all({ start: start.format('YYYY-MM-DD'), end: end.format('YYYY-MM-DD') })
    .map((row) => ({
      name: row.category,
      spent: row.spent,
      target: row.spent ? Math.max(row.spent * 0.95, row.spent - 25) : 0,
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
});

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

app.get('/api/savings', (req, res) => {
  const rangeParam = req.query.range || 'last-month';
  const { start, end } = savingsRange(rangeParam);
  const startDate = start.format('YYYY-MM-DD');
  const endDate = end.format('YYYY-MM-DD');
  const totals = db
    .prepare(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN cashflow = 'other' THEN amount ELSE 0 END) AS other,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions
       WHERE date BETWEEN :start AND :end`
    )
    .get({ start: startDate, end: endDate }) || { income: 0, other: 0, expense: 0 };

  const last = (totals.income || 0) + (totals.other || 0) + (totals.expense || 0);
  const cumulativeTotals = db
    .prepare(
      `SELECT
        SUM(CASE WHEN cashflow = 'income' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN cashflow = 'other' THEN amount ELSE 0 END) AS other,
        SUM(CASE WHEN cashflow = 'expense' THEN amount ELSE 0 END) AS expense
       FROM transactions`
    )
    .get() || { income: 0, other: 0, expense: 0 };
  const cumulative =
    (cumulativeTotals.income || 0) + (cumulativeTotals.other || 0) + (cumulativeTotals.expense || 0);

  const savingsCategories = db
    .prepare(
      `SELECT category, SUM(amount) AS total
       FROM transactions
       WHERE amount > 0 AND date BETWEEN :start AND :end
       GROUP BY category
       ORDER BY total DESC`
    )
    .all({ start: startDate, end: endDate });

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
      label: rangeParam === 'since-start' ? 'Since starting' : rangeParam === 'year-to-date' ? 'Year to date' : 'Last month',
      last,
      cumulative,
    },
    goals,
  });
});

function generateInsights(cohort = 'all') {
  const expenses = db
    .prepare(
      `SELECT id, description, merchant, date, amount, category
       FROM transactions
       WHERE cashflow = 'expense'`
    )
    .all();

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
    expenses
      .slice(0, 3)
      .forEach((expense) => {
        subscriptionInsights.push({
          title: `${expense.description} tracked at ${Math.abs(expense.amount).toFixed(2)}`,
          body: `We will monitor ${expense.category} for price changes and overlaps.`,
        });
      });
  }

  const duplicates = db
    .prepare(
      `SELECT t1.description, t1.date, ABS(t1.amount) AS amount
       FROM transactions t1
       JOIN transactions t2 ON t1.date = t2.date AND t1.amount = t2.amount AND t1.id != t2.id
       WHERE t1.cashflow = 'expense'
       GROUP BY t1.description, t1.date, t1.amount`
    )
    .all();

  const fraudInsights = duplicates.map((row) => ({
    title: `Possible duplicate: ${row.description}`,
    body: `We spotted two charges of $${row.amount.toFixed(2)} on ${dayjs(row.date).format('MMM D')}. Confirm both are valid.`,
  }));

  if (!fraudInsights.length) {
    const feeRows = db
      .prepare(
        `SELECT description, ABS(amount) AS amount, date
         FROM transactions
         WHERE lower(description) LIKE '%fee%' OR lower(category) LIKE '%fee%'
         ORDER BY date DESC
         LIMIT 3`
      )
      .all();
    feeRows.forEach((row) => {
      fraudInsights.push({
        title: `Bank fee: ${row.description}`,
        body: `A fee of $${row.amount.toFixed(2)} hit on ${dayjs(row.date).format('MMM D')}. Consider switching to a no-fee account.`,
      });
    });
    if (!fraudInsights.length) {
      fraudInsights.push({
        title: 'All clear for fees this month',
        body: 'We did not detect duplicate charges or unexpected fees. We will keep monitoring incoming statements.',
      });
    }
  }

  const categorySpend = db
    .prepare(
      `SELECT category, ABS(SUM(amount)) AS total
       FROM transactions
       WHERE cashflow = 'expense'
       GROUP BY category
       ORDER BY total DESC
       LIMIT 5`
    )
    .all();

  const cohortLabelMap = {
    students: 'students across Canada',
    'young-professionals': 'young professionals',
    households: 'similar Canadian households',
    all: 'Canadian households',
  };
  const cohortLabel = cohortLabelMap[cohort] || cohortLabelMap.all;
  const benchmarks = categorySpend.map((row) => ({
    title: `${row.category} spend at $${row.total.toFixed(2)}`,
    body: `You spent roughly $${row.total.toFixed(2)} on ${row.category} last period. We'll benchmark this against ${cohortLabel}.`,
    category: row.category,
    spend: row.total,
  }));

  return {
    subscriptions: subscriptionInsights.slice(0, 5),
    fraud: fraudInsights.slice(0, 5),
    benchmarks: benchmarks.slice(0, 5),
  };
}

app.get('/api/insights', (req, res) => {
  const cohort = req.query.cohort || 'all';
  res.json(generateInsights(cohort));
});

app.post('/api/insights/:type/feedback', (req, res) => {
  const { type } = req.params;
  const { title = '', response = '' } = req.body || {};
  if (!['subscriptions', 'fraud', 'benchmarks'].includes(type)) {
    return res.status(400).json({ error: 'Unknown insight type' });
  }
  if (!response) {
    return res.status(400).json({ error: 'Missing response' });
  }
  db.prepare(
    `INSERT INTO insight_feedback (insight_type, insight_title, response)
     VALUES (:type, :title, :response)`
  ).run({ type, title, response });
  res.json({ status: 'stored' });
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
      summary.push({ file: file.originalname, inserted: 0, error: error.message });
    }
  }
  res.json({ summary });
});

app.post('/api/feedback', (req, res) => {
  const payload = req.body || {};
  const logPath = path.join(DATA_DIR, 'feedback.log');
  const entry = `${new Date().toISOString()}\t${JSON.stringify(payload)}\n`;
  fs.appendFileSync(logPath, entry, 'utf8');
  res.json({ status: 'received' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirnameResolved, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Canadian Insights server running on http://localhost:${PORT}`);
});
