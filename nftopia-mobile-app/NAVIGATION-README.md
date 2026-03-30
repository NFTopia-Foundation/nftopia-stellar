# Authentication Navigation Documentation

This document describes the authentication navigation flow for the NFTopia mobile app.

## Overview

The authentication system uses React Navigation with a stack-based navigator to manage the flow between different authentication screens. The navigation is controlled by the authentication state managed in Zustand store.

## Architecture

### Navigation Structure

```
App
├── AppNavigator (Conditional Router)
│   ├── AuthNavigator (Not Authenticated)
│   │   ├── OnboardingScreen
│   │   ├── WalletSelectionScreen
│   │   ├── WalletCreateScreen
│   │   ├── WalletImportScreen
│   │   ├── EmailLoginScreen
│   │   └── EmailRegisterScreen
│   └── MainNavigator (Authenticated)
│       ├── Home
│       ├── Marketplace
│       └── Profile
└── SplashScreen (Loading State)
```

### Files Structure

```
nftopia-mobile-app/
├── navigation/
│   ├── AppNavigator.tsx          # Main conditional router
│   ├── AuthNavigator.tsx         # Auth stack navigator
│   ├── MainNavigator.tsx         # Main app navigator (placeholder)
│   └── index.ts                  # Navigation exports
├── screens/
│   └── Auth/
│       ├── OnboardingScreen.tsx
│       ├── WalletSelectionScreen.tsx
│       ├── WalletCreateScreen.tsx
│       ├── WalletImportScreen.tsx
│       ├── EmailLoginScreen.tsx
│       └── EmailRegisterScreen.tsx
├── stores/
│   └── authStore.ts              # Zustand auth state management
├── components/
│   └── SplashScreen.tsx          # Loading splash screen
└── types/
│   └── auth.ts                   # Auth type definitions
```

## Navigation Flow

### Initial Load
1. App starts and shows `SplashScreen`
2. `AuthStore.initializeAuth()` checks for existing user in secure storage
3. Based on authentication state:
   - Authenticated → Navigate to `MainNavigator`
   - Not Authenticated → Navigate to `AuthNavigator`

### Auth Navigator Flow

#### Primary Flow (Wallet-based)
```
Onboarding → WalletSelection → WalletCreate OR WalletImport
```

1. **OnboardingScreen**: Welcome screen with app introduction
   - Actions: "Get Started" → WalletSelection, "Sign In with Email" → EmailLogin

2. **WalletSelectionScreen**: Choose wallet type
   - Actions: 
     - "Create New Wallet" → WalletCreate
     - "Import Wallet" → WalletImport
     - "Sign in with Email" → EmailLogin
     - "Back" → Onboarding

3. **WalletCreateScreen**: Create new Stellar wallet
   - Features: Password creation, encryption setup
   - Actions: "Create Wallet" → Main app, "Back" → WalletSelection

4. **WalletImportScreen**: Import existing wallet
   - Features: Secret key import, password protection
   - Actions: "Import Wallet" → Main app, "Back" → WalletSelection

#### Alternative Flow (Email-based)
```
Onboarding → EmailLogin → Main app
         or
Onboarding → EmailRegister → Main app
```

5. **EmailLoginScreen**: Email/password login
   - Features: Email input, password input, forgot password
   - Actions: "Sign In" → Main app, "Sign Up" → EmailRegister, "Back" → Previous

6. **EmailRegisterScreen**: Create account with email
   - Features: Registration form, terms acceptance
   - Actions: "Sign Up" → Main app, "Sign In" → EmailLogin, "Back" → Previous

## State Management

### AuthStore

The `useAuthStore` Zustand store manages:

**State:**
- `user`: Current user object (null if not authenticated)
- `loading`: Loading state for async operations
- `isAuthenticated`: Boolean authentication status
- `error`: Error message (null if no error)
- `isCheckingAuth`: Boolean indicating if auth is being verified

**Actions:**
- `setUser(user)`: Set user and update authentication status
- `setLoading(loading)`: Update loading state
- `setError(error)`: Set error message
- `clearError()`: Clear error message
- `setIsCheckingAuth(isChecking)`: Update auth checking state
- `initializeAuth()`: Initialize authentication from storage
- `logout()`: Clear user data and logout

