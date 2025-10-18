const tabButtons = document.querySelectorAll('[data-tab-target]');
const panels = document.querySelectorAll('.tab-panel');
const uploadButton = document.querySelector('[data-trigger="upload"]');
const uploadDialog = document.getElementById('upload-dialog');
const toast = document.getElementById('toast');
const avatarInitial = document.querySelector('[data-user-initial]');

const username = 'Taylor';
avatarInitial.textContent = username ? username[0].toUpperCase() : 'Login';

const currency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

const budgets = {
  monthly: {
    months: ['April 2025', 'May 2025', 'June 2025'],
    summary: {
      budget: 5000,
      spent: 4520,
      saved: 480,
    },
    categories: [
      { name: 'Housing', target: 2100, spent: 2100 },
      { name: 'Groceries', target: 800, spent: 760 },
      { name: 'Transportation', target: 500, spent: 430 },
      { name: 'Dining out', target: 350, spent: 390 },
      { name: 'Subscriptions', target: 180, spent: 165 },
      { name: 'Wellness', target: 200, spent: 140 },
    ],
  },
  quarterly: {
    months: ['Q2 2025', 'Q3 2025'],
    summary: {
      budget: 15000,
      spent: 13860,
      saved: 1140,
    },
    categories: [
      { name: 'Housing', target: 6300, spent: 6300 },
      { name: 'Groceries', target: 2400, spent: 2260 },
      { name: 'Transportation', target: 1500, spent: 1320 },
      { name: 'Dining out', target: 1200, spent: 1125 },
      { name: 'Subscriptions', target: 540, spent: 495 },
      { name: 'Travel', target: 1500, spent: 1530 },
    ],
  },
};

const savings = {
  'last-month': {
    summary: {
      last: 480,
      cumulative: 5200,
      label: 'Last month',
    },
    goals: [
      { name: 'RRSP 2025', target: 6500, contributed: 4800, priority: 'High' },
      { name: 'Emergency fund', target: 10000, contributed: 7200, priority: 'Medium' },
      { name: 'Travel 2025', target: 3000, contributed: 1800, priority: 'Low' },
    ],
  },
  'since-start': {
    summary: {
      last: 5200,
      cumulative: 5200,
      label: 'Since joining',
    },
    goals: [
      { name: 'RRSP 2025', target: 6500, contributed: 4800, priority: 'High' },
      { name: 'Emergency fund', target: 10000, contributed: 7200, priority: 'Medium' },
      { name: 'Travel 2025', target: 3000, contributed: 1800, priority: 'Low' },
    ],
  },
  'year-to-date': {
    summary: {
      last: 2650,
      cumulative: 2650,
      label: 'Year to date',
    },
    goals: [
      { name: 'RRSP 2025', target: 6500, contributed: 3200, priority: 'High' },
      { name: 'Emergency fund', target: 10000, contributed: 7400, priority: 'Medium' },
      { name: 'Travel 2025', target: 3000, contributed: 1450, priority: 'Low' },
    ],
  },
};

