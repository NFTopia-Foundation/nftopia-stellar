# Email Authentication Implementation

This directory contains the email login and registration screens with comprehensive form validation for the NFTopia mobile app.

## Components

### FormInput (`components/FormInput.tsx`)
Reusable input component with built-in validation display.

**Features:**
- Label and placeholder support
- Multiple keyboard types (email, numeric, etc.)
- Secure text entry for passwords
- Real-time error display
- Focus state styling
- Disabled state support
- TestID for testing

**Usage:**
```tsx
<FormInput
  label="Email"
  placeholder="Enter your email"
  value={email}
  onChangeText={setEmail}
  keyboardType="email-address"
  error={emailError}
  testID="email-input"
/>
```

### ValidationError (`components/ValidationError.tsx`)
Simple component for displaying validation error messages.

**Features:**
- Conditional rendering (only shows when error exists)
- Consistent error styling
- TestID support

**Usage:**
```tsx
<ValidationError message={error} testID="error-message" />
```

### PasswordStrengthIndicator (`components/PasswordStrengthIndicator.tsx`)
Visual indicator showing password strength in real-time.

**Features:**
- Weak/Medium/Strong classification
- Color-coded progress bar
  - Weak: Red (#FF3B30)
  - Medium: Orange (#FF9500)
  - Strong: Green (#34C759)
- Strength scoring based on:
  - Length (8+ and 12+ characters)
  - Lowercase letters
  - Uppercase letters
  - Numbers
  - Special characters

**Usage:**
```tsx
<PasswordStrengthIndicator password={password} />
```

## Validation Utilities (`utils/validation.ts`)

Comprehensive validation functions for all form fields.

### validateEmail(email: string)
Validates email format and length.

**Rules:**
- Required field
- Maximum 255 characters
- RFC 5322 compliant email format

**Error Messages:**
- "Email is required"
- "Email must be less than 255 characters"
- "Please enter a valid email address"

### validatePassword(password: string)
Validates password strength and complexity.

**Rules:**
- Minimum 8 characters
- At least 1 number
- At least 1 uppercase letter
- At least 1 special character

**Error Messages:**
- "Password is required"
- "Password must be at least 8 characters"
- "Password must contain at least 1 number"
- "Password must contain at least 1 uppercase letter"
- "Password must contain at least 1 special character"

### validateUsername(username: string)
Validates username format.

**Rules:**
- Required field
- 3-20 characters
- Alphanumeric only (underscores allowed)

**Error Messages:**
- "Username is required"
- "Username must be 3-20 alphanumeric characters"
- "Username must be alphanumeric only"

### validateConfirmPassword(password: string, confirmPassword: string)
Validates password confirmation.

**Rules:**
- Required field
- Must match password field

**Error Messages:**
- "Please confirm your password"
- "Passwords do not match"

## Screens

### EmailLoginScreen.tsx

Login screen with email and password authentication.

**Features:**
- Email input with format validation
- Password input with secure entry
- "Forgot Password?" link (placeholder)
- Loading indicator during submission
- Navigation to registration screen
- Back navigation
- Real-time error clearing
- API error handling via AuthStore

**Validation Flow:**
1. User enters credentials
2. Form validates on submit
3. Errors displayed inline
4. On success, user is logged in
5. On failure, error shown via Alert and stored in AuthStore

### EmailRegisterScreen.tsx

Registration screen with comprehensive validation.

**Features:**
- Username input (alphanumeric, 3-20 chars)
- Email input with format validation
- Password input with strength indicator
- Confirm password with match validation
- Terms of Service agreement
- Loading indicator during submission
- Navigation to login screen
- Back navigation
- Real-time error clearing
- API error handling via AuthStore

**Validation Flow:**
1. User fills in all fields
2. Real-time validation on each field
3. Password strength updates as user types
4. Form validates completely on submit
5. All errors displayed inline
6. On success, account created
7. On failure, error shown via Alert and stored in AuthStore

## Testing

### Unit Tests (`utils/validation.test.ts`)

Comprehensive test suite covering all validation functions:

**Email Validation Tests:**
- Empty email
- Invalid format
- Missing domain
- Excessive length
- Valid emails (including subdomains and plus signs)

**Password Validation Tests:**
- Empty password
- Too short
- Missing number
- Missing uppercase
- Missing special character
- Valid strong password

**Username Validation Tests:**
- Empty username
- Too short (< 3 chars)
- Too long (> 20 chars)
- Special characters
- Valid alphanumeric
- Underscores
- Boundary lengths

**Confirm Password Tests:**
- Empty confirmation
- Mismatched passwords
- Matching passwords

**Run Tests:**
```bash
npm test -- validation.test.ts
```

## Integration Points

### AuthStore Integration
Both screens integrate with Zustand AuthStore for:
- Setting user data on successful auth
- Storing auth errors
- Managing loading states

### Navigation Integration
Screens use React Navigation with typed params:
- Import `AuthStackParamList` from `@/navigation/AuthNavigator`
- Use `NativeStackScreenProps` for type-safe navigation
- Navigate between login and registration
- Back navigation support

## Accessibility

All components include accessibility features:
- TestID props for automated testing
- Proper keyboard types for inputs
- Clear error messages
- Loading states announced via ActivityIndicator
- Touch targets meet minimum size requirements

## Styling

Consistent design system across all components:
- Primary color: Black (#000) for buttons
- Accent color: Blue (#007AFF) for links
- Error color: Red (#FF3B30)
- Success color: Green (#34C759)
- Warning color: Orange (#FF9500)
- Border radius: 12px for inputs and buttons
- Consistent spacing using gap property

## Future Enhancements

1. **Backend Integration**: Replace simulated login/registration with actual API calls
2. **OAuth Support**: Add Google, Apple, and social login options
3. **Biometric Auth**: Add fingerprint/face ID support
4. **Password Reset**: Implement forgot password flow
5. **Email Verification**: Add email confirmation step
6. **Rate Limiting**: Prevent brute force attacks
7. **Captcha**: Add bot protection
8. **Remember Me**: Add persistent session option

## Acceptance Criteria Checklist

✅ Login screen validates email and password
✅ Registration screen validates all fields in real-time
✅ Password strength indicator shows weak/medium/strong
✅ API errors displayed to user
✅ Loading indicator during submission
✅ Successful login navigates to main app (ready for integration)
✅ Successful registration navigates to main app (ready for integration)
✅ Navigation between login and registration works
✅ Form validation tests passing
✅ TypeScript types properly defined
✅ Components are reusable and well-documented
