export interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email is required' };
  }

  if (email.length > 255) {
    return { isValid: false, error: 'Email must be less than 255 characters' };
  }

  // RFC 5322 compliant email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true, error: null };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password || password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, error: 'Password must be at least 8 characters' };
  }

  // Check for at least 1 number
  if (!/\d/.test(password)) {
    return { 
      isValid: false, 
      error: 'Password must contain at least 1 number' 
    };
  }

  // Check for at least 1 uppercase letter
  if (!/[A-Z]/.test(password)) {
    return { 
      isValid: false, 
      error: 'Password must contain at least 1 uppercase letter' 
    };
  }

  // Check for at least 1 special character
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return { 
      isValid: false, 
      error: 'Password must contain at least 1 special character' 
    };
  }

  return { isValid: true, error: null };
};

export const validateUsername = (username: string): ValidationResult => {
  if (!username || username.length === 0) {
    return { isValid: false, error: 'Username is required' };
  }

  if (username.length < 3 || username.length > 20) {
    return { isValid: false, error: 'Username must be 3-20 alphanumeric characters' };
  }

  // Check for alphanumeric only (including underscores)
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { isValid: false, error: 'Username must be alphanumeric only' };
  }

  return { isValid: true, error: null };
};

export const validateConfirmPassword = (
  password: string,
  confirmPassword: string
): ValidationResult => {
  if (!confirmPassword || confirmPassword.length === 0) {
    return { isValid: false, error: 'Please confirm your password' };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: 'Passwords do not match' };
  }

  return { isValid: true, error: null };
};

export const getFullValidationErrorMessage = (
  field: string,
  value: string
): string => {
  switch (field) {
    case 'email':
      return validateEmail(value).error || '';
    case 'password':
      return validatePassword(value).error || '';
    case 'username':
      return validateUsername(value).error || '';
    default:
      return '';
  }
};
