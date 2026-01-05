/**
 * E2E Test: Login Flow
 * Tests the complete login user journey
 */

import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
  test('should login with demo credentials', async ({ page }) => {
    await page.goto('/');

    // Click demo login button
    await page.getByRole('button', { name: /demo login/i }).click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 });

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-name"], [data-user]')).toBeVisible();
  });

  test('should login with email and password', async ({ page }) => {
    await page.goto('/');

    // Enter credentials (you may need to create a test account first)
    await page.fill('input[type="email"]', 'demo@canadianinsights.ca');
    await page.fill('input[type="password"]', 'northstar-demo');
    
    // Submit form
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Wait for redirect
    await page.waitForURL(/\/(dashboard|$)/, { timeout: 10000 });

    // Verify login success
    await expect(page.locator('[data-testid="user-name"], [data-user]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/');

    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.getByRole('button', { name: /sign in|login/i }).click();

    // Verify error message appears
    await expect(page.locator('text=/invalid credentials|error/i')).toBeVisible({ timeout: 5000 });
  });

  test('should enforce rate limiting after multiple failed attempts', async ({ page }) => {
    await page.goto('/');

    // Make multiple failed login attempts
    for (let i = 0; i < 6; i++) {
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.getByRole('button', { name: /sign in|login/i }).click();
      await page.waitForTimeout(500); // Wait between attempts
    }

    // Verify rate limit error appears
    await expect(page.locator('text=/too many attempts|rate limit/i')).toBeVisible({ timeout: 5000 });
  });
});

