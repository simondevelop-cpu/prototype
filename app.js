const currency = (value) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );

const state = {
  cashflowWindow: '3m',
  cashflowType: 'all',
  budgetPeriod: 'monthly',
  savingsRange: 'last-month',
  benchmarkCohort: 'all',
  transactions: [],
  categories: [],
  labels: [],
  transactionFilters: {
    search: '',
    cashflow: 'all',
    account: 'all',
    category: 'all',
    label: 'all',
  },
  insights: { subscriptions: [], fraud: [], benchmarks: [] },
  modulesUnlocked: new Set(),
};

const selectors = {
  tabs: document.querySelectorAll('.tab-button'),
  panels: document.querySelectorAll('.tab-panel'),
  uploadButton: document.querySelector('.cta-button'),
  uploadDialog: document.getElementById('upload-dialog'),
  uploadForm: document.querySelector('[data-form="upload"]'),
  uploadInput: document.querySelector('[data-form="upload"] input[type="file"]'),
  uploadCancel: document.querySelector('[data-action="cancel"]'),
  toast: document.getElementById('toast'),
  cashflowTimeframe: document.querySelector('[data-filter="cashflow-timeframe"]'),
  cashflowType: document.querySelector('[data-filter="cashflow-type"]'),
  budgetPeriod: document.querySelector('[data-filter="budget-period"]'),
  budgetMonth: document.querySelector('[data-filter="budget-month"]'),
  savingsPeriod: document.querySelector('[data-filter="savings-period"]'),
  searchInput: document.querySelector('[data-input="search"]'),
  filterCashflow: document.querySelector('[data-filter="tx-cashflow"]'),
  filterAccount: document.querySelector('[data-filter="tx-account"]'),
  filterCategory: document.querySelector('[data-filter="tx-category"]'),
  filterLabel: document.querySelector('[data-filter="tx-label"]'),
  transactionTable: document.querySelector('[data-table="transactions"]'),
  transactionSummaryCount: document.querySelector('[data-summary="count"]'),
  transactionSummaryTotal: document.querySelector('[data-summary="total"]'),
  benchmarkSelect: document.querySelector('[data-filter="benchmark-cohort"]'),
  feedbackForm: document.querySelector('[data-form="feedback"]'),
};

function showToast(message) {
  if (!selectors.toast) return;
  selectors.toast.textContent = message;
  selectors.toast.dataset.state = 'visible';
  setTimeout(() => {
    selectors.toast.dataset.state = 'hidden';
  }, 3000);
}

function switchTab(targetId) {
  selectors.tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === targetId));
  selectors.panels.forEach((panel) => panel.classList.toggle('active', panel.id === targetId));
}

selectors.tabs.forEach((tab) => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function mapDemoToModule(demo) {
  if (demo === 'cashflow') return 'cashflow-chart';
  return demo;
}

function unlockModule(moduleName, { auto = false } = {}) {
  const target = document.querySelector(`[data-module="${moduleName}"]`);
  if (!target || state.modulesUnlocked.has(moduleName)) return;
  const overlay = target.querySelector('.lock-overlay');
  if (overlay) overlay.classList.add('hidden');
  state.modulesUnlocked.add(moduleName);
  if (!auto) {
    showToast('Sample data unlocked. Upload statements to make this yours.');
  }
}

document.querySelectorAll('.unlock-button').forEach((button) => {
  button.addEventListener('click', () => {
    const moduleName = mapDemoToModule(button.dataset.demo);
    unlockModule(moduleName);
    if (moduleName === 'cashflow-chart') {
      loadCashflow();
    }
    if (moduleName === 'budget') {
      loadBudget();
    }
    if (moduleName === 'savings') {
      loadSavings();
    }
  });
});

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || response.statusText);
  }
  return response.json();
}

