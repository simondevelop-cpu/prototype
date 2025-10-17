const tabs = document.querySelectorAll('.tab-button');
const panels = document.querySelectorAll('.tab-panel');
const uploadButton = document.querySelector('.cta-button');
const uploadDialog = document.getElementById('upload-dialog');
const toast = document.getElementById('toast');

const currency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

const cashflowData = {
  '3m': {
    months: ['Apr', 'May', 'Jun'],
    income: [6200, 6100, 6350],
    expense: [-4800, -4950, -5050],
    other: [320, -210, 150],
    categories: [
      { name: 'Housing', value: 2100 },
      { name: 'Groceries', value: 780 },
      { name: 'Transportation', value: 520 },
      { name: 'Dining out', value: 410 },
      { name: 'Subscriptions', value: 165 },
      { name: 'RRSP transfers', value: 400 },
    ],
  },
  '6m': {
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    income: [6100, 6050, 6000, 6200, 6100, 6350],
    expense: [-4700, -4550, -4850, -4800, -4950, -5050],
    other: [200, -120, 90, 320, -210, 150],
    categories: [
      { name: 'Housing', value: 4200 },
      { name: 'Groceries', value: 1540 },
      { name: 'Transportation', value: 1050 },
      { name: 'Dining out', value: 880 },
      { name: 'Subscriptions', value: 330 },
      { name: 'Travel', value: 650 },
    ],
  },
  '12m': {
    months: ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    income: [5900, 6020, 5980, 6000, 6050, 6100, 6100, 6050, 6000, 6200, 6100, 6350],
    expense: [-4550, -4700, -4600, -4725, -4800, -4825, -4700, -4550, -4850, -4800, -4950, -5050],
    other: [150, -80, 220, 175, -90, 60, 200, -120, 90, 320, -210, 150],
    categories: [
      { name: 'Housing', value: 8400 },
      { name: 'Groceries', value: 3050 },
      { name: 'Transportation', value: 2180 },
      { name: 'Dining out', value: 1760 },
      { name: 'Subscriptions', value: 660 },
      { name: 'Travel', value: 1450 },
      { name: 'Gifts', value: 520 },
    ],
  },
};

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
];

const labels = [...new Set(transactions.map((t) => t.label))];
const categories = [...new Set(transactions.map((t) => t.category))];

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

function switchTab(targetId) {
  tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === targetId));
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

uploadButton.addEventListener('click', () => {
  uploadDialog.showModal();
});

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

function buildCashflowChart(timeframe, type = 'all') {
  const chartContainer = document.querySelector('[data-chart="cashflow"]');
  chartContainer.innerHTML = '';

  const dataset = cashflowData[timeframe];
  const { months, income, expense, other } = dataset;

  months.forEach((label, index) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';

    const values = [];
    if (type === 'all' || type === 'income') values.push({ type: 'income', amount: income[index] });
    if (type === 'all' || type === 'expense') values.push({ type: 'expense', amount: Math.abs(expense[index]) });
    if (type === 'all' || type === 'other') values.push({ type: 'other', amount: Math.abs(other[index]) });

    const maxValue = Math.max(...values.map((item) => item.amount));

    values.forEach((value) => {
      const segment = document.createElement('span');
      segment.textContent = currency(value.amount);
      segment.style.height = `${Math.max(30, (value.amount / (maxValue || 1)) * 120)}px`;
      segment.dataset.type = value.type;
      bar.appendChild(segment);
    });

    const caption = document.createElement('small');
    caption.textContent = label;
    bar.appendChild(caption);
    chartContainer.appendChild(bar);
  });

  buildCashflowBreakdown(timeframe);
}

