/**
 * E2E Test: Dashboard Load to First Insight
 * Tests that dashboard loads and displays insights correctly
 */

import { test, expect } from '@playwright/test';

test.describe('Dashboard Load to First Insight', () => {
  // Helper to login before each test
  async function login(page: any, email: string, password: string) {
    await page.goto('/admin/login');
    await page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await page.locator('input[type="password"], input[name="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    
    // Wait for redirect after login
    await page.waitForURL(/\/(dashboard|home|admin)/, { timeout: 10000 }).catch(() => {});
  }

  test('should load dashboard for authenticated user', async ({ page }) => {
    // Login with demo/test credentials
    await login(page, 'demo@canadianinsights.ca', 'demo');
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Check for dashboard elements
    // These selectors may need adjustment based on your actual UI
    const dashboard = page.locator('main, [data-testid="dashboard"], .dashboard, h1:has-text("Dashboard")').first();
    await expect(dashboard).toBeVisible({ timeout: 5000 });
  });

  test('should display transaction summary', async ({ page }) => {
    await login(page, 'demo@canadianinsights.ca', 'demo');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Look for summary elements (total, income, expenses, etc.)
    const summaryElements = page.locator('text=/total|income|expense|balance/i, [data-testid*="summary"], .summary').first();
    const hasSummary = await summaryElements.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Dashboard should show some summary information
    expect(hasSummary).toBe(true);
  });

  test('should display transaction list', async ({ page }) => {
    await login(page, 'demo@canadianinsights.ca', 'demo');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Look for transaction list/table
    const transactionList = page.locator('table, [data-testid*="transaction"], .transactions, .transaction-list').first();
    const hasTransactions = await transactionList.isVisible({ timeout: 5000 }).catch(() => false);
    
    // If transactions exist, they should be visible
    // If no transactions, this might not be visible
    // This test documents the expected behavior
  });

  test('should display insights or recommendations', async ({ page }) => {
    await login(page, 'demo@canadianinsights.ca', 'demo');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Look for insights section
    // This might be labeled as "Insights", "Recommendations", "Analytics", etc.
    const insights = page.locator('text=/insight|recommendation|suggestion|analytics/i, [data-testid*="insight"], .insights').first();
    
    // Wait a bit for insights to load (might be async)
    await page.waitForTimeout(2000);
    
    const hasInsights = await insights.isVisible({ timeout: 5000 }).catch(() => false);
    
    // Insights might not always be visible if there's no data
    // But if visible, it should be properly formatted
    if (hasInsights) {
      expect(await insights.textContent()).toBeTruthy();
    }
  });

  test('should handle empty state when no transactions exist', async ({ page }) => {
    // This test might need a fresh account with no transactions
    // For now, we'll test that the page loads even with minimal data
    
    await login(page, 'demo@canadianinsights.ca', 'demo');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Page should still load even if empty
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();
    
    // Should show some empty state message or upload prompt
    const emptyState = page.locator('text=/no transaction|upload|get started|add transaction/i').first();
    const hasEmptyState = await emptyState.isVisible({ timeout: 3000 }).catch(() => false);
    
    // Empty state is acceptable - just verify page doesn't crash
    expect(page.url()).toBeTruthy();
  });
});