const transactions = [
  {
    id: 1,
    description: 'Metro - groceries',
    date: '2025-06-12',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -112.45,
  },
  {
    id: 2,
    description: 'Rent payment',
    date: '2025-06-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2100,
  },
  {
    id: 3,
    description: 'Salary - ACME Corp',
    date: '2025-06-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3150,
  },
  {
    id: 4,
    description: 'EQ Bank - transfer',
    date: '2025-06-05',
    cashflow: 'other',
    account: 'cash',
    category: 'Transfers',
    label: 'Savings',
    amount: -400,
  },
  {
    id: 5,
    description: 'Spotify subscription',
    date: '2025-06-15',
    cashflow: 'expense',
    account: 'credit',
    category: 'Subscriptions',
    label: 'Music',
    amount: -14.99,
  },
  {
    id: 6,
    description: 'Hydro-Québec',
    date: '2025-06-08',
    cashflow: 'expense',
    account: 'cash',
    category: 'Utilities',
    label: 'Household',
    amount: -132.1,
  },
  {
    id: 7,
    description: 'Uber trip',
    date: '2025-06-18',
    cashflow: 'expense',
    account: 'credit',
    category: 'Transportation',
    label: 'City travel',
    amount: -24.6,
  },
  {
    id: 8,
    description: 'CRA Tax Refund',
    date: '2025-05-15',
    cashflow: 'other',
    account: 'cash',
    category: 'Tax refunds',
    label: 'Windfall',
    amount: 360,
  },
  {
    id: 9,
    description: 'Amazon.ca order',
    date: '2025-06-04',
    cashflow: 'expense',
    account: 'credit',
    category: 'Shopping',
    label: 'Home',
    amount: -89.23,
  },
  {
    id: 10,
    description: 'Telus Mobility',
    date: '2025-06-09',
    cashflow: 'expense',
    account: 'credit',
    category: 'Mobile phone',
    label: 'Household',
    amount: -76.5,
  },
  {
    id: 11,
    description: 'Salary - ACME Corp',
    date: '2025-05-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3125,
  },
  {
    id: 12,
    description: 'Rent payment',
    date: '2025-05-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2100,
  },
  {
    id: 13,
    description: 'Provigo - groceries',
    date: '2025-05-14',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -126.32,
  },
  {
    id: 14,
    description: 'EQ Bank - transfer',
    date: '2025-05-06',
    cashflow: 'other',
    account: 'cash',
    category: 'Transfers',
    label: 'Savings',
    amount: -400,
  },
  {
    id: 15,
    description: 'Indigo Books',
    date: '2025-05-20',
    cashflow: 'expense',
    account: 'credit',
    category: 'Shopping',
    label: 'Leisure',
    amount: -48.2,
  },
  {
    id: 16,
    description: 'Salary - ACME Corp',
    date: '2025-04-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3125,
  },
  {
    id: 17,
    description: 'Rent payment',
    date: '2025-04-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2100,
  },
  {
    id: 18,
    description: 'Costco Wholesale',
    date: '2025-04-10',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -183.4,
  },
  {
    id: 19,
    description: 'STM transit pass',
    date: '2025-04-02',
    cashflow: 'expense',
    account: 'credit',
    category: 'Transportation',
    label: 'City travel',
    amount: -94.5,
  },
  {
    id: 20,
    description: 'La Banquise dinner',
    date: '2025-04-18',
    cashflow: 'expense',
    account: 'credit',
    category: 'Dining out',
    label: 'Treat',
    amount: -42.75,
  },
  {
    id: 21,
    description: 'Salary - ACME Corp',
    date: '2025-03-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3100,
  },
  {
    id: 22,
    description: 'Rent payment',
    date: '2025-03-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2050,
  },
  {
    id: 23,
    description: 'IGA - groceries',
    date: '2025-03-12',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -135.66,
  },
  {
    id: 24,
    description: 'Hydro-Québec',
    date: '2025-03-07',
    cashflow: 'expense',
    account: 'cash',
    category: 'Utilities',
    label: 'Household',
    amount: -128.4,
  },
  {
    id: 25,
    description: 'Salary - ACME Corp',
    date: '2025-02-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3090,
  },
  {
    id: 26,
    description: 'Rent payment',
    date: '2025-02-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2050,
  },
  {
    id: 27,
    description: 'Shell fuel',
    date: '2025-02-16',
    cashflow: 'expense',
    account: 'credit',
    category: 'Transportation',
    label: 'Commuting',
    amount: -64.9,
  },
  {
    id: 28,
    description: 'Tim Hortons',
    date: '2025-02-09',
    cashflow: 'expense',
    account: 'cash',
    category: 'Dining out',
    label: 'Coffee',
    amount: -22.45,
  },
  {
    id: 29,
    description: 'Salary - ACME Corp',
    date: '2025-01-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3080,
  },
  {
    id: 30,
    description: 'Rent payment',
    date: '2025-01-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2050,
  },
  {
    id: 31,
    description: 'Provigo - groceries',
    date: '2025-01-14',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -140.12,
  },
  {
    id: 32,
    description: 'Bell internet',
    date: '2025-01-05',
    cashflow: 'expense',
    account: 'credit',
    category: 'Utilities',
    label: 'Home',
    amount: -89.95,
  },
  {
    id: 33,
    description: 'Salary - ACME Corp',
    date: '2024-12-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3050,
  },
  {
    id: 34,
    description: 'Rent payment',
    date: '2024-12-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2000,
  },
  {
    id: 35,
    description: 'Christmas Market',
    date: '2024-12-12',
    cashflow: 'expense',
    account: 'credit',
    category: 'Entertainment',
    label: 'Seasonal',
    amount: -120,
  },
  {
    id: 36,
    description: 'SAQ purchase',
    date: '2024-12-18',
    cashflow: 'expense',
    account: 'credit',
    category: 'Dining out',
    label: 'Gifts',
    amount: -75.5,
  },
  {
    id: 37,
    description: 'Salary - ACME Corp',
    date: '2024-11-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3050,
  },
  {
    id: 38,
    description: 'Rent payment',
    date: '2024-11-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -2000,
  },
  {
    id: 39,
    description: 'Metro - groceries',
    date: '2024-11-13',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -115.4,
  },
  {
    id: 40,
    description: 'Netflix subscription',
    date: '2024-11-15',
    cashflow: 'expense',
    account: 'credit',
    category: 'Subscriptions',
    label: 'Entertainment',
    amount: -19.99,
  },
  {
    id: 41,
    description: 'Salary - ACME Corp',
    date: '2024-10-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3025,
  },
  {
    id: 42,
    description: 'Rent payment',
    date: '2024-10-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -1980,
  },
  {
    id: 43,
    description: 'Uber trip',
    date: '2024-10-18',
    cashflow: 'expense',
    account: 'credit',
    category: 'Transportation',
    label: 'City travel',
    amount: -24.75,
  },
  {
    id: 44,
    description: 'Pharmaprix',
    date: '2024-10-09',
    cashflow: 'expense',
    account: 'credit',
    category: 'Shopping',
    label: 'Wellness',
    amount: -54.3,
  },
  {
    id: 45,
    description: 'Salary - ACME Corp',
    date: '2024-09-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3025,
  },
  {
    id: 46,
    description: 'Rent payment',
    date: '2024-09-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -1980,
  },
  {
    id: 47,
    description: 'Loblaws - groceries',
    date: '2024-09-11',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -132.6,
  },
  {
    id: 48,
    description: 'BIXI membership',
    date: '2024-09-03',
    cashflow: 'expense',
    account: 'credit',
    category: 'Transportation',
    label: 'Commuting',
    amount: -36.5,
  },
  {
    id: 49,
    description: 'Salary - ACME Corp',
    date: '2024-08-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 3000,
  },
  {
    id: 50,
    description: 'Rent payment',
    date: '2024-08-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -1980,
  },
  {
    id: 51,
    description: 'Air Canada - travel',
    date: '2024-08-19',
    cashflow: 'expense',
    account: 'credit',
    category: 'Travel',
    label: 'Vacation',
    amount: -450,
  },
  {
    id: 52,
    description: 'Starbucks',
    date: '2024-08-08',
    cashflow: 'expense',
    account: 'credit',
    category: 'Dining out',
    label: 'Coffee',
    amount: -18.75,
  },
  {
    id: 53,
    description: 'Salary - ACME Corp',
    date: '2024-07-01',
    cashflow: 'income',
    account: 'cash',
    category: 'Employment income',
    label: 'Primary income',
    amount: 2980,
  },
  {
    id: 54,
    description: 'Rent payment',
    date: '2024-07-01',
    cashflow: 'expense',
    account: 'cash',
    category: 'Housing',
    label: 'Essential',
    amount: -1950,
  },
  {
    id: 55,
    description: 'Metro - groceries',
    date: '2024-07-09',
    cashflow: 'expense',
    account: 'credit',
    category: 'Groceries',
    label: 'Household',
    amount: -118.9,
  },
  {
    id: 56,
    description: 'Cinéma Montréal',
    date: '2024-07-21',
    cashflow: 'expense',
    account: 'credit',
    category: 'Entertainment',
    label: 'Leisure',
    amount: -32.4,
  },
];
const transactionLabels = [...new Set(transactions.map((t) => t.label))];
const transactionCategories = [...new Set(transactions.map((t) => t.category))];

const monthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const longMonthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' });

const createFlowBucket = () => ({
  total: 0,
  signedTotal: 0,
  categories: new Map(),
  transactions: [],
});

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const monthlyMap = new Map();

transactions.forEach((tx) => {
  const date = new Date(tx.date);
  const key = getMonthKey(date);
  if (!monthlyMap.has(key)) {
    monthlyMap.set(key, {
      key,
      date,
      label: monthFormatter.format(date),
      longLabel: longMonthFormatter.format(date),
      income: createFlowBucket(),
      expense: createFlowBucket(),
      other: createFlowBucket(),
    });
  }

  const monthEntry = monthlyMap.get(key);
  const bucket =
    tx.cashflow === 'income' ? monthEntry.income : tx.cashflow === 'expense' ? monthEntry.expense : monthEntry.other;
  const magnitude = Math.abs(tx.amount);
  bucket.total += magnitude;
  bucket.signedTotal += tx.amount;
  bucket.transactions.push(tx.id);
  bucket.categories.set(tx.category, (bucket.categories.get(tx.category) || 0) + magnitude);
});

const monthlySequence = Array.from(monthlyMap.values()).sort((a, b) => a.date - b.date);
const timeframeMonths = { '3m': 3, '6m': 6, '12m': 12 };

const dashboardState = {
  timeframe: '3m',
  type: 'income',
  monthKey: monthlySequence.length ? monthlySequence[monthlySequence.length - 1].key : null,
};