### Conditional Routing

```typescript
// In AppNavigator.tsx
if (isCheckingAuth) {
  return <SplashScreen />;
}

return (
  <NavigationContainer>
    {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
  </NavigationContainer>
);
```

## Screen Specifications

### OnboardingScreen
- **Purpose**: First-time user introduction
- **UI Elements**: Logo, title, features list, CTA buttons
- **Navigation**: Can go to WalletSelection or EmailLogin

### WalletSelectionScreen
- **Purpose**: Let users choose their preferred auth method
- **UI Elements**: Wallet cards (Create/Import), email option
- **Navigation**: Central hub for wallet operations

### WalletCreateScreen
- **Purpose**: Generate new Stellar wallet
- **UI Elements**: Password inputs, security warning
- **Integration**: Uses `WalletService.createWallet()`
- **Security**: Encrypts wallet with user password

### WalletImportScreen
- **Purpose**: Import existing Stellar wallet
- **UI Elements**: Secret key input, password field
- **Integration**: Uses `WalletService.importFromSecretKey()`
- **Validation**: Validates secret key format

### EmailLoginScreen
- **Purpose**: Traditional email/password login
- **UI Elements**: Email input, password input, forgot password link
- **Future**: Will integrate with backend API

### EmailRegisterScreen
- **Purpose**: Create new account with email
- **UI Elements**: Registration form, terms agreement
- **Future**: Will integrate with backend API

## Security Features

1. **Secure Storage**: All sensitive data stored in Expo SecureStore
2. **Password Encryption**: Wallets encrypted with user password
3. **State Persistence**: Auth state persists across app restarts
4. **Clean Logout**: All data cleared on logout

## Deep Linking (Future)

Placeholder for password reset deep linking:
```typescript
// To be implemented
Linking.addEventListener('url', handleDeepLink);
```

## Testing Checklist

- [ ] Install dependencies: `npm install`
- [ ] Verify all screens render correctly
- [ ] Test navigation between all screens
- [ ] Test wallet creation flow
- [ ] Test wallet import flow
- [ ] Test email login flow
- [ ] Test email registration flow
- [ ] Verify auth state persistence
- [ ] Test logout functionality
- [ ] Test back navigation behavior
- [ ] Verify splash screen shows during auth check

## Future Enhancements

1. **Biometric Authentication**: Add Face ID/Touch ID support
2. **Social Login**: Integrate Google/Apple authentication
3. **Password Reset**: Implement email-based password recovery
4. **Two-Factor Authentication**: Add 2FA for enhanced security
5. **Session Management**: Implement token refresh and session expiry

## Dependencies

Required packages (add to package.json):
```json
{
  "@react-navigation/native": "^7.0.14",
  "@react-navigation/stack": "^7.1.1",
  "zustand": "^5.0.2",
  "react-native-screens": "^4.6.0",
  "react-native-safe-area-context": "^5.1.0"
}
```

## Installation

After cloning the repository:

```bash
cd nftopia-mobile-app
npm install
```

If you encounter permission errors on Windows, run as Administrator or:

```bash
# Manually add dependencies to package.json and run
npm install
```

## Usage Example

```typescript
// Access auth state in any component
import { useAuth } from '@/stores/authStore';

function MyComponent() {
  const { isAuthenticated, user, logout } = useAuth();
  
  return (
    <View>
      {isAuthenticated ? (
        <Text>Welcome, {user?.email}</Text>
      ) : (
        <Text>Please log in</Text>
      )}
      <Button title="Logout" onPress={logout} />
    </View>
  );
}
```

## Troubleshooting

### Common Issues

1. **Module not found errors**: Run `npm install` to install dependencies
2. **Navigation not working**: Ensure NavigationContainer wraps all navigators
3. **Auth state not persisting**: Check SecureStore permissions
4. **TypeScript errors**: Ensure tsconfig paths are configured correctly

### Getting Help

- Check the console for error messages
- Review React Navigation documentation: https://reactnavigation.org/
- Review Zustand documentation: https://zustand-demo.pmnd.rs/
