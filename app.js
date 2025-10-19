const tabButtons = document.querySelectorAll('[data-tab-target]');
const panels = document.querySelectorAll('.tab-panel');
const uploadButton = document.querySelector('[data-trigger="upload"]');
const uploadDialog = document.getElementById('upload-dialog');
const toast = document.getElementById('toast');
const avatarInitial = document.querySelector('[data-user-initial]');

const state = {
  token: null,
  user: null,
};

let transactions = [];
let transactionLabels = [];
let transactionCategories = [];
let monthlyMap = new Map();
let monthlySequence = [];

const budgetCache = new Map();
const savingsCache = new Map();
let insightsData = { subscriptions: [], fraud: [], benchmarks: [] };

function updateAvatarInitial() {
  if (state.user && state.user.email) {
    avatarInitial.textContent = state.user.email[0].toUpperCase();
  } else {
    avatarInitial.textContent = 'Log in';
  }
}

updateAvatarInitial();

const currency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value);

const loginForm = document.querySelector('[data-form="login"]');
const loginStatus = document.querySelector('[data-login-status]');
const loginEmailInput = document.querySelector('[data-input="login-email"]');
const loginPasswordInput = document.querySelector('[data-input="login-password"]');
const logoutButton = document.querySelector('[data-action="logout"]');

const onboardingDialog = document.getElementById('onboarding-dialog');
const onboardingSteps = onboardingDialog
  ? Array.from(onboardingDialog.querySelectorAll('[data-onboarding-step]'))
  : [];
const onboardingStatus = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-status]')
  : null;
const onboardingRegisterStatus = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-register-status]')
  : null;
const onboardingLoginForm = onboardingDialog
  ? onboardingDialog.querySelector('[data-form="onboarding-login"]')
  : null;
const onboardingRegisterForm = onboardingDialog
  ? onboardingDialog.querySelector('[data-form="onboarding-register"]')
  : null;
const onboardingLoginEmailInput = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-field="login-email"]')
  : null;
const onboardingLoginPasswordInput = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-field="login-password"]')
  : null;
const onboardingRegisterEmailInput = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-field="register-email"]')
  : null;
const onboardingRegisterPasswordInput = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-field="register-password"]')
  : null;
const onboardingRegisterConfirmInput = onboardingDialog
  ? onboardingDialog.querySelector('[data-onboarding-field="register-confirm"]')
  : null;

function setStatusMessage(element, message, tone = 'info') {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = tone;
}

function clearStatusMessage(element) {
  if (!element) return;
  element.textContent = '';
  delete element.dataset.state;
}

let toastTimeoutId = null;

function hideToast() {
  if (!toast) return;
  toast.dataset.state = 'hidden';
  if (typeof toast.close === 'function') {
    try {
      toast.close();
    } catch (error) {
      console.warn('Failed to close toast dialog', error);
    }
  }
}

function showToast(message, options = {}) {
  if (!toast) return;
  const { duration = 3200 } = options;
  toast.textContent = message;
  toast.dataset.state = 'visible';
  if (typeof toast.show === 'function') {
    try {
      toast.show();
    } catch (error) {
      if (error && error.message && !/already open/i.test(error.message)) {
        console.warn('Unable to display toast', error);
      }
    }
  }
  window.clearTimeout(toastTimeoutId);
  toastTimeoutId = window.setTimeout(() => {
    hideToast();
  }, duration);
}

const monthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short' });
const longMonthFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short', year: 'numeric' });

const createFlowBucket = () => ({
  total: 0,
  signedTotal: 0,
  categories: new Map(),
  transactions: [],
});

const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const timeframeMonths = { '3m': 3, '6m': 6, '12m': 12 };