const cashflowChartContainer = document.querySelector('[data-chart="cashflow"]');
const cashflowCategoriesList = document.querySelector('[data-list="cashflow-categories"]');
const cashflowTimeframeSelect = document.querySelector('[data-filter="cashflow-timeframe"]');
const dashboardTransactionsTable = document.querySelector('[data-table="dashboard-transactions"]');
const dashboardSummaryLabel = document.querySelector('[data-dashboard-summary]');

function switchTab(targetId) {
  tabButtons.forEach((tab) => tab.classList.toggle('active', tab.dataset.tabTarget === targetId));
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
}

tabButtons.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tabTarget));
});

if (uploadButton) {
  uploadButton.addEventListener('click', () => {
    uploadDialog.showModal();
  });
}

uploadDialog.addEventListener('close', () => {
  if (uploadDialog.returnValue === 'confirm') {
    showToast('Upload started. We will notify you when categorisation finishes.');
  }
});

function showToast(message) {
  toast.textContent = message;
  toast.dataset.state = 'visible';
  setTimeout(() => {
    toast.dataset.state = 'hidden';
  }, 2800);
}

function unlockModule(button) {
  const module = button.closest('.module');
  module.classList.remove('locked');
  const overlay = module.querySelector('.lock-overlay');
  if (overlay) {
    overlay.remove();
  }
  showToast('Sample data unlocked. Upload your statements to make it yours.');
}

document.querySelectorAll('.unlock-button').forEach((button) => {
  button.addEventListener('click', () => {
    unlockModule(button);
    const demo = button.dataset.demo;
    if (demo === 'cashflow') {
      renderDashboard();
    }
    if (demo === 'budget') {
      populateBudget('monthly');
    }
    if (demo === 'savings') {
      populateSavings('last-month');
    }
  });
});

