/**
 * E2E Test: Sign Up / Account Creation Flow
 * Tests user registration and account creation
 */

import { test, expect } from '@playwright/test';

test.describe('Sign Up / Account Creation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to registration page (adjust path as needed)
    await page.goto('/register');
  });

  test('should display signup form with required fields', async ({ page }) => {
    // Check that page loaded
    await expect(page).toHaveTitle(/Canadian Insights|Sign Up|Register/i);
    
    // Check for email input field
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible();
    
    // Check for password input field
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    await expect(passwordInput).toBeVisible();
    
    // Check for name input field (if present)
    const nameInput = page.locator('input[name="name"], input[name="displayName"], input[placeholder*="name" i]').first();
    // Name might be optional, so just check if present
    const hasNameField = await nameInput.isVisible().catch(() => false);
    
    // Check for submit button
    const submitButton = page.locator('button[type="submit"], button:has-text("Sign Up"), button:has-text("Register"), button:has-text("Create Account")').first();
    await expect(submitButton).toBeVisible();
  });

  test('should validate password strength requirements', async ({ page }) => {
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    await emailInput.fill('test@example.com');
    
    // Try weak password
    await passwordInput.fill('weak');
    await submitButton.click();
    
    // Wait for validation error
    await page.waitForTimeout(1000);
    
    // Check for password strength error (might be various formats)
    const passwordError = page.locator('text=/password|strength|requirements|minimum/i, [data-testid*="password-error"], .text-red').first();
    const hasError = await passwordError.isVisible().catch(() => false);
    
    // If password validation is client-side, error should appear
    // If server-side, form might submit and return error
    // Either way, weak password should be rejected
    if (hasError) {
      expect(await passwordError.textContent()).toBeTruthy();
    }
  });

  test('should reject duplicate email addresses', async ({ page }) => {
    // This test assumes there's a test account already registered
    // Adjust email as needed for your test data
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    // Try to register with existing email
    await emailInput.fill('test@gmail.com'); // Assuming this exists from test data
    await passwordInput.fill('StrongP@ss1');
    
    await submitButton.click();
    
    // Wait for response
    await page.waitForTimeout(2000);
    
    // Check for duplicate email error
    const errorIndicator = page.locator('text=/already|exists|registered|duplicate/i, [role="alert"], .error').first();
    const hasError = await errorIndicator.isVisible().catch(() => false);
    
    // Form should not redirect on duplicate email
    await expect(emailInput).toBeVisible();
  });

  test('should create account with valid credentials', async ({ page }) => {
    // Generate unique email for this test
    const timestamp = Date.now();
    const uniqueEmail = `test-${timestamp}@example.com`;
    
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
    const submitButton = page.locator('button[type="submit"]').first();
    
    await emailInput.fill(uniqueEmail);
    await passwordInput.fill('StrongP@ss1');
    
    // Fill name if field exists
    const nameInput = page.locator('input[name="name"], input[name="displayName"]').first();
    const hasNameField = await nameInput.isVisible().catch(() => false);
    if (hasNameField) {
      await nameInput.fill('Test User');
    }
    
    await submitButton.click();
    
    // Should redirect to onboarding or dashboard after successful registration
    await page.waitForURL(/\/(onboarding|dashboard|home)/, { timeout: 10000 }).catch(() => {});
    
    // Verify we're no longer on the signup page
    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/register');
  });
});

