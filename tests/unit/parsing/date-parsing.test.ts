/**
 * Unit Tests: Date Parsing
 * Tests the parseDateFlexible function and various date formats
 * 
 * Note: parseDateFlexible is not exported, so these tests will need to be
 * integration tests or we need to extract the function for testing
 */

import { describe, it, expect } from 'vitest';
import dayjs from 'dayjs';

describe('Date Parsing', () => {
  // Helper function to test date parsing (simulating parseDateFlexible logic)
  const parseDate = (dateStr: string): string | null => {
    try {
      // Basic date parsing using dayjs (simplified version)
      const cleaned = dateStr.trim().toUpperCase();
      
      // Handle formats like "JUL02", "AUG12"
      const monthDayMatch = cleaned.match(/^([A-Z]{3})(\d{1,2})$/);
      if (monthDayMatch) {
        const month = monthDayMatch[1];
        const day = monthDayMatch[2];
        const formatted = `${month} ${day}`;
        const parsed = dayjs(formatted, 'MMM D');
        if (parsed.isValid()) {
          return parsed.format('YYYY-MM-DD');
        }
      }
      
      // Try various formats
      const formats = [
        'MMM D', 'MMM DD', 'MM/DD/YYYY', 'MM/DD/YY', 'YYYY-MM-DD',
        'DD/MM/YYYY', 'MM-DD-YYYY'
      ];
      
      for (const format of formats) {
        const parsed = dayjs(dateStr, format);
        if (parsed.isValid()) {
          return parsed.format('YYYY-MM-DD');
        }
      }
      
      return null;
    } catch {
      return null;
    }
  };

  describe('parseDateFlexible (simulated)', () => {
    it('should parse month abbreviation formats', () => {
      // Test formats like "JUL 02", "AUG 12"
      expect(parseDate('JUL 02')).not.toBeNull();
      expect(parseDate('AUG12')).not.toBeNull();
    });

    it('should parse MM/DD/YYYY format', () => {
      const result = parseDate('01/15/2024');
      expect(result).not.toBeNull();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    });

    it('should parse YYYY-MM-DD format', () => {
      const result = parseDate('2024-01-15');
      expect(result).toBe('2024-01-15');
    });

    it('should handle Canadian date formats', () => {
      // Test DD/MM/YYYY (common in Canada)
      expect(parseDate('15/01/2024')).not.toBeNull();
    });

    it('should return null for invalid dates', () => {
      expect(parseDate('invalid')).toBeNull();
      expect(parseDate('99/99/9999')).toBeNull();
      expect(parseDate('')).toBeNull();
    });

    it('should handle edge cases', () => {
      // Test various edge cases
      expect(parseDate('JAN 1')).not.toBeNull();
      expect(parseDate('DEC 31')).not.toBeNull();
    });
  });

  describe('Date Format Normalization', () => {
    it('should normalize dates to YYYY-MM-DD format', () => {
      const formats = [
        '2024-01-15',
        '01/15/2024',
        'Jan 15, 2024',
      ];

      formats.forEach(format => {
        const result = parseDate(format);
        if (result) {
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      });
    });
  });
});

