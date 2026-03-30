import { validateEmail, validatePassword, validateUsername, validateConfirmPassword } from '../utils/validation';

describe('Validation Utils', () => {
  describe('validateEmail', () => {
    it('should return error for empty email', () => {
      const result = validateEmail('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email is required');
    });

    it('should return error for invalid email format', () => {
      const result = validateEmail('invalid-email');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return error for email without domain', () => {
      const result = validateEmail('test@');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please enter a valid email address');
    });

    it('should return error for email exceeding 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = validateEmail(longEmail);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Email must be less than 255 characters');
    });

    it('should return valid for proper email', () => {
      const result = validateEmail('test@example.com');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should accept emails with subdomains', () => {
      const result = validateEmail('test@mail.example.com');
      expect(result.isValid).toBe(true);
    });

    it('should accept emails with plus signs', () => {
      const result = validateEmail('test+tag@example.com');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validatePassword', () => {
    it('should return error for empty password', () => {
      const result = validatePassword('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password is required');
    });

    it('should return error for password less than 8 characters', () => {
      const result = validatePassword('short');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters');
    });

    it('should return error for password without number', () => {
      const result = validatePassword('Abcdefgh!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least 1 number');
    });

    it('should return error for password without uppercase', () => {
      const result = validatePassword('abcdefgh1!');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least 1 uppercase letter');
    });

    it('should return error for password without special character', () => {
      const result = validatePassword('Abcdefgh1');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Password must contain at least 1 special character');
    });

    it('should return valid for strong password', () => {
      const result = validatePassword('StrongP@ssw0rd');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should accept password with all requirements', () => {
      const result = validatePassword('Test1234!');
      expect(result.isValid).toBe(true);
    });
  });

  describe('validateUsername', () => {
    it('should return error for empty username', () => {
      const result = validateUsername('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username is required');
    });

    it('should return error for username less than 3 characters', () => {
      const result = validateUsername('ab');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be 3-20 alphanumeric characters');
    });

    it('should return error for username more than 20 characters', () => {
      const result = validateUsername('a'.repeat(21));
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be 3-20 alphanumeric characters');
    });

    it('should return error for username with special characters', () => {
      const result = validateUsername('user@name');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Username must be alphanumeric only');
    });

    it('should return valid for alphanumeric username', () => {
      const result = validateUsername('user123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe(null);
    });

    it('should accept username with underscores', () => {
      const result = validateUsername('user_name');
      expect(result.isValid).toBe(true);
    });

    it('should accept username at boundary lengths', () => {
      const short = validateUsername('abc');
      expect(short.isValid).toBe(true);

      const long = validateUsername('a'.repeat(20));
      expect(long.isValid).toBe(true);
    });
  });

  describe('validateConfirmPassword', () => {
    it('should return error for empty confirm password', () => {
      const result = validateConfirmPassword('password123', '');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Please confirm your password');
    });

    it('should return error for mismatched passwords', () => {
      const result = validateConfirmPassword('password123', 'password456');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Passwords do not match');
    });

    it('should return valid for matching passwords', () => {
      const result = validateConfirmPassword('password123', 'password123');
      expect(result.isValid).toBe(true);
      expect(result.error).toBe(null);
    });
  });
});
