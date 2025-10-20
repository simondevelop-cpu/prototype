const tabButtons = document.querySelectorAll('[data-tab-target]');
const panels = document.querySelectorAll('.tab-panel');
const uploadButton = document.querySelector('[data-trigger="upload"]');
const uploadDialog = document.getElementById('upload-dialog');
const toast = document.getElementById('toast');
const avatarButton = document.querySelector('.avatar-button');
const avatarInitial = document.querySelector('[data-user-initial]');

const authDialog = document.getElementById('auth-dialog');
const loginForm = document.querySelector('[data-form="login"]');
const demoLoginButton = document.querySelector('[data-action="demo-login"]');
const closeLoginButton = document.querySelector('[data-action="close-login"]');
const authError = document.querySelector('[data-auth-error]');
const logoutButton = document.querySelector('[data-action="logout"]');

const AUTH_TOKEN_KEY = 'ci.session.token';
const AUTH_USER_KEY = 'ci.session.user';
const currency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(Number(value) || 0);

const monthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const longMonthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'long', year: 'numeric' });

const timeframeMonths = { '3m': 3, '6m': 6, '12m': 12 };

const state = {
  auth: { token: null, user: null },
  dashboard: {
    timeframe: '3m',
    type: 'income',
    monthKey: null,
    customRange: { start: '', end: '' },
  },
  summary: null,
  transactions: [],
  transactionMeta: { categories: [], labels: [] },
  insights: { subscriptions: [], fraud: [], benchmarks: [], cohort: 'all' },
  budgetCache: new Map(),
  savingsCache: new Map(),
};

let monthlySequence = [];
let transactionIndex = new Map();
let toastTimeout = null;
const insightFeedbackTally = { useful: 0, maybe: 0, 'not-useful': 0 };

const cashflowChartContainer = document.querySelector('[data-chart="cashflow"]');
const cashflowCategoriesList = document.querySelector('[data-list="cashflow-categories"]');
const cashflowTimeframeSelect = document.querySelector('[data-filter="cashflow-timeframe"]');
const dashboardTransactionsTable = document.querySelector('[data-table="dashboard-transactions"]');
const dashboardSummaryLabel = document.querySelector('[data-dashboard-summary]');
const categorisationSummaryLabel = document.querySelector('[data-categorisation-summary]');
const customRangeContainer = document.querySelector('[data-custom-range]');
const customStartSelect = document.querySelector('[data-custom-start]');
const customEndSelect = document.querySelector('[data-custom-end]');

const transactionTableBody = document.querySelector('[data-table="transactions"]');
const transactionSummaryCount = document.querySelector('[data-summary="count"]');
const transactionSummaryTotal = document.querySelector('[data-summary="total"]');
const searchInput = document.querySelector('[data-input="search"]');
const filterCashflow = document.querySelector('[data-filter="tx-cashflow"]');
const filterAccount = document.querySelector('[data-filter="tx-account"]');
const filterCategory = document.querySelector('[data-filter="tx-category"]');
const filterLabel = document.querySelector('[data-filter="tx-label"]');
const benchmarkSelect = document.querySelector('[data-filter="benchmark-cohort"]');
const feedbackForm = document.querySelector('[data-form="feedback"]');

function showToast(message, tone = 'info') {
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.state = 'visible';
  toast.dataset.tone = tone;
  if (toastTimeout) {
    window.clearTimeout(toastTimeout);
  }
  toastTimeout = window.setTimeout(() => {
    toast.dataset.state = 'hidden';
  }, 3200);
}

function updateAvatar() {
  if (!avatarInitial || !avatarButton) return;
  const user = state.auth.user;
  if (user) {
    const name = user.name?.trim() || user.email || 'your account';
    avatarInitial.textContent = `Signed in as ${name}`;
    avatarButton.setAttribute('aria-label', `Account settings for ${name}`);
  } else {
    avatarInitial.textContent = 'Sign in';
    avatarButton.setAttribute('aria-label', 'Sign in');
  }
}

function persistSession() {
  if (state.auth.token && state.auth.user) {
    localStorage.setItem(AUTH_TOKEN_KEY, state.auth.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(state.auth.user));
  }
}

function clearPersistedSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function clearDataState() {
  state.summary = null;
  state.transactions = [];
  state.transactionMeta = { categories: [], labels: [] };
  state.insights = { subscriptions: [], fraud: [], benchmarks: [], cohort: 'all' };
  state.budgetCache.clear();
  state.savingsCache.clear();
  state.dashboard.monthKey = null;
  monthlySequence = [];
  transactionIndex = new Map();
}