function renderCashflow(data) {
  const moduleName = 'cashflow-chart';
  unlockModule(moduleName, { auto: true });
  const chartContainer = document.querySelector('[data-chart="cashflow"]');
  const breakdownContainer = document.querySelector('[data-list="cashflow-categories"]');
  if (!chartContainer || !breakdownContainer) return;

  chartContainer.innerHTML = '';
  const type = state.cashflowType;
  const months = data.months || [];

  months.forEach((label, index) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar';

    const values = [];
    if (type === 'all' || type === 'income') values.push({ type: 'income', amount: data.income[index] || 0 });
    if (type === 'all' || type === 'expense') values.push({ type: 'expense', amount: data.expense[index] || 0 });
    if (type === 'all' || type === 'other') values.push({ type: 'other', amount: data.other[index] || 0 });

    const maxValue = Math.max(...values.map((item) => item.amount), 1);

    values.forEach((value) => {
      const segment = document.createElement('span');
      segment.dataset.type = value.type;
      segment.textContent = currency(value.amount);
      segment.style.height = `${Math.max(30, (value.amount / maxValue) * 120)}px`;
      bar.appendChild(segment);
    });

    const caption = document.createElement('small');
    caption.textContent = label;
    bar.appendChild(caption);
    chartContainer.appendChild(bar);
  });

  breakdownContainer.innerHTML = '';
  const categories = (data.categories || []).slice().sort((a, b) => b.value - a.value);
  const max = categories[0] ? categories[0].value : 1;
  categories.forEach((category) => {
    const row = document.createElement('div');
    row.className = 'breakdown-item';
    const percentage = Math.min(100, (category.value / max) * 100);
    row.innerHTML = `
      <div>
        <strong>${category.name}</strong>
        <div class="progress"><span style="width:${percentage}%"></span></div>
      </div>
      <span>${currency(category.value)}</span>
    `;
    breakdownContainer.appendChild(row);
  });
}

function renderBudget(data) {
  unlockModule('budget', { auto: true });
  const summaryContainer = document.querySelector('[data-summary="budget"]');
  const listContainer = document.querySelector('[data-list="budget"]');
  if (!summaryContainer || !listContainer) return;

  selectors.budgetMonth.innerHTML = data.months
    .map((month, index) => `<option value="${index}">${month}</option>`)
    .join('');

  summaryContainer.innerHTML = `
    <div class="breakdown-item">
      <div>
        <strong>Budget</strong>
        <p class="feedback-note">Auto-set from your recent trend</p>
      </div>
      <span>${currency(data.summary.budget)}</span>
    </div>
    <div class="breakdown-item">
      <div>
        <strong>Spent this ${state.budgetPeriod === 'monthly' ? 'month' : 'period'}</strong>
      </div>
      <span>${currency(data.summary.spent)}</span>
    </div>
    <div class="breakdown-item">
      <div>
        <strong>Savings</strong>
      </div>
      <span>${currency(data.summary.saved)}</span>
    </div>
  `;

  listContainer.innerHTML = '';
  data.categories
    .slice()
    .sort((a, b) => b.target - a.target)
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
      listContainer.appendChild(row);
    });
}

function renderSavings(data) {
  unlockModule('savings', { auto: true });
  const summaryContainer = document.querySelector('[data-summary="savings"]');
  const goalsContainer = document.querySelector('[data-list="savings"]');
  if (!summaryContainer || !goalsContainer) return;

  summaryContainer.innerHTML = `
    <div class="breakdown-item">
      <div>
        <strong>${data.summary.label}</strong>
        <p class="feedback-note">RRSP, TFSA and custom goals combined.</p>
      </div>
      <span>${currency(data.summary.last)}</span>
    </div>
    <div class="breakdown-item">
      <div>
        <strong>Total saved</strong>
      </div>
      <span>${currency(data.summary.cumulative)}</span>
    </div>
  `;

  goalsContainer.innerHTML = '';
  data.goals.forEach((goal) => {
    const pct = goal.target ? Math.min(100, (goal.contributed / goal.target) * 100) : 0;
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
    goalsContainer.appendChild(row);
  });
}

function populateTransactionFilters() {
  if (!state.categories.includes(state.transactionFilters.category)) {
    state.transactionFilters.category = 'all';
  }
  if (!state.labels.includes(state.transactionFilters.label)) {
    state.transactionFilters.label = 'all';
  }

  const categoryOptions = ['<option value="all">All categories</option>']
    .concat(state.categories.map((category) => `<option value="${category}">${category}</option>`))
    .join('');
  selectors.filterCategory.innerHTML = categoryOptions;
  selectors.filterCategory.value = state.transactionFilters.category;

  const labelOptions = ['<option value="all">All labels</option>']
    .concat(state.labels.map((label) => `<option value="${label}">${label}</option>`))
    .join('');
  selectors.filterLabel.innerHTML = labelOptions;
  selectors.filterLabel.value = state.transactionFilters.label;
}