function rebuildTransactionState(data = []) {
  transactions = data.slice();
  transactionLabels = [...new Set(transactions.map((t) => t.label).filter(Boolean))].sort();
  transactionCategories = [...new Set(transactions.map((t) => t.category).filter(Boolean))].sort();

  monthlyMap = new Map();
  transactions.forEach((tx) => {
    const date = new Date(tx.date);
    if (Number.isNaN(date.getTime())) return;
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
      tx.cashflow === 'income'
        ? monthEntry.income
        : tx.cashflow === 'expense'
        ? monthEntry.expense
        : monthEntry.other;
    const magnitude = Math.abs(Number(tx.amount));
    bucket.total += magnitude;
    bucket.signedTotal += Number(tx.amount);
    bucket.transactions.push(tx.id);
    if (tx.category) {
      bucket.categories.set(tx.category, (bucket.categories.get(tx.category) || 0) + magnitude);
    }
  });

  monthlySequence = Array.from(monthlyMap.values()).sort((a, b) => a.date - b.date);
  dashboardState.monthKey = monthlySequence.length
    ? monthlySequence[monthlySequence.length - 1].key
    : null;
}

function clearSession() {
  state.token = null;
  state.user = null;
  sessionStorage.removeItem('authToken');
  sessionStorage.removeItem('userEmail');
  budgetCache.clear();
  savingsCache.clear();
  insightsData = { subscriptions: [], fraud: [], benchmarks: [] };
  relockModules();
  rebuildTransactionState([]);
  updateAvatarInitial();
  setLoginStatus('Sign in with the test account to load demo data.', 'info');
  populateFilterOptions();
  renderTransactions();
  renderDashboard();
  renderInsightList('[data-list="subscriptions"]', []);
  renderInsightList('[data-list="fraud"]', []);
  renderInsightList('[data-list="benchmarks"]', []);
}