function buildCashflowBreakdown(timeframe) {
  const list = document.querySelector('[data-list="cashflow-categories"]');
  const dataset = cashflowData[timeframe];
  list.innerHTML = '';
  dataset.categories
    .slice()
    .sort((a, b) => b.value - a.value)
    .forEach((item) => {
      const row = document.createElement('div');
      row.className = 'breakdown-item';
      row.innerHTML = `
        <div>
          <strong>${item.name}</strong>
          <div class="progress"><span style="width:${Math.min(100, (item.value / dataset.categories[0].value) * 100)}%"></span></div>
        </div>
        <span>${currency(item.value)}</span>
      `;
      list.appendChild(row);
    });
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
        <p class="feedback-note">Savings captured through RRSP, TFSA and cash goals.</p>
      </div>
      <span>${currency(dataset.summary.last)}</span>
    </div>
    <div class="breakdown-item">
      <div>
        <strong>Total saved</strong>
      </div>
      <span>${currency(dataset.summary.cumulative)}</span>
    </div>
  `;

  list.innerHTML = '';
  dataset.goals.forEach((goal) => {
    const pct = Math.min(100, (goal.contributed / goal.target) * 100);
    const row = document.createElement('div');
    row.className = 'goal-item';
    row.innerHTML = `
      <div>
        <strong>${goal.name}</strong>
        <div class="feedback-note">Priority: ${goal.priority}</div>
        <div class="progress"><span style="width:${pct}%"></span></div>
      </div>
      <span>${currency(goal.contributed)} of ${currency(goal.target)}</span>
    `;
    list.appendChild(row);
  });
}

function unlockModule(button) {
  const module = button.closest('.module');
  const overlay = module.querySelector('.lock-overlay');
  overlay.classList.add('hidden');
  showToast('Sample data unlocked. Upload your statements to make it yours.');
}

document.querySelectorAll('.unlock-button').forEach((button) => {
  button.addEventListener('click', () => {
    unlockModule(button);
    const demo = button.dataset.demo;
    if (demo === 'cashflow') {
      buildCashflowChart('3m');
    }
    if (demo === 'budget') {
      populateBudget('monthly');
    }
    if (demo === 'savings') {
      populateSavings('last-month');
    }
  });
});

const cashflowTimeframeSelect = document.querySelector('[data-filter="cashflow-timeframe"]');
const cashflowTypeSelect = document.querySelector('[data-filter="cashflow-type"]');

cashflowTimeframeSelect.addEventListener('change', () => {
  buildCashflowChart(cashflowTimeframeSelect.value, cashflowTypeSelect.value);
});

cashflowTypeSelect.addEventListener('change', () => {
  buildCashflowChart(cashflowTimeframeSelect.value, cashflowTypeSelect.value);
});

const budgetPeriodSelect = document.querySelector('[data-filter="budget-period"]');
const budgetMonthSelect = document.querySelector('[data-filter="budget-month"]');

budgetPeriodSelect.addEventListener('change', () => {
  populateBudget(budgetPeriodSelect.value);
});

budgetMonthSelect.addEventListener('change', () => {
  showToast(`Viewing ${budgetMonthSelect.selectedOptions[0].text} sample budget.`);
});

const savingsPeriodSelect = document.querySelector('[data-filter="savings-period"]');

savingsPeriodSelect.addEventListener('change', () => {
  populateSavings(savingsPeriodSelect.value);
});

const transactionTableBody = document.querySelector('[data-table="transactions"]');
const transactionSummaryCount = document.querySelector('[data-summary="count"]');
const transactionSummaryTotal = document.querySelector('[data-summary="total"]');
const searchInput = document.querySelector('[data-input="search"]');
const filterCashflow = document.querySelector('[data-filter="tx-cashflow"]');
const filterAccount = document.querySelector('[data-filter="tx-account"]');
const filterCategory = document.querySelector('[data-filter="tx-category"]');
const filterLabel = document.querySelector('[data-filter="tx-label"]');

function populateFilterOptions() {
  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    filterCategory.appendChild(option);
  });

  labels.forEach((label) => {
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

  const filtered = transactions.filter((tx) => {
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
  });

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

benchmarkSelect.addEventListener('change', () => {
  renderInsightList('[data-list="benchmarks"]', benchmarkCopy[benchmarkSelect.value]);
});

const feedbackForm = document.querySelector('[data-form="feedback"]');

feedbackForm.addEventListener('submit', (event) => {
  event.preventDefault();
  feedbackForm.reset();
  showToast('Thank you for the feedback—our team will review it within 24 hours.');
});

function init() {
  populateFilterOptions();
  renderTransactions();
  renderInsightList('[data-list="subscriptions"]', subscriptionInsights);
  renderInsightList('[data-list="fraud"]', fraudInsights);
  renderInsightList('[data-list="benchmarks"]', benchmarkCopy.all);
}

init();