function renderSignedOutState() {
  renderDashboard();
  renderTransactions();
  renderInsightList('[data-list="subscriptions"]', []);
  renderInsightList('[data-list="fraud"]', []);
  renderInsightList('[data-list="benchmarks"]', []);
  const summaryContainer = document.querySelector('[data-summary="budget"]');
  const budgetList = document.querySelector('[data-list="budget"]');
  const savingsSummary = document.querySelector('[data-summary="savings"]');
  const savingsList = document.querySelector('[data-list="savings"]');
  if (summaryContainer) summaryContainer.innerHTML = '';
  if (budgetList) budgetList.innerHTML = '';
  if (savingsSummary) savingsSummary.innerHTML = '';
  if (savingsList) savingsList.innerHTML = '';
  if (filterCategory) {
    while (filterCategory.options.length > 1) {
      filterCategory.remove(1);
    }
  }
  if (filterLabel) {
    while (filterLabel.options.length > 1) {
      filterLabel.remove(1);
    }
  }
}

function clearSession({ silent = false } = {}) {
  state.auth = { token: null, user: null };
  clearPersistedSession();
  updateAvatar();
  clearDataState();
  renderSignedOutState();
  if (!silent) {
    showToast('Signed out.');
  }
}

function setSession(token, user, { silent = false, skipData = false } = {}) {
  state.auth = { token, user };
  persistSession();
  updateAvatar();
  if (!silent) {
    const firstName = user?.name?.split(' ')?.[0] || 'there';
    showToast(`Welcome back, ${firstName}!`);
  }
  if (!skipData) {
    loadAllData();
  }
}

function openAuthDialog() {
  if (authDialog && !authDialog.open) {
    authDialog.showModal();
  }
}

function closeAuthDialog() {
  if (authDialog?.open) {
    authDialog.close();
  }
  if (authError) authError.textContent = '';
  loginForm?.reset();
}

function handleUnauthorized() {
  const wasAuthenticated = Boolean(state.auth.token);
  clearSession({ silent: true });
  if (wasAuthenticated) {
    showToast('Session expired. Please sign in again.', 'danger');
  }
  openAuthDialog();
}