async function fetchWithAuth(url, options = {}) {
  if (!state.token) {
    throw new Error('Not authenticated');
  }
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${state.token}`);
  const config = { ...options, headers };
  return fetch(url, config);
}

async function fetchJsonWithAuth(url, options = {}) {
  const response = await fetchWithAuth(url, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

function setLoginStatus(message, tone = 'info') {
  setStatusMessage(loginStatus, message, tone);
}

async function registerAccount(email, password) {
  const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create account');
  }
  return response.json();
}

async function signIn(email, password) {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Invalid credentials');
  }
  return response.json();
}

async function signOut() {
  if (!state.token) return;
  try {
    await fetchWithAuth('/api/logout', { method: 'POST' });
  } catch (error) {
    console.warn('Failed to revoke session', error);
  }
  clearSession();
  setLoginStatus('Signed out.', 'info');
}

async function startSessionFromCredentials(email, password, options = {}) {
  const { silentLoad = false } = options;
  const result = await signIn(email, password);
  state.token = result.token;
  state.user = result.user;
  budgetCache.clear();
  savingsCache.clear();
  insightsData = { subscriptions: [], fraud: [], benchmarks: [] };
  sessionStorage.setItem('authToken', state.token);
  sessionStorage.setItem('userEmail', state.user.email);
  updateAvatarInitial();
  await loadAllData({ silent: silentLoad });
  return result;
}

let activeOnboardingStep = 'intro';

function showOnboardingStep(step) {
  if (!onboardingDialog) return;
  activeOnboardingStep = step;
  onboardingSteps.forEach((panel) => {
    const isActive = panel.dataset.onboardingStep === step;
    panel.hidden = !isActive;
  });
}

function resetOnboardingForms() {
  clearStatusMessage(onboardingStatus);
  clearStatusMessage(onboardingRegisterStatus);
  if (onboardingLoginForm) {
    onboardingLoginForm.reset();
  }
  if (onboardingRegisterForm) {
    onboardingRegisterForm.reset();
  }
  if (onboardingLoginEmailInput) {
    onboardingLoginEmailInput.value = onboardingLoginEmailInput.dataset.defaultValue || 'test@gmail.com';
  }
  if (onboardingLoginPasswordInput) {
    onboardingLoginPasswordInput.value = onboardingLoginPasswordInput.dataset.defaultValue || 'password';
  }
}

function openOnboarding(step = 'intro') {
  if (!onboardingDialog) return;
  resetOnboardingForms();
  showOnboardingStep(step);
  onboardingDialog.showModal();
}

function closeOnboarding() {
  if (!onboardingDialog || !onboardingDialog.open) return;
  onboardingDialog.close();
  activeOnboardingStep = 'intro';
}

async function loadTransactionsData() {
  const data = await fetchJsonWithAuth('/api/transactions');
  rebuildTransactionState(data.transactions || []);
  if (Array.isArray(data.categories) && data.categories.length) {
    transactionCategories = data.categories;
  }
  if (Array.isArray(data.labels) && data.labels.length) {
    transactionLabels = data.labels;
  }
  populateFilterOptions();
  renderTransactions();
  renderDashboard();
}

async function loadInsightsData(cohort = 'all') {
  const insights = await fetchJsonWithAuth(`/api/insights?cohort=${encodeURIComponent(cohort)}`);
  insightsData = insights;
  renderInsightList('[data-list="subscriptions"]', insights.subscriptions);
  renderInsightList('[data-list="fraud"]', insights.fraud);
  renderInsightList('[data-list="benchmarks"]', insights.benchmarks);
}

async function loadAllData(options = {}) {
  const { silent = false } = options;
  if (!state.token) return;
  try {
    await loadTransactionsData();
    await Promise.all([populateBudget('monthly'), populateSavings('last-month'), loadInsightsData()]);
    unlockAuthenticatedModules();
    if (!silent) {
      setLoginStatus('Your dashboard is ready.', 'info');
      showToast('Account data loaded successfully.');
    }
  } catch (error) {
    console.error('Failed to load account data', error);
    if (!silent) {
      setLoginStatus('Unable to load account data. Please try again.', 'error');
      showToast('We could not refresh your data. Please try again.');
    }
  }
}

function restoreSession() {
  const storedToken = sessionStorage.getItem('authToken');
  const storedEmail = sessionStorage.getItem('userEmail');
  if (storedToken && storedEmail) {
    state.token = storedToken;
    state.user = { email: storedEmail };
    updateAvatarInitial();
    void loadAllData({ silent: true }).catch(() => {
      clearSession();
    });
  }
}

async function handleLogin(event) {
  event.preventDefault();
  if (!loginEmailInput || !loginPasswordInput) return;
  const email = loginEmailInput.value.trim();
  const password = loginPasswordInput.value;
  if (!email || !password) {
    setLoginStatus('Please provide an email and password.', 'error');
    return;
  }

  try {
    setLoginStatus('Signing you in…', 'info');
    await startSessionFromCredentials(email, password);
    setLoginStatus('Signed in successfully.', 'info');
  } catch (error) {
    console.error('Login failed', error);
    setLoginStatus(error.message || 'Failed to sign in.', 'error');
  }
}

function handleLogoutClick() {
  signOut();
}

const dashboardState = {
  timeframe: '3m',
  type: 'income',
  monthKey: null,
};

const cashflowChartContainer = document.querySelector('[data-chart="cashflow"]');
const cashflowCategoriesList = document.querySelector('[data-list="cashflow-categories"]');
const cashflowTimeframeSelect = document.querySelector('[data-filter="cashflow-timeframe"]');
const dashboardTransactionsTable = document.querySelector('[data-table="dashboard-transactions"]');
const dashboardSummaryLabel = document.querySelector('[data-dashboard-summary]');
const categorisationSummaryLabel = document.querySelector('[data-categorisation-summary]');

function switchTab(targetId) {
  tabButtons.forEach((tab) => tab.classList.toggle('active', tab.dataset.tabTarget === targetId));
  panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
}

tabButtons.forEach((tab) => {
  tab.addEventListener('click', (event) => {
    const targetId = tab.dataset.tabTarget;
    if (!targetId) return;
    if (tab.classList.contains('avatar-button') && !state.user) {
      event.preventDefault();
      openOnboarding('intro');
      return;
    }
    switchTab(targetId);
  });
});

if (uploadButton) {
  uploadButton.addEventListener('click', () => {
    uploadDialog.showModal();
  });
}

function updateCustomRangeControls() {
  if (!customRangeContainer || !customStartSelect || !customEndSelect) return;
  const isCustom = dashboardState.timeframe === 'custom';
  customRangeContainer.hidden = !isCustom;
  const hasMonths = monthlySequence.length > 0;
  customStartSelect.disabled = !hasMonths || !isCustom;
  customEndSelect.disabled = !hasMonths || !isCustom;
  if (!hasMonths) {
    return;
  }
  customStartSelect.value = dashboardState.customRange.start || '';
  customEndSelect.value = dashboardState.customRange.end || '';
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

function unlockModule(target, options = {}) {
  const { silent = false } = options;
  if (!target) return;
  const module =
    target.classList && target.classList.contains('module') ? target : target.closest('.module');
  if (!module) return;
  module.classList.remove('locked');
  const overlay = module.querySelector('.lock-overlay');
  if (overlay) {
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
  }
}

document.querySelectorAll('[data-action="open-onboarding"]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    const targetStep = button.dataset.onboardingTarget || 'intro';
    openOnboarding(targetStep);
  });
});

if (toast) {
  toast.addEventListener('click', () => {
    window.clearTimeout(toastTimeoutId);
    hideToast();
  });
}

if (onboardingDialog) {
  onboardingDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeOnboarding();
  });

  onboardingSteps.forEach((panel) => {
    panel
      .querySelectorAll('[data-onboarding-next]')
      .forEach((nextButton) =>
        nextButton.addEventListener('click', () => {
          showOnboardingStep(nextButton.dataset.onboardingNext);
        })
      );
    panel
      .querySelectorAll('[data-onboarding-back]')
      .forEach((backButton) =>
        backButton.addEventListener('click', () => {
          const target = backButton.dataset.onboardingBack || 'intro';
          showOnboardingStep(target);
        })
      );
  });
}

document.querySelectorAll('[data-action="close-onboarding"]').forEach((button) => {
  button.addEventListener('click', (event) => {
    event.preventDefault();
    closeOnboarding();
  });
});

function unlockAuthenticatedModules() {
  document.querySelectorAll('[data-module].locked').forEach((module) => {
    unlockModule(module, { silent: true });
  });
}

function relockModules() {
  document.querySelectorAll('[data-module] .lock-overlay').forEach((overlay) => {
    overlay.hidden = false;
    overlay.removeAttribute('aria-hidden');
    const module = overlay.closest('.module');
    if (module) {
      module.classList.add('locked');
    }
  });
}

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
    row.dataset.type = dashboardState.type;
    const width = Math.min(100, (item.value / maxCategory) * 100);
    row.innerHTML = `
      <div>
        <strong>${item.name}</strong>
        <div class="progress"><span data-type="${dashboardState.type}" style="width:${width}%"></span></div>
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
  const month = dashboardState.monthKey ? monthlyMap.get(dashboardState.monthKey) : null;
  const label = dashboardState.type === 'income' ? 'Income' : 'Expenses';
  const transactionsMessage = month
    ? `${label} for ${month.longLabel}`
    : 'Select a bar to explore transactions.';
  const categorisationMessage = month
    ? `${label} categories for ${month.longLabel}`
    : 'Select a bar to see category detail.';

  if (dashboardSummaryLabel) {
    dashboardSummaryLabel.textContent = transactionsMessage;
  }

  if (categorisationSummaryLabel) {
    categorisationSummaryLabel.textContent = categorisationMessage;
  }
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

async function populateBudget(period) {
  const summaryContainer = document.querySelector('[data-summary="budget"]');
  const list = document.querySelector('[data-list="budget"]');
  const monthSelect = document.querySelector('[data-filter="budget-month"]');
  if (!summaryContainer || !list || !monthSelect) return;

  if (!state.token) {
    monthSelect.innerHTML = '<option>Sign in to load budget insights</option>';
    summaryContainer.innerHTML =
      '<p class="feedback-note">Sign in to calculate budgets from your real spending.</p>';
    list.innerHTML = '';
    return;
  }

  try {
    if (!budgetCache.has(period)) {
      const data = await fetchJsonWithAuth(`/api/budget?period=${encodeURIComponent(period)}`);
      budgetCache.set(period, data);
    }
    const dataset = budgetCache.get(period);
    const months = dataset.months || [];
    monthSelect.innerHTML = months
      .map((month, index) => `<option value="${index}">${month}</option>`)
      .join('');

    const heading = period === 'monthly' ? 'month' : 'period';
    summaryContainer.innerHTML = `
      <div class="breakdown-item">
        <div>
          <strong>Budget</strong>
          <p class="feedback-note">Auto-set from your last three months</p>
        </div>
        <span>${currency(dataset.summary.budget)}</span>
      </div>
      <div class="breakdown-item">
        <div>
          <strong>Spent this ${heading}</strong>
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
    (dataset.categories || [])
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
    monthSelect.innerHTML = '<option>Error loading data</option>';
    summaryContainer.innerHTML =
      '<p class="feedback-note">Unable to load budget insights right now.</p>';
    list.innerHTML = '';
  }
}

async function populateSavings(view) {
  const summaryContainer = document.querySelector('[data-summary="savings"]');
  const list = document.querySelector('[data-list="savings"]');
  if (!summaryContainer || !list) return;

  if (!state.token) {
    summaryContainer.innerHTML =
      '<p class="feedback-note">Sign in to track your personalised savings progress.</p>';
    list.innerHTML = '';
    return;
  }

  try {
    if (!savingsCache.has(view)) {
      const data = await fetchJsonWithAuth(`/api/savings?range=${encodeURIComponent(view)}`);
      savingsCache.set(view, data);
    }
    const dataset = savingsCache.get(view);

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
    (dataset.goals || []).forEach((goal) => {
      const pct = goal.target ? Math.min(100, (goal.contributed / goal.target) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'savings-item';
      row.innerHTML = `
        <div>
          <strong>${goal.name}</strong>
          <div class="feedback-note">${goal.priority || 'Goal'} priority</div>
          <div class="progress"><span style="width:${pct}%"></span></div>
        </div>
        <span>${Math.round(pct)}%</span>
      `;
      list.appendChild(row);
    });
  } catch (error) {
    console.error('Failed to load savings', error);
    summaryContainer.innerHTML =
      '<p class="feedback-note">Unable to load savings insights right now.</p>';
    list.innerHTML = '';
  }
}

const budgetPeriodSelect = document.querySelector('[data-filter="budget-period"]');
const budgetMonthSelect = document.querySelector('[data-filter="budget-month"]');

if (budgetPeriodSelect) {
  budgetPeriodSelect.addEventListener('change', () => {
    void populateBudget(budgetPeriodSelect.value);
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
    void populateSavings(savingsPeriodSelect.value);
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
  if (filterCategory) {
    const selected = filterCategory.value;
    filterCategory.innerHTML = '<option value="all">All categories</option>';
    transactionCategories.forEach((category) => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      filterCategory.appendChild(option);
    });
    if (transactionCategories.includes(selected)) {
      filterCategory.value = selected;
    }
  }

  if (filterLabel) {
    const selected = filterLabel.value;
    filterLabel.innerHTML = '<option value="all">All labels</option>';
    transactionLabels.forEach((label) => {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      filterLabel.appendChild(option);
    });
    if (transactionLabels.includes(selected)) {
      filterLabel.value = selected;
    }
  }
}

function renderTransactions() {
  if (!transactionTableBody) return;
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
  if (!filtered.length) {
    const row = document.createElement('tr');
    const message = state.token
      ? 'No transactions match your filters.'
      : 'Sign in to view and manage your transactions.';
    row.innerHTML = `<td colspan="8" class="empty-state">${message}</td>`;
    transactionTableBody.appendChild(row);
  } else {
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
  }

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

[searchInput, filterCashflow, filterAccount, filterCategory, filterLabel]
  .filter(Boolean)
  .forEach((control) => {
    control.addEventListener('input', renderTransactions);
  });

const insightFeedback = {
  useful: 0,
  maybe: 0,
  'not-useful': 0,
};

function renderInsightList(containerSelector, items) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = '';
  if (!items || !items.length) {
    const empty = document.createElement('li');
    empty.className = 'insight-item';
    empty.innerHTML = `
      <div>
        <p class="feedback-note">No insights yet. Sign in and upload transactions to unlock recommendations.</p>
      </div>
    `;
    container.appendChild(empty);
    return;
  }

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
    if (!state.token) {
      renderInsightList('[data-list="benchmarks"]', []);
      return;
    }
    void loadInsightsData(benchmarkSelect.value).catch((error) => {
      console.error('Failed to update benchmark insights', error);
      setLoginStatus('Unable to refresh insights right now.', 'error');
    });
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

if (onboardingLoginForm) {
  onboardingLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!onboardingLoginEmailInput || !onboardingLoginPasswordInput) {
      return;
    }
    const email = onboardingLoginEmailInput.value.trim();
    const password = onboardingLoginPasswordInput.value;
    if (!email || !password) {
      setStatusMessage(onboardingStatus, 'Enter an email and password to continue.', 'error');
      return;
    }
    setStatusMessage(onboardingStatus, 'Signing you in…', 'info');
    setLoginStatus('Signing you in…', 'info');
    try {
      await startSessionFromCredentials(email, password);
      setStatusMessage(onboardingStatus, 'Signed in! Loading your dashboards…', 'info');
      closeOnboarding();
    } catch (error) {
      console.error('Onboarding login failed', error);
      setStatusMessage(onboardingStatus, error.message || 'Failed to sign in.', 'error');
    }
  });
}

if (onboardingRegisterForm) {
  onboardingRegisterForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (
      !onboardingRegisterEmailInput ||
      !onboardingRegisterPasswordInput ||
      !onboardingRegisterConfirmInput
    ) {
      return;
    }
    const email = onboardingRegisterEmailInput.value.trim();
    const password = onboardingRegisterPasswordInput.value;
    const confirm = onboardingRegisterConfirmInput.value;
    if (!email || !password) {
      setStatusMessage(onboardingRegisterStatus, 'Enter an email and password to continue.', 'error');
      return;
    }
    if (password !== confirm) {
      setStatusMessage(onboardingRegisterStatus, 'Passwords must match.', 'error');
      return;
    }
    setStatusMessage(onboardingRegisterStatus, 'Creating your account…', 'info');
    try {
      await registerAccount(email, password);
      setStatusMessage(onboardingRegisterStatus, 'Account created! Signing you in…', 'info');
      setLoginStatus('Signing you in…', 'info');
      await startSessionFromCredentials(email, password);
      closeOnboarding();
    } catch (error) {
      console.error('Account creation failed', error);
      setStatusMessage(onboardingRegisterStatus, error.message || 'Failed to create account.', 'error');
    }
  });
}

if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

if (logoutButton) {
  logoutButton.addEventListener('click', handleLogoutClick);
}

function init() {
  setLoginStatus('Sign in with the test account to load demo data.', 'info');
  renderDashboard();
  populateFilterOptions();
  renderTransactions();
  renderInsightList('[data-list="subscriptions"]', insightsData.subscriptions);
  renderInsightList('[data-list="fraud"]', insightsData.fraud);
  renderInsightList('[data-list="benchmarks"]', insightsData.benchmarks);
  void populateBudget('monthly');
  void populateSavings('last-month');
  restoreSession();
}

init();
