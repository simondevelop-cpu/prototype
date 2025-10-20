import { test, expect } from '@playwright/test';

test.describe('Canadian Insights full-stack smoke test', () => {
  test('core flows remain functional with the redesigned navigation', async ({ page }) => {
    await page.goto('/');

    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes('/api/summary') && response.request().method() === 'GET'
      ),
      page.waitForResponse((response) =>
        response.url().includes('/api/transactions') && response.request().method() === 'GET'
      ),
      page.getByRole('button', { name: 'Demo login' }).click(),
    ]);

    await page.waitForSelector('[data-module="cashflow"] [data-demo="cashflow"]');

    // Dashboard cash flow interactions
    await page.locator('[data-module="cashflow"] [data-demo="cashflow"]').click();
    const chartGroups = page.locator('[data-chart="cashflow"] .chart-bar-group');
    await expect(chartGroups).toHaveCount(3);
    await page.locator('[data-filter="cashflow-timeframe"]').selectOption('6m');
    await expect(chartGroups).toHaveCount(6);
    const expenseBar = page.locator('[data-chart="cashflow"] [data-type="expense"]').first();
    await expenseBar.click();
    await expect(page.locator('[data-list="cashflow-categories"] .breakdown-item')).not.toHaveCount(0);
    await expect(page.locator('[data-table="dashboard-transactions"] tr')).not.toHaveCount(0);
    await expect(page.locator('[data-dashboard-summary]')).toContainText('Expenses');

    // Saving tab modules
    await page.getByRole('button', { name: 'Saving' }).click();
    await page.locator('[data-module="budget"] [data-demo="budget"]').click();
    await expect(page.locator('[data-summary="budget"] .breakdown-item')).toHaveCount(3);
    await expect(page.locator('[data-list="budget"] .budget-item')).not.toHaveCount(0);
    await page.locator('[data-filter="budget-period"]').selectOption('quarterly');
    await expect(page.locator('[data-list="budget"] .budget-item')).not.toHaveCount(0);

    await page.locator('[data-module="savings"] [data-demo="savings"]').click();
    await page.locator('[data-filter="savings-period"]').selectOption('year-to-date');
    await expect(page.locator('[data-list="savings"] .savings-item')).not.toHaveCount(0);

    // Transactions tab workflows
    await page.getByRole('button', { name: 'Transactions' }).click();
    await expect(page.locator('[data-trigger="upload"]')).toBeVisible();
    const transactionRows = page.locator('[data-table="transactions"] tr');
    await expect(transactionRows).not.toHaveCount(0);
    const searchInput = page.locator('[data-input="search"]');
    await searchInput.fill('Rent');
    await expect(transactionRows).not.toHaveCount(0);
    await expect(transactionRows.first().locator('td').nth(1)).toContainText(/Rent/i);
    await searchInput.fill('');
    await page.locator('[data-filter="tx-cashflow"]').selectOption('income');
    await expect(transactionRows).not.toHaveCount(0);
    await page.locator('[data-filter="tx-cashflow"]').selectOption('all');

    const firstCheckbox = page.locator('[data-table="transactions"] tr input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(page.locator('[data-summary="count"]')).toHaveText('1');
    await expect(page.locator('[data-summary="total"]')).not.toHaveText('$0.00');
    await firstCheckbox.uncheck();

    // Insights tab and feedback loop
    await page.getByRole('button', { name: 'Insights' }).click();
    await expect(page.locator('[data-list="subscriptions"] .insight-item')).not.toHaveCount(0);
    await page.locator('[data-list="subscriptions"] button[data-response="useful"]').first().click();
    await expect(page.locator('#toast')).toHaveAttribute('data-state', 'visible');

    // Settings avatar and feedback submission
    await page.getByRole('button', { name: 'Account settings' }).click();
    await page.locator('[data-form="feedback"] textarea').fill('Loving the insights!');
    await page.locator('[data-form="feedback"] button[type="submit"]').click();
    await expect(page.locator('#toast')).toHaveAttribute('data-state', 'visible');
  });
});