function getTransactionFilters() {
  return state.transactionFilters;
}

function renderTransactions() {
  const filters = getTransactionFilters();
  const rows = state.transactions.filter((tx) => {
    const term = filters.search.toLowerCase();
    const matchesSearch =
      !term ||
      tx.description.toLowerCase().includes(term) ||
      tx.category.toLowerCase().includes(term) ||
      tx.label.toLowerCase().includes(term) ||
      `${Math.abs(tx.amount)}`.includes(term);
    const matchesFlow = filters.cashflow === 'all' || tx.cashflow === filters.cashflow;
    const matchesAccount = filters.account === 'all' || tx.account === filters.account;
    const matchesCategory = filters.category === 'all' || tx.category === filters.category;
    const matchesLabel = filters.label === 'all' || tx.label === filters.label;
    return matchesSearch && matchesFlow && matchesAccount && matchesCategory && matchesLabel;
  });

  selectors.transactionTable.innerHTML = '';
  rows.forEach((tx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="checkbox" data-tx="${tx.id}" /></td>
      <td>${tx.description}</td>
      <td>${new Date(tx.date).toLocaleDateString('en-CA')}</td>
      <td>${tx.cashflow}</td>
      <td>${tx.account}</td>
      <td>${tx.category}</td>
      <td>${tx.label || '—'}</td>
      <td class="numeric">${currency(tx.amount)}</td>
    `;
    selectors.transactionTable.appendChild(tr);
  });

  bindTransactionSelection();
  updateTransactionSummary();
}

function bindTransactionSelection() {
  selectors.transactionTable.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener('change', updateTransactionSummary);
  });
}

function updateTransactionSummary() {
  const checkboxes = selectors.transactionTable.querySelectorAll('input[type="checkbox"]');
  let count = 0;
  let total = 0;
  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) {
      const tx = state.transactions.find((item) => item.id === Number(checkbox.dataset.tx));
      if (tx) {
        count += 1;
        total += tx.amount;
      }
    }
  });
  selectors.transactionSummaryCount.textContent = count;
  selectors.transactionSummaryTotal.textContent = currency(total);
}

function renderInsightList(containerSelector, items) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
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
        <button type="button" data-response="useful">Insightful</button>
        <button type="button" data-response="maybe">Maybe later</button>
        <button type="button" data-response="not-useful">Not relevant</button>
      </div>
      <div class="feedback-note" data-feedback></div>
    `;
    container.appendChild(li);
  });
}

