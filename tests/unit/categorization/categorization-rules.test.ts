/**
 * Unit Tests: Categorization Rules
 * Tests the categorizeTransaction function and categorization logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { categorizeTransaction, CATEGORIES } from '@/lib/categorization-engine';

describe('Categorization Rules', () => {
  beforeEach(() => {
    // Reset any cached patterns before each test
  });

  describe('categorizeTransaction', () => {
    it('should categorize transactions based on description', () => {
      // Test basic categorization
      const result = categorizeTransaction('TIM HORTONS', -5.50, 1);
      expect(result.category).toBeDefined();
      expect(result.label).toBeDefined();
    });

    it.todo('should handle merchant name variations', () => {
      // TODO: Test alternate patterns (e.g., "TIMHORT" → "TIM HORTONS")
      // Requires: Merchant pattern setup with alternate patterns
    });

    it.todo('should handle case-insensitive matching', () => {
      // TODO: Test that "tim hortons" matches "TIM HORTONS"
      // Requires: Merchant pattern setup
    });

    it.todo('should handle space-insensitive matching', () => {
      // TODO: Test that "TIMHORT" matches "TIM HORTONS"
      // Requires: Merchant pattern setup
    });
  });

  describe('CATEGORIES', () => {
    it('should have valid category structure', () => {
      expect(CATEGORIES).toBeDefined();
      expect(typeof CATEGORIES).toBe('object');
      // Verify all categories have label arrays
      Object.values(CATEGORIES).forEach(labels => {
        expect(Array.isArray(labels)).toBe(true);
        expect(labels.length).toBeGreaterThan(0);
      });
    });
  });
});