if (cashflowTimeframeSelect) {
  cashflowTimeframeSelect.addEventListener('change', () => {
    dashboardState.timeframe = cashflowTimeframeSelect.value;
    ensureDashboardMonth();
    renderDashboard();
  });
}

if (cashflowChartContainer) {
  cashflowChartContainer.addEventListener('click', (event) => {
    const bar = event.target.closest('[data-month][data-type]');
    if (!bar) return;
    dashboardState.monthKey = bar.dataset.month;
    dashboardState.type = bar.dataset.type;
    renderDashboard();
  });
}

function getMonthsForTimeframe(timeframe) {
  const count = timeframeMonths[timeframe] || 3;
  return monthlySequence.slice(-count);
}

function ensureDashboardMonth() {
  const months = getMonthsForTimeframe(dashboardState.timeframe);
  if (!months.length) {
    dashboardState.monthKey = null;
    return;
  }
  if (!months.some((month) => month.key === dashboardState.monthKey)) {
    dashboardState.monthKey = months[months.length - 1].key;
  }
}

function buildCashflowChart() {
  if (!cashflowChartContainer) return;
  const months = getMonthsForTimeframe(dashboardState.timeframe);
  const maxValue = months.reduce((max, month) => Math.max(max, month.income.total, month.expense.total), 0);
  cashflowChartContainer.innerHTML = '';

  if (!months.length) {
    cashflowChartContainer.innerHTML = '<p class="empty-state">No cash flow data yet.</p>';
    return;
  }

  months.forEach((month) => {
    const group = document.createElement('div');
    group.className = 'chart-bar-group';

    ['income', 'expense'].forEach((type) => {
      const bucket = month[type];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chart-bar';
      button.dataset.month = month.key;
      button.dataset.type = type;
      button.setAttribute(
        'aria-label',
        `${type === 'income' ? 'Income' : 'Expenses'} for ${month.longLabel}`,
      );
      if (dashboardState.monthKey === month.key && dashboardState.type === type) {
        button.classList.add('active');
      }

      const fill = document.createElement('span');
      fill.className = 'chart-bar-fill';
      const height = maxValue ? Math.max(20, (bucket.total / maxValue) * 140) : 20;
      fill.style.height = `${height}px`;
      fill.dataset.type = type;
      button.appendChild(fill);

      const value = document.createElement('span');
      value.className = 'chart-value';
      value.textContent = currency(bucket.signedTotal);
      button.appendChild(value);

      group.appendChild(button);
    });

    const caption = document.createElement('small');
    caption.textContent = month.label;
    group.appendChild(caption);

    cashflowChartContainer.appendChild(group);
  });
}

function buildCashflowBreakdown() {
  if (!cashflowCategoriesList) return;
  cashflowCategoriesList.innerHTML = '';
  const month = dashboardState.monthKey ? monthlyMap.get(dashboardState.monthKey) : null;
  const bucket = month ? month[dashboardState.type] : null;

  if (!bucket || bucket.categories.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Select a bar to see category detail.';
    cashflowCategoriesList.appendChild(empty);
    return;
  }

  const categoryEntries = Array.from(bucket.categories.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const maxCategory = categoryEntries[0].value || 1;

  categoryEntries.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'breakdown-item';
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="progress"><span style="width:${Math.min(100, (item.value / maxCategory) * 100)}%"></span></div>
      </div>
      <span>${currency(dashboardState.type === 'expense' ? -item.value : item.value)}</span>
    `;
    cashflowCategoriesList.appendChild(row);
  });
}

function renderDashboardTransactions() {
  if (!dashboardTransactionsTable) return;
  dashboardTransactionsTable.innerHTML = '';
  const monthKey = dashboardState.monthKey;
  if (!monthKey) return;

  const filtered = transactions
    .filter((tx) => getMonthKey(new Date(tx.date)) === monthKey && tx.cashflow === dashboardState.type)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!filtered.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="empty-state">No transactions for this selection.</td>';
    dashboardTransactionsTable.appendChild(row);
    return;
  }

  filtered.forEach((tx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tx.description}</td>
      <td>${new Date(tx.date).toLocaleDateString('en-CA')}</td>
      <td>${tx.category}</td>
      <td class="numeric">${currency(tx.amount)}</td>
    `;
    dashboardTransactionsTable.appendChild(row);
  });
}