async function handleInsightFeedback(event) {
  const button = event.target.closest('button[data-response]');
  if (!button) return;
  const card = button.closest('.insight-card');
  if (!card) return;
  const type = card.dataset.insight;
  const item = button.closest('.insight-item');
  const title = item?.querySelector('strong')?.textContent || '';
  const response = button.dataset.response;
  try {
    await fetchJSON(`/api/insights/${type}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, response }),
    });
    const feedbackNode = item.querySelector('[data-feedback]');
    if (feedbackNode) {
      const message =
        response === 'useful'
          ? 'Thanks! We will prioritise more insights like this.'
          : response === 'maybe'
          ? 'Got it. We will resurface this later.'
          : 'Understood. Insights like this will appear less often.';
      feedbackNode.textContent = message;
    }
    showToast('Feedback captured.');
  } catch (error) {
    showToast('Unable to capture feedback right now.');
    console.error(error);
  }
}

document.querySelectorAll('.insight-card').forEach((card) => {
  card.addEventListener('click', handleInsightFeedback);
});

async function loadCashflow() {
  try {
    const data = await fetchJSON(`/api/summary?window=${state.cashflowWindow}`);
    renderCashflow(data);
  } catch (error) {
    console.error(error);
    showToast('Unable to load cash flow data.');
  }
}

async function loadBudget() {
  try {
    const data = await fetchJSON(`/api/budget?period=${state.budgetPeriod}`);
    renderBudget(data);
  } catch (error) {
    console.error(error);
    showToast('Unable to load budget summary.');
  }
}

async function loadSavings() {
  try {
    const data = await fetchJSON(`/api/savings?range=${state.savingsRange}`);
    renderSavings(data);
  } catch (error) {
    console.error(error);
    showToast('Unable to load savings insights.');
  }
}

async function loadTransactions() {
  try {
    const params = new URLSearchParams();
    params.set('limit', '500');
    const data = await fetchJSON(`/api/transactions?${params.toString()}`);
    state.transactions = data.transactions || [];
    state.categories = data.categories || [];
    state.labels = data.labels || [];
    populateTransactionFilters();
    renderTransactions();
  } catch (error) {
    console.error(error);
    showToast('Unable to load transactions.');
  }
}

async function loadInsights() {
  try {
    const data = await fetchJSON(`/api/insights?cohort=${state.benchmarkCohort}`);
    state.insights = data;
    renderInsightList('[data-list="subscriptions"]', data.subscriptions || []);
    renderInsightList('[data-list="fraud"]', data.fraud || []);
    renderInsightList('[data-list="benchmarks"]', data.benchmarks || []);
  } catch (error) {
    console.error(error);
    showToast('Unable to load insights right now.');
  }
}

async function refreshAllData() {
  await loadTransactions();
  await Promise.all([loadCashflow(), loadBudget(), loadSavings(), loadInsights()]);
}

selectors.cashflowTimeframe.addEventListener('change', (event) => {
  state.cashflowWindow = event.target.value;
  loadCashflow();
});

selectors.cashflowType.addEventListener('change', (event) => {
  state.cashflowType = event.target.value;
  loadCashflow();
});

selectors.budgetPeriod.addEventListener('change', (event) => {
  state.budgetPeriod = event.target.value;
  loadBudget();
});

selectors.budgetMonth.addEventListener('change', () => {
  showToast(`Viewing ${selectors.budgetMonth.selectedOptions[0]?.text || 'current'} budget.`);
});

selectors.savingsPeriod.addEventListener('change', (event) => {
  state.savingsRange = event.target.value;
  loadSavings();
});

selectors.searchInput.addEventListener('input', (event) => {
  getTransactionFilters().search = event.target.value;
  renderTransactions();
});

selectors.filterCashflow.addEventListener('change', (event) => {
  getTransactionFilters().cashflow = event.target.value;
  renderTransactions();
});

selectors.filterAccount.addEventListener('change', (event) => {
  getTransactionFilters().account = event.target.value;
  renderTransactions();
});

selectors.filterCategory.addEventListener('change', (event) => {
  getTransactionFilters().category = event.target.value;
  renderTransactions();
});

selectors.filterLabel.addEventListener('change', (event) => {
  getTransactionFilters().label = event.target.value;
  renderTransactions();
});

selectors.benchmarkSelect.addEventListener('change', async (event) => {
  state.benchmarkCohort = event.target.value;
  await loadInsights();
});

selectors.uploadButton.addEventListener('click', () => {
  selectors.uploadDialog.showModal();
});

selectors.uploadCancel.addEventListener('click', () => {
  selectors.uploadForm.reset();
  selectors.uploadDialog.close();
});

selectors.uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const files = Array.from(selectors.uploadInput.files || []);
  if (!files.length) {
    showToast('Select at least one CSV file to upload.');
    return;
  }
  const formData = new FormData();
  files.forEach((file) => formData.append('statements', file));
  try {
    const result = await fetchJSON('/api/upload', { method: 'POST', body: formData });
    const total = (result.summary || []).reduce((sum, item) => sum + (item.inserted || 0), 0);
    showToast(`Upload complete. ${total} transactions added.`);
    selectors.uploadForm.reset();
    selectors.uploadDialog.close();
    state.modulesUnlocked.delete('cashflow-chart');
    state.modulesUnlocked.delete('budget');
    state.modulesUnlocked.delete('savings');
    await refreshAllData();
  } catch (error) {
    console.error(error);
    showToast('Upload failed. Check your files and try again.');
  }
});

if (selectors.feedbackForm) {
  selectors.feedbackForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(selectors.feedbackForm);
    const payload = {};
    for (const [key, value] of formData.entries()) {
      if (payload[key]) {
        if (Array.isArray(payload[key])) {
          payload[key].push(value);
        } else {
          payload[key] = [payload[key], value];
        }
      } else {
        payload[key] = value;
      }
    }
    try {
      await fetchJSON('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      selectors.feedbackForm.reset();
      showToast('Thanks for the feedback—our team will review it.');
    } catch (error) {
      console.error(error);
      showToast('Unable to submit feedback right now.');
    }
  });
}

refreshAllData();
