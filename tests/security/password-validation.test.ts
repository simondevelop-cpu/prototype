/**
 * Security Tests: Password Validation
 * Tests password strength requirements
 */

import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from '@/lib/password-validation';

describe('Password Validation', () => {
  it('should accept valid passwords', () => {
    const validPasswords = [
      'Password123!',
      'MySecureP@ssw0rd',
      'Test1234#',
    ];

    validPasswords.forEach(password => {
      const result = validatePasswordStrength(password);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePasswordStrength('Short1!');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Password must be at least 8 characters long');
  });

  it('should require uppercase letter', () => {
    const result = validatePasswordStrength('password123!');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
  });

  it('should require lowercase letter', () => {
    const result = validatePasswordStrength('PASSWORD123!');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
  });

  it('should require number', () => {
    const result = validatePasswordStrength('Password!');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('number'))).toBe(true);
  });

  it('should require special character', () => {
    const result = validatePasswordStrength('Password123');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('special character'))).toBe(true);
  });

  it('should return multiple errors for invalid passwords', () => {
    const result = validatePasswordStrength('weak');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