function updateDashboardSummary() {
  if (!dashboardSummaryLabel) return;
  const month = dashboardState.monthKey ? monthlyMap.get(dashboardState.monthKey) : null;
  if (!month) {
    dashboardSummaryLabel.textContent = 'Select a bar to explore transactions.';
    return;
  }
  const label = dashboardState.type === 'income' ? 'Income' : 'Expenses';
  dashboardSummaryLabel.textContent = `${label} for ${month.longLabel}`;
}

function renderDashboard() {
  ensureDashboardMonth();
  if (cashflowTimeframeSelect) {
    cashflowTimeframeSelect.value = dashboardState.timeframe;
  }
  buildCashflowChart();
  buildCashflowBreakdown();
  renderDashboardTransactions();
  updateDashboardSummary();
}

function populateBudget(period) {
  const summaryContainer = document.querySelector('[data-summary="budget"]');
  const list = document.querySelector('[data-list="budget"]');
  const monthSelect = document.querySelector('[data-filter="budget-month"]');
  const dataset = budgets[period];

  monthSelect.innerHTML = dataset.months
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join('');

  summaryContainer.innerHTML = `
    <div class="breakdown-item">
      <div>
        <strong>Budget</strong>
        <p class="feedback-note">Auto-set from your last 3 months</p>
      </div>
      <span>${currency(dataset.summary.budget)}</span>
    </div>
    <div class="breakdown-item">
      <div>
        <strong>Spent this ${period === 'monthly' ? 'month' : 'period'}</strong>
      </div>
      <span>${currency(dataset.summary.spent)}</span>
    </div>
    <div class="breakdown-item">
      <div>
        <strong>Savings</strong>
      </div>
      <span>${currency(dataset.summary.saved)}</span>
    </div>
  `;

  list.innerHTML = '';
  dataset.categories
    .slice()
    .sort((a, b) => b.target - a.target)
    .forEach((category) => {
      const pct = Math.min(100, (category.spent / category.target) * 100);
      const row = document.createElement('div');
      row.className = 'budget-item';
      row.innerHTML = `
        <div>
          <strong>${category.name}</strong>
          <div class="feedback-note">${currency(category.spent)} of ${currency(category.target)}</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
        </div>
        <span>${Math.round(pct)}%</span>
      `;
      list.appendChild(row);
    });
}

function populateSavings(view) {
  const summaryContainer = document.querySelector('[data-summary="savings"]');
  const list = document.querySelector('[data-list="savings"]');
  const dataset = savings[view];

  summaryContainer.innerHTML = `
    <div class="breakdown-item">
      <div>
        <strong>${dataset.summary.label}</strong>
        <p class="feedback-note">Saved ${currency(dataset.summary.last)} this period</p>
      </div>
      <span>${currency(dataset.summary.cumulative)}</span>
    </div>
  `;

  list.innerHTML = '';
  dataset.goals.forEach((goal) => {
    const pct = Math.min(100, (goal.contributed / goal.target) * 100);
    const row = document.createElement('div');
    row.className = 'savings-item';
    row.innerHTML = `
      <div>
        <strong>${goal.name}</strong>
        <div class="feedback-note">${goal.priority} priority</div>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </div>
      <span>${Math.round(pct)}%</span>
    `;
    list.appendChild(row);
  });
}

const budgetPeriodSelect = document.querySelector('[data-filter="budget-period"]');
const budgetMonthSelect = document.querySelector('[data-filter="budget-month"]');

