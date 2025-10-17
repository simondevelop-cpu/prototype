import { test, expect } from '@playwright/test';

const cashflowModule = '[data-module="cashflow-chart"]';
const budgetModule = '[data-module="budget"]';
const savingsModule = '[data-module="savings"]';

test.describe('Canadian Insights full-stack smoke test', () => {
  test('core flows remain functional with live data', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator(`${cashflowModule} .chart-bar`)).toHaveCount(3);
    await page.locator('[data-filter="cashflow-timeframe"]').selectOption('6m');
    await expect(page.locator(`${cashflowModule} .chart-bar`)).toHaveCount(6);
    await page.locator('[data-filter="cashflow-type"]').selectOption('expense');
    await expect(page.locator('[data-chart="cashflow"] .chart-bar span[data-type="expense"]')).toHaveCount(6);
    await expect(page.locator('[data-list="cashflow-categories"] .breakdown-item')).not.toHaveCount(0);

    await expect(page.locator(`${budgetModule} .lock-overlay`)).toHaveClass(/hidden/);
    await expect(page.locator('[data-summary="budget"] .breakdown-item')).toHaveCount(3);
    await expect(page.locator('[data-list="budget"] .budget-item')).not.toHaveCount(0);
    await page.locator('[data-filter="budget-period"]').selectOption('quarterly');
    await expect(page.locator('[data-list="budget"] .budget-item')).not.toHaveCount(0);

    await expect(page.locator(`${savingsModule} .lock-overlay`)).toHaveClass(/hidden/);
    await page.locator('[data-filter="savings-period"]').selectOption('year-to-date');
    await expect(page.locator('[data-list="savings"] .goal-item')).not.toHaveCount(0);

    await page.getByRole('button', { name: 'Categorise transactions' }).click();
    await expect(page.locator('[data-table="transactions"] tr')).toHaveCount(10);
    const searchInput = page.locator('[data-input="search"]');
    await searchInput.fill('Rent');
    await expect(page.locator('[data-table="transactions"] tr')).toHaveCount(1);
    await expect(page.locator('[data-table="transactions"] tr td').nth(1)).toContainText('Rent');
    await searchInput.fill('');
    await page.locator('[data-filter="tx-cashflow"]').selectOption('income');
    await expect(page.locator('[data-table="transactions"] tr')).toHaveCount(1);
    await page.locator('[data-filter="tx-cashflow"]').selectOption('all');

    const firstCheckbox = page.locator('[data-table="transactions"] tr input[type="checkbox"]').first();
    await firstCheckbox.check();
    await expect(page.locator('[data-summary="count"]')).toHaveText('1');
    await expect(page.locator('[data-summary="total"]')).not.toHaveText('$0.00');
    await firstCheckbox.uncheck();

    await page.getByRole('button', { name: 'Insight modules' }).click();
    await expect(page.locator('[data-list="subscriptions"] .insight-item')).not.toHaveCount(0);
    await page.locator('[data-list="subscriptions"] button[data-response="useful"]').first().click();
    await expect(page.locator('#toast')).toHaveAttribute('data-state', 'visible');

    await page.getByRole('button', { name: 'Account settings' }).click();
    await page.locator('[data-form="feedback"] textarea').fill('Loving the insights!');
    await page.locator('[data-form="feedback"] button[type="submit"]').click();
    await expect(page.locator('#toast')).toHaveAttribute('data-state', 'visible');
  });
});
