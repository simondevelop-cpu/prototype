/**
 * Password Strength Validation
 * Ensures passwords meet minimum security requirements
 */

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (!password) {
    return {
      valid: false,
      errors: ['Password is required'],
    };
  }

  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  // Uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Number
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special character
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