if (budgetPeriodSelect) {
  budgetPeriodSelect.addEventListener('change', () => {
    populateBudget(budgetPeriodSelect.value);
  });
}

if (budgetMonthSelect) {
  budgetMonthSelect.addEventListener('change', () => {
    showToast(`Viewing ${budgetMonthSelect.selectedOptions[0].text} sample budget.`);
  });
}

const savingsPeriodSelect = document.querySelector('[data-filter="savings-period"]');

if (savingsPeriodSelect) {
  savingsPeriodSelect.addEventListener('change', () => {
    populateSavings(savingsPeriodSelect.value);
  });
}

const transactionTableBody = document.querySelector('[data-table="transactions"]');
const transactionSummaryCount = document.querySelector('[data-summary="count"]');
const transactionSummaryTotal = document.querySelector('[data-summary="total"]');
const searchInput = document.querySelector('[data-input="search"]');
const filterCashflow = document.querySelector('[data-filter="tx-cashflow"]');
const filterAccount = document.querySelector('[data-filter="tx-account"]');
const filterCategory = document.querySelector('[data-filter="tx-category"]');
const filterLabel = document.querySelector('[data-filter="tx-label"]');

function populateFilterOptions() {
  transactionCategories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    filterCategory.appendChild(option);
  });

  transactionLabels.forEach((label) => {
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    filterLabel.appendChild(option);
  });
}