async function apiFetch(path, options = {}) {
  const { skipAuthHandling, ...rest } = options;
  const opts = { ...rest };
  const headers = new Headers(opts.headers || {});
  if (opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'object') {
    headers.set('Content-Type', 'application/json');
    opts.body = JSON.stringify(opts.body);
  }
  if (!(opts.body instanceof FormData)) {
    headers.set('Accept', 'application/json');
  }
  if (state.auth.token) {
    headers.set('Authorization', `Bearer ${state.auth.token}`);
  }
  opts.headers = headers;

  const response = await fetch(path, opts);
  if ((response.status === 401 || response.status === 403) && !skipAuthHandling) {
    handleUnauthorized();
    throw new Error('unauthorised');
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Request failed');
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function createFlowBucket(total = 0) {
  return {
    total,
    transactions: [],
    categories: new Map(),
  };
}

function getMonthsForTimeframe(timeframe) {
  const count = timeframeMonths[timeframe] || 3;
  if (!monthlySequence.length) return [];
  return monthlySequence.slice(-count);
}

function ensureDashboardMonth() {
  const months = getMonthsForTimeframe(state.dashboard.timeframe);
  if (!months.length) {
    state.dashboard.monthKey = null;
    return;
  }
  if (!months.some((month) => month.key === state.dashboard.monthKey)) {
    state.dashboard.monthKey = months[months.length - 1].key;
  }
}

function updateCustomRangeControls() {
  if (!customRangeContainer || !customStartSelect || !customEndSelect) return;
  const isCustom = state.dashboard.timeframe === 'custom';
  customRangeContainer.hidden = !isCustom;
  const hasMonths = monthlySequence.length > 0;
  customStartSelect.disabled = !hasMonths || !isCustom;
  customEndSelect.disabled = !hasMonths || !isCustom;
  if (!hasMonths) {
    return;
  }
  customStartSelect.value = state.dashboard.customRange.start || '';
  customEndSelect.value = state.dashboard.customRange.end || '';
}

function calculateNiceMax(value) {
  if (!value) return 0;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  let niceNormalized;
  if (normalized <= 1) {
    niceNormalized = 1;
  } else if (normalized <= 2) {
    niceNormalized = 2;
  } else if (normalized <= 5) {
    niceNormalized = 5;
  } else {
    niceNormalized = 10;
  }
  return niceNormalized * magnitude;
}

function buildCashflowChart() {
  if (!cashflowChartContainer) return;
  const months = getMonthsForTimeframe(state.dashboard.timeframe);
  cashflowChartContainer.innerHTML = '';
  if (!months.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = state.auth.token
      ? 'No cash flow data available yet.'
      : 'Sign in to explore your cash flow.';
    cashflowChartContainer.appendChild(empty);
    return;
  }

  const maxValue = calculateNiceMax(
    months.reduce((max, month) => Math.max(max, month.income.total, month.expense.total, month.other.total), 0)
  );

  months.forEach((month) => {
    const group = document.createElement('div');
    group.className = 'chart-bar-group';
    ['income', 'expense', 'other'].forEach((type) => {
      const bucket = month[type];
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.month = month.key;
      button.dataset.type = type;
      button.className = 'chart-bar';
      button.setAttribute('aria-label', `${type === 'income' ? 'Income' : 'Expenses'} for ${month.longLabel}`);
      if (state.dashboard.monthKey === month.key && state.dashboard.type === type) {
        button.classList.add('active');
      }

      const fill = document.createElement('span');
      fill.className = 'chart-bar-fill';
      const height = maxValue ? Math.max(24, (bucket.total / maxValue) * 180) : 24;
      fill.style.height = `${height}px`;
      fill.dataset.type = type;
      button.appendChild(fill);

      const value = document.createElement('span');
      value.className = 'chart-value';
      value.textContent = currency(bucket.total);
      value.dataset.type = type;
      button.appendChild(value);

      group.appendChild(button);
    });

    const caption = document.createElement('small');
    caption.textContent = monthFormatter.format(month.date);
    group.appendChild(caption);

    cashflowChartContainer.appendChild(group);
  });
}

function buildCashflowBreakdown() {
  if (!cashflowCategoriesList) return;
  cashflowCategoriesList.innerHTML = '';
  const monthEntry = monthlySequence.find((month) => month.key === state.dashboard.monthKey);
  const bucket = monthEntry ? monthEntry[state.dashboard.type] : null;

  if (!bucket || bucket.categories.size === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = state.auth.token
      ? 'Select a bar to see category detail.'
      : 'Sign in to view category insights.';
    cashflowCategoriesList.appendChild(empty);
    return;
  }

  const categoryEntries = Array.from(bucket.categories.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const maxCategory = categoryEntries[0]?.value || 1;

  categoryEntries.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'breakdown-item';
    row.dataset.type = state.dashboard.type;
    const width = Math.min(100, (item.value / maxCategory) * 100);
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="progress"><span data-type="${state.dashboard.type}" style="width:${width}%"></span></div>
      </div>
      <span>${currency(state.dashboard.type === 'expense' ? -item.value : item.value)}</span>
    `;
    cashflowCategoriesList.appendChild(row);
  });
}

function renderDashboardTransactions() {
  if (!dashboardTransactionsTable) return;
  dashboardTransactionsTable.innerHTML = '';
  const monthEntry = monthlySequence.find((month) => month.key === state.dashboard.monthKey);
  const bucket = monthEntry ? monthEntry[state.dashboard.type] : null;
  if (!bucket || !bucket.transactions.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4" class="empty-state">' +
      (state.auth.token ? 'No transactions for this selection.' : 'Sign in to view transactions.') +
      '</td>';
    dashboardTransactionsTable.appendChild(row);
    return;
  }

  const sorted = bucket.transactions
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  sorted.forEach((tx) => {
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
  const monthEntry = monthlySequence.find((month) => month.key === state.dashboard.monthKey);
  const label = state.dashboard.type === 'income' ? 'Income' : 'Expenses';
  const transactionsMessage = monthEntry
    ? `${label} for ${monthEntry.longLabel}`
    : state.auth.token
    ? 'Select a bar to explore transactions.'
    : 'Sign in to explore transactions.';
  const categorisationMessage = monthEntry
    ? `${label} categories for ${monthEntry.longLabel}`
    : state.auth.token
    ? 'Select a bar to see category detail.'
    : 'Sign in to see category detail.';

  if (dashboardSummaryLabel) {
    dashboardSummaryLabel.textContent = transactionsMessage;
  }

  if (categorisationSummaryLabel) {
    categorisationSummaryLabel.textContent = categorisationMessage;
  }
}

function renderDashboard() {
  ensureDashboardMonth();
  updateCustomRangeControls();
  if (cashflowTimeframeSelect) {
    cashflowTimeframeSelect.value = state.dashboard.timeframe;
  }
  buildCashflowChart();
  buildCashflowBreakdown();
  renderDashboardTransactions();
  updateDashboardSummary();
}

function populateFilterOptions() {
  if (!filterCategory || !filterLabel) return;
  while (filterCategory.options.length > 1) {
    filterCategory.remove(1);
  }
  while (filterLabel.options.length > 1) {
    filterLabel.remove(1);
  }

  state.transactionMeta.categories.forEach((category) => {
    if (!category) return;
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    filterCategory.appendChild(option);
  });

  state.transactionMeta.labels.forEach((label) => {
    if (!label) return;
    const option = document.createElement('option');
    option.value = label;
    option.textContent = label;
    filterLabel.appendChild(option);
  });
}

function bindTransactionSelection() {
  if (!transactionTableBody) return;
  const checkboxes = transactionTableBody.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener('change', updateTransactionSummary);
  });
}

function updateTransactionSummary() {
  if (!transactionSummaryCount || !transactionSummaryTotal) return;
  const checkboxes = transactionTableBody
    ? transactionTableBody.querySelectorAll('input[type="checkbox"]')
    : [];
  let count = 0;
  let total = 0;
  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      count += 1;
      const tx = transactionIndex.get(checkbox.dataset.tx);
      if (tx) {
        total += Number(tx.amount) || 0;
      }
    }
  });
  transactionSummaryCount.textContent = count;
  transactionSummaryTotal.textContent = currency(total);
}

function renderTransactions() {
  if (!transactionTableBody) return;
  transactionTableBody.innerHTML = '';
  if (!state.auth.token) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" class="empty-state">Sign in to view transactions.</td>';
    transactionTableBody.appendChild(row);
    updateTransactionSummary();
    return;
  }

  const term = searchInput?.value.trim().toLowerCase() || '';
  const flow = filterCashflow?.value || 'all';
  const account = filterAccount?.value || 'all';
  const categoryFilter = filterCategory?.value || 'all';
  const labelFilter = filterLabel?.value || 'all';

  const filtered = state.transactions
    .filter((tx) => {
      const description = (tx.description || '').toLowerCase();
      const category = (tx.category || '').toLowerCase();
      const label = (tx.label || '').toLowerCase();
      const matchesSearch =
        !term ||
        description.includes(term) ||
        category.includes(term) ||
        label.includes(term) ||
        `${Math.abs(Number(tx.amount) || 0)}`.includes(term);
      const matchesFlow = flow === 'all' || tx.cashflow === flow;
      const matchesAccount = account === 'all' || tx.account === account;
      const matchesCategory = categoryFilter === 'all' || tx.category === categoryFilter;
      const matchesLabel = labelFilter === 'all' || tx.label === labelFilter;
      return matchesSearch && matchesFlow && matchesAccount && matchesCategory && matchesLabel;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  if (!filtered.length) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="8" class="empty-state">No transactions match your filters.</td>';
    transactionTableBody.appendChild(row);
    updateTransactionSummary();
    return;
  }

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

function renderInsightList(selector, items) {
  const container = document.querySelector(selector);
  if (!container) return;
  container.innerHTML = '';
  const type = container.dataset.list;

  if (!state.auth.token) {
    const li = document.createElement('li');
    li.className = 'insight-item';
    li.innerHTML = '<p class="feedback-note">Sign in to generate personalised insights.</p>';
    container.appendChild(li);
    return;
  }

  if (!items || !items.length) {
    const li = document.createElement('li');
    li.className = 'insight-item';
    li.innerHTML = '<p class="feedback-note">No insights available yet. Upload more data to generate recommendations.</p>';
    container.appendChild(li);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'insight-item';
    li.dataset.title = item.title;
    li.dataset.type = type || '';
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
  if (!state.auth.token) {
    openAuthDialog();
    showToast('Sign in to share insight feedback.');
    return;
  }

  const response = button.dataset.response;
  const item = button.closest('.insight-item');
  const list = button.closest('.insight-list');
  if (!item || !list) return;
  const type = list.dataset.list || 'insights';
  const title = item.dataset.title || item.querySelector('strong')?.textContent || '';
  const feedbackNote = item.querySelector('[data-feedback]');

  insightFeedbackTally[response] += 1;
  const message =
    response === 'useful'
      ? 'Thanks! We will prioritise more insights like this.'
      : response === 'maybe'
      ? 'Got it. We will resurface this if it becomes more relevant.'
      : 'Thanks for the feedback—insights like this will show up less often.';
  if (feedbackNote) {
    feedbackNote.textContent = message;
  }

  apiFetch(`/api/insights/${encodeURIComponent(type)}/feedback`, {
    method: 'POST',
    body: { response, title },
  }).catch((error) => {
    console.error('Failed to record insight feedback', error);
  });

  showToast(`Feedback captured. ${insightFeedbackTally.useful} insights marked useful today.`);
}

async function loginWithCredentials(email, password) {
  const trimmedEmail = email?.trim();
  const trimmedPassword = password?.trim();
  if (!trimmedEmail || !trimmedPassword) {
    throw new Error('Missing credentials');
  }
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email: trimmedEmail, password: trimmedPassword },
    skipAuthHandling: true,
  });
  return result;
}

async function startDemoSession() {
  const result = await apiFetch('/api/auth/demo', { method: 'POST', skipAuthHandling: true });
  return result;
}

async function loadSummary(timeframe = state.dashboard.timeframe) {
  if (!state.auth.token) return;
  try {
    const data = await apiFetch(`/api/summary?window=${encodeURIComponent(timeframe)}`);
    state.summary = data;
    state.dashboard.timeframe = timeframe;
    if (data.monthKeys && data.monthKeys.length) {
      if (!data.monthKeys.includes(state.dashboard.monthKey)) {
        state.dashboard.monthKey = data.monthKeys[data.monthKeys.length - 1];
      }
    } else {
      state.dashboard.monthKey = null;
    }
    rebuildMonthlySequence();
  } catch (error) {
    console.error('Failed to load summary', error);
    showToast('Unable to load cash flow summary.', 'danger');
  }
}

async function loadTransactions() {
  if (!state.auth.token) return;
  try {
    const data = await apiFetch('/api/transactions?limit=500');
    const items = data.transactions || [];
    state.transactions = items.map((tx) => ({
      ...tx,
      amount: Number(tx.amount),
      label: tx.label || '',
      category: tx.category || '',
      monthKey: tx.date ? tx.date.slice(0, 7) : '',
    }));
    state.transactionMeta.categories = data.categories || [];
    state.transactionMeta.labels = data.labels || [];
    transactionIndex = new Map(state.transactions.map((tx) => [String(tx.id), tx]));
    populateFilterOptions();
    renderTransactions();
    rebuildMonthlySequence();
  } catch (error) {
    console.error('Failed to load transactions', error);
    showToast('Unable to load transactions.', 'danger');
  }
}

async function loadInsights(cohort = state.insights.cohort) {
  if (!state.auth.token) return;
  try {
    const data = await apiFetch(`/api/insights?cohort=${encodeURIComponent(cohort)}`);
    state.insights = { ...data, cohort };
    renderInsightList('[data-list="subscriptions"]', data.subscriptions || []);
    renderInsightList('[data-list="fraud"]', data.fraud || []);
    renderInsightList('[data-list="benchmarks"]', data.benchmarks || []);
  } catch (error) {
    console.error('Failed to load insights', error);
    showToast('Unable to load insights.', 'danger');
  }
}

async function ensureBudget(period) {
  if (state.budgetCache.has(period)) {
    return state.budgetCache.get(period);
  }
  const data = await apiFetch(`/api/budget?period=${encodeURIComponent(period)}`);
  state.budgetCache.set(period, data);
  return data;
}

async function populateBudget(period) {
  const summaryContainer = document.querySelector('[data-summary="budget"]');
  const list = document.querySelector('[data-list="budget"]');
  const monthSelect = document.querySelector('[data-filter="budget-month"]');
  if (!summaryContainer || !list || !monthSelect) return;

  if (!state.auth.token) {
    summaryContainer.innerHTML = '<p class="empty-state">Sign in to view budget insights.</p>';
    list.innerHTML = '';
    return;
  }

  summaryContainer.innerHTML = '<p class="feedback-note">Loading budget…</p>';
  list.innerHTML = '';
  try {
    const dataset = await ensureBudget(period);
    monthSelect.innerHTML = dataset.months
      .map((month, index) => `<option value="${index}">${month}</option>`)
      .join('');
    monthSelect.selectedIndex = 0;

    summaryContainer.innerHTML = `
      <div class="breakdown-item">
        <div>
          <strong>Budget</strong>
          <p class="feedback-note">Auto-set from your recent trends</p>
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
      .sort((a, b) => b.spent - a.spent)
      .forEach((category) => {
        const pct = category.target ? Math.min(100, (category.spent / category.target) * 100) : 0;
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
  } catch (error) {
    console.error('Failed to load budget', error);
    summaryContainer.innerHTML = '<p class="empty-state">Unable to load budget right now.</p>';
    showToast('Unable to load budget insights.', 'danger');
  }
}

async function ensureSavings(range) {
  if (state.savingsCache.has(range)) {
    return state.savingsCache.get(range);
  }
  const data = await apiFetch(`/api/savings?range=${encodeURIComponent(range)}`);
  state.savingsCache.set(range, data);
  return data;
}

async function populateSavings(view) {
  const summaryContainer = document.querySelector('[data-summary="savings"]');
  const list = document.querySelector('[data-list="savings"]');
  if (!summaryContainer || !list) return;

  if (!state.auth.token) {
    summaryContainer.innerHTML = '<p class="empty-state">Sign in to track your savings momentum.</p>';
    list.innerHTML = '';
    return;
  }

  summaryContainer.innerHTML = '<p class="feedback-note">Loading savings…</p>';
  list.innerHTML = '';
  try {
    const dataset = await ensureSavings(view);
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
      const pct = goal.target ? Math.min(100, (goal.contributed / goal.target) * 100) : 0;
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
  } catch (error) {
    console.error('Failed to load savings', error);
    summaryContainer.innerHTML = '<p class="empty-state">Unable to load savings insights.</p>';
    showToast('Unable to load savings insights.', 'danger');
  }
}

function rebuildMonthlySequence() {
  monthlySequence = [];
  if (!state.summary || !state.summary.monthKeys) {
    renderDashboard();
    return;
  }

  monthlySequence = state.summary.monthKeys.map((key, index) => {
    const [year, month] = key.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, 1);
    return {
      key,
      date,
      label: state.summary.months?.[index] || monthFormatter.format(date),
      longLabel: longMonthFormatter.format(date),
      income: createFlowBucket(Math.abs(state.summary.income?.[index] || 0)),
      expense: createFlowBucket(Math.abs(state.summary.expense?.[index] || 0)),
      other: createFlowBucket(Math.abs(state.summary.other?.[index] || 0)),
    };
  });

  const sequenceMap = new Map(monthlySequence.map((entry) => [entry.key, entry]));
  state.transactions.forEach((tx) => {
    const entry = sequenceMap.get(tx.monthKey);
    if (!entry) return;
    const type = ['income', 'expense', 'other'].includes(tx.cashflow) ? tx.cashflow : 'other';
    const bucket = entry[type];
    bucket.transactions.push(tx);
    const category = tx.category || 'Uncategorised';
    const current = bucket.categories.get(category) || 0;
    bucket.categories.set(category, current + Math.abs(Number(tx.amount) || 0));
  });

  renderDashboard();
}

async function loadAllData() {
  if (!state.auth.token) return;
  await Promise.all([loadSummary(state.dashboard.timeframe), loadTransactions()]);
  loadInsights(state.insights.cohort);
  ensureBudget('monthly').catch((error) => {
    console.error('Preloading monthly budget failed', error);
  });
  ensureSavings('last-month').catch((error) => {
    console.error('Preloading savings failed', error);
  });
}

function switchTab(targetId) {
  tabButtons.forEach((tab) => tab.classList.toggle('active', tab.dataset.tabTarget === targetId));
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
}

function unlockModule(button) {
  if (!state.auth.token) {
    openAuthDialog();
    showToast('Sign in to explore the live demo data.');
    return;
  }
  const module = button.closest('.module');
  if (!module) return;
  module.classList.remove('locked');
  const overlay = module.querySelector('.lock-overlay');
  if (overlay) {
    overlay.remove();
  }
  showToast('Sample data unlocked. Upload your statements to make it yours.');
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
}

function handleFeedbackSubmit(event) {
  event.preventDefault();
  if (!state.auth.token) {
    openAuthDialog();
    showToast('Sign in to submit feedback.');
    return;
  }
  const textarea = feedbackForm?.querySelector('textarea');
  const message = textarea?.value?.trim() || 'Prototype feedback submitted.';
  apiFetch('/api/feedback', {
    method: 'POST',
    body: { message },
  })
    .then(() => {
      feedbackForm.reset();
      showToast('Thank you for the feedback—our team will review it within 24 hours.');
    })
    .catch((error) => {
      console.error('Failed to send feedback', error);
      showToast('Unable to submit feedback right now.', 'danger');
    });
}

function attachEventListeners() {
  tabButtons.forEach((tab) => {
    tab.addEventListener('click', (event) => {
      const targetId = tab.dataset.tabTarget;
      if (tab === avatarButton && !state.auth.token) {
        event.preventDefault();
        openAuthDialog();
        return;
      }
      switchTab(targetId);
    });
  });

  if (uploadButton) {
    uploadButton.addEventListener('click', () => {
      if (!state.auth.token) {
        openAuthDialog();
        showToast('Sign in to upload transactions.');
        return;
      }
      uploadDialog?.showModal();
    });
  }

  document.querySelectorAll('.unlock-button').forEach((button) => {
    button.addEventListener('click', () => unlockModule(button));
  });

  if (cashflowTimeframeSelect) {
    cashflowTimeframeSelect.addEventListener('change', () => {
      state.dashboard.timeframe = cashflowTimeframeSelect.value;
      loadSummary(state.dashboard.timeframe);
    });
  }

  if (cashflowChartContainer) {
    cashflowChartContainer.addEventListener('click', (event) => {
      const bar = event.target.closest('[data-month][data-type]');
      if (!bar) return;
      state.dashboard.monthKey = bar.dataset.month;
      state.dashboard.type = bar.dataset.type;
      renderDashboard();
    });
  }

  [searchInput, filterCashflow, filterAccount, filterCategory, filterLabel].forEach((control) => {
    control?.addEventListener('input', renderTransactions);
  });

  document.querySelectorAll('.insight-list').forEach((list) => {
    list.addEventListener('click', handleInsightFeedback);
  });

  if (benchmarkSelect) {
    benchmarkSelect.addEventListener('change', () => {
      state.insights.cohort = benchmarkSelect.value;
      loadInsights(state.insights.cohort);
    });
  }

  if (feedbackForm) {
    feedbackForm.addEventListener('submit', handleFeedbackSubmit);
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!loginForm) return;
      const formData = new FormData(loginForm);
      const email = formData.get('email');
      const password = formData.get('password');
      try {
        if (authError) authError.textContent = '';
        const result = await loginWithCredentials(email, password);
        setSession(result.token, result.user);
        closeAuthDialog();
      } catch (error) {
        console.error('Login failed', error);
        if (authError) authError.textContent = 'Invalid email or password. Try the demo login if needed.';
      }
    });
  }

  if (demoLoginButton) {
    demoLoginButton.addEventListener('click', async () => {
      try {
        demoLoginButton.disabled = true;
        if (authError) authError.textContent = '';
        const result = await startDemoSession();
        setSession(result.token, result.user, { silent: false });
        closeAuthDialog();
      } catch (error) {
        console.error('Demo login failed', error);
        showToast('Unable to start the demo session.', 'danger');
      } finally {
        demoLoginButton.disabled = false;
      }
    });
  }

  if (closeLoginButton) {
    closeLoginButton.addEventListener('click', () => {
      closeAuthDialog();
      if (!state.auth.token) {
        renderSignedOutState();
      }
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', () => {
      clearSession();
      openAuthDialog();
    });
  }
}

function restoreSession() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userRaw = localStorage.getItem(AUTH_USER_KEY);
  if (token && userRaw) {
    try {
      const user = JSON.parse(userRaw);
      setSession(token, user, { silent: true, skipData: true });
      loadAllData();
      return true;
    } catch (error) {
      console.error('Failed to restore session', error);
      clearSession({ silent: true });
    }
  }
  return false;
}

function init() {
  updateAvatar();
  attachEventListeners();
  const restored = restoreSession();
  if (!restored) {
    clearSession({ silent: true });
    openAuthDialog();
  }
}

init();