function renderTransactions() {
  const term = searchInput.value.toLowerCase();
  const flow = filterCashflow.value;
  const account = filterAccount.value;
  const category = filterCategory.value;
  const label = filterLabel.value;

  const filtered = transactions
    .filter((tx) => {
      const matchesSearch =
        !term ||
        tx.description.toLowerCase().includes(term) ||
        tx.category.toLowerCase().includes(term) ||
        tx.label.toLowerCase().includes(term) ||
        `${Math.abs(tx.amount)}`.includes(term);
      const matchesFlow = flow === 'all' || tx.cashflow === flow;
      const matchesAccount = account === 'all' || tx.account === account;
      const matchesCategory = category === 'all' || tx.category === category;
      const matchesLabel = label === 'all' || tx.label === label;
      return matchesSearch && matchesFlow && matchesAccount && matchesCategory && matchesLabel;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  transactionTableBody.innerHTML = '';
  filtered.forEach((tx) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" data-tx="${tx.id}" /></td>
      <td>${tx.description}</td>
      <td>${new Date(tx.date).toLocaleDateString('en-CA')}</td>
      <td>${tx.cashflow}</td>
      <td>${tx.account}</td>
      <td>${tx.category}</td>
      <td>${tx.label}</td>
      <td class="numeric">${currency(tx.amount)}</td>
    `;
    transactionTableBody.appendChild(row);
  });

  bindTransactionSelection();
  updateTransactionSummary();
}

function bindTransactionSelection() {
  const checkboxes = transactionTableBody.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', updateTransactionSummary);
  });
}

function updateTransactionSummary() {
  const checkboxes = transactionTableBody.querySelectorAll('input[type="checkbox"]');
  let count = 0;
  let total = 0;
  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      count += 1;
      const tx = transactions.find((item) => item.id === Number(checkbox.dataset.tx));
      total += tx.amount;
    }
  });
  transactionSummaryCount.textContent = count;
  transactionSummaryTotal.textContent = currency(total);
}

[searchInput, filterCashflow, filterAccount, filterCategory, filterLabel].forEach((control) => {
  control.addEventListener('input', renderTransactions);
});

const subscriptionInsights = [
  {
    title: 'Netflix increased to $22.99 (+15%)',
    body: 'The premium plan went up versus your 3-month average. Consider downgrading or sharing a plan.',
  },
  {
    title: 'Duplicate: Crave and Disney+',
    body: 'You spend $42/mo across two streaming platforms. Could you keep just one this month?',
  },
  {
    title: 'Spotify hasn’t been used in 45 days',
    body: 'Based on low activity, consider pausing Spotify and switching to Apple Music’s free trial.',
  },
];

const fraudInsights = [
  {
    title: 'Possible duplicate ride with Uber',
    body: 'Two similar charges ($24.60) on June 18. If one was cancelled, request a refund.',
  },
  {
    title: 'Hydro-Québec preauth not released',
    body: 'A $200 pre-authorisation from May 28 is still pending after 7 days. Check your account status.',
  },
  {
    title: 'Bank fee spike at RBC',
    body: 'Monthly fee jumped from $4.00 to $7.50. Explore no-fee accounts like Simplii or EQ Bank.',
  },
];

const benchmarkCopy = {
  all: [
    {
      title: 'Transportation spend +12% vs. Canadian households',
      body: 'You spend $310/mo on transportation compared to the Canadian average of $276. Consider a commuter pass or rideshare credits.',
    },
    {
      title: 'Groceries -8% vs. Canadian households',
      body: 'At $480/mo, you are trending below the $520 national average while keeping healthy staples.',
    },
  ],
  students: [
    {
      title: 'Dining out higher than student peers',
      body: 'You spend $185/mo compared to the student average of $120. Try our $15 meal prep ideas.',
    },
  ],
  'young-professionals': [
    {
      title: 'Subscription stack looks lean',
      body: 'Most professionals your age pay for 5–6 services. You pay for 3—great job staying focused.',
    },
  ],
  households: [
    {
      title: 'Family groceries 5% lower than similar households',
      body: 'Smart use of Costco and PC Optimum points keeps you below average by $40/mo.',
    },
  ],
};

const insightFeedback = {
  useful: 0,
  maybe: 0,
  'not-useful': 0,
};

function renderInsightList(containerSelector, items) {
  const container = document.querySelector(containerSelector);
  container.innerHTML = '';
  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'insight-item';
    li.innerHTML = `
      <div>
        <strong>${item.title}</strong>
        <p class="feedback-note">${item.body}</p>
      </div>
      <div class="feedback-row">
        <button data-response="useful">Insightful</button>
        <button data-response="maybe">Maybe later</button>
        <button data-response="not-useful">Not relevant</button>
      </div>
      <div class="feedback-note" data-feedback></div>
    `;
    container.appendChild(li);
  });
}

function handleInsightFeedback(event) {
  const button = event.target.closest('button[data-response]');
  if (!button) return;

  const response = button.dataset.response;
  insightFeedback[response] += 1;
  const message =
    response === 'useful'
      ? 'Thanks! We will prioritise more insights like this.'
      : response === 'maybe'
      ? 'Got it. We will resurface this if it becomes more relevant.'
      : 'Thanks for the feedback—insights like this will show up less often.';

  const feedbackNote = button.closest('.insight-item').querySelector('[data-feedback]');
  feedbackNote.textContent = message;
  showToast(`Feedback captured. ${insightFeedback.useful} insights marked useful today.`);
}

document.querySelectorAll('.insight-list').forEach((list) => {
  list.addEventListener('click', handleInsightFeedback);
});

const benchmarkSelect = document.querySelector('[data-filter="benchmark-cohort"]');

if (benchmarkSelect) {
  benchmarkSelect.addEventListener('change', () => {
    renderInsightList('[data-list="benchmarks"]', benchmarkCopy[benchmarkSelect.value]);
  });
}

const feedbackForm = document.querySelector('[data-form="feedback"]');

if (feedbackForm) {
  feedbackForm.addEventListener('submit', (event) => {
    event.preventDefault();
    feedbackForm.reset();
    showToast('Thank you for the feedback—our team will review it within 24 hours.');
  });
}

function init() {
  renderDashboard();
  populateFilterOptions();
  renderTransactions();
  renderInsightList('[data-list="subscriptions"]', subscriptionInsights);
  renderInsightList('[data-list="fraud"]', fraudInsights);
  renderInsightList('[data-list="benchmarks"]', benchmarkCopy.all);
}

init();
