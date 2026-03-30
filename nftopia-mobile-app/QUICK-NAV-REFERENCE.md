# Quick Navigation Reference

## 🌊 Navigation Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         App Launch                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
              ┌───────────────┐
              │ SplashScreen  │ ← Shows while checking auth
              └───────┬───────┘
                      │
                      ├─ Authenticated ──────┐
                      │                      │
                      │ Not Authenticated    ▼
                      │              ┌──────────────────┐
                      │              │ AuthNavigator    │
                      ▼              └──────────────────┘
              ┌──────────────────┐            │
              │ MainNavigator    │            ├─► OnboardingScreen
              └──────────────────┘            │
                                             ├─► WalletSelectionScreen
                                             │
                                             ├─► WalletCreateScreen
                                             │
                                             ├─► WalletImportScreen
                                             │
                                             ├─► EmailLoginScreen
                                             │
                                             └─► EmailRegisterScreen
```

## 📱 Screen Flow

### Primary User Journey (Wallet-based)
```
Onboarding 
   │
   ├─► Get Started
   │      │
   │      ▼
   │   Wallet Selection
   │      │
   │      ├─► Create New Wallet ──► WalletCreate ──► Main App
   │      │
   │      └─► Import Wallet ──────► WalletImport ──► Main App
   │
   └─► Sign In with Email
          │
          ▼
       Email Login ──► Main App
```

### Secondary User Journey (Email-based)
```
Onboarding
   │
   └─► Sign In with Email
          │
          ├─► Login ───────────► Main App
          │
          └─► Don't have account?
                 │
                 ▼
              Email Register ──► Main App
```

## 🗂️ File Organization

```
nftopia-mobile-app/
│
├── App.tsx                           # Entry point with SafeAreaView
│
├── navigation/
│   ├── AppNavigator.tsx              # Conditional router (Auth vs Main)
│   ├── AuthNavigator.tsx             # Stack navigator for auth screens
│   ├── MainNavigator.tsx             # Stack navigator for main app
│   └── index.ts                      # Exports
│
├── screens/Auth/
│   ├── OnboardingScreen.tsx          # Welcome screen
│   ├── WalletSelectionScreen.tsx     # Choose auth method
│   ├── WalletCreateScreen.tsx        # Create new wallet
│   ├── WalletImportScreen.tsx        # Import existing wallet
│   ├── EmailLoginScreen.tsx          # Email login form
│   └── EmailRegisterScreen.tsx       # Email registration form
│
├── stores/
│   └── authStore.ts                  # Zustand state management
│
├── types/
│   └── auth.ts                       # TypeScript types
│
├── components/
│   └── SplashScreen.tsx              # Loading indicator
│
└── __tests__/
    └── auth-navigation.test.ts       # Test suite
```

## 🔑 State Management

### AuthStore Structure

```typescript
{
  // State
  user: User | null,
  loading: boolean,
  isAuthenticated: boolean,
  error: string | null,
  isCheckingAuth: boolean,
  
  // Actions
  setUser: (user) => void,
  setLoading: (loading) => void,
  setError: (error) => void,
  clearError: () => void,
  setIsCheckingAuth: (isChecking) => void,
  initializeAuth: () => Promise<void>,
  logout: () => Promise<void>,
}
```

### Usage Example

```typescript
import { useAuth } from '@/stores/authStore';

function MyComponent() {
  const { isAuthenticated, user, loading, logout } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
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

## 🎯 Navigation Parameters

### AuthStackParamList

```typescript
type AuthStackParamList = {
  Onboarding: undefined;
  WalletSelection: undefined;
  WalletCreate: undefined;
  WalletImport: undefined;
  EmailLogin: undefined;
  EmailRegister: undefined;
};
```

### Navigation Props

```typescript
type Props = NativeStackScreenProps<AuthStackParamList, 'ScreenName'>;

function MyScreen({ navigation, route }: Props) {
  // Navigate forward
  navigation.navigate('NextScreen');
  
  // Go back
  navigation.goBack();
  
  // Reset stack
  navigation.reset({ routes: [{ name: 'Home' }] });
}
```

## 🎨 Styling Conventions

All screens follow consistent styling:

- **Container**: `flex: 1`, white background
- **Padding**: 24px horizontal, 60px top padding for scrollable content
- **Title**: 32px bold, dark (#1a1a1a)
- **Subtitle**: 16px regular, gray (#666)
- **Primary Button**: Black background, white text
- **Secondary Button**: Transparent with border
- **Inputs**: Light gray background (#f8f9fa), rounded corners

## ✅ Acceptance Criteria Checklist

From the original requirements:

- [x] AuthNavigator defines all auth screens as stack screens
- [x] Navigation between screens works correctly
- [x] AuthStore subscription redirects to main app when authenticated
- [x] Deep linking for password reset (placeholder ready)
- [x] Splash screen shows while checking auth status
- [x] Back navigation respects expected flow
- [x] Clean navigation state on logout

## 🚀 Quick Start Commands

```bash
# Navigate to mobile app directory
cd nftopia-mobile-app

# Install dependencies (if not done)
npm install

# Start development server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

## 📖 Navigation Methods Reference

### Common Navigation Actions

```typescript
// Navigate to another screen
navigation.navigate('ScreenName');

// Go back to previous screen
navigation.goBack();

// Navigate and replace current screen
navigation.replace('ScreenName');

// Reset entire navigation stack
navigation.reset({
  index: 0,
  routes: [{ name: 'ScreenName' }],
});

// Pop to specific screen in stack
navigation.popTo('ScreenName');

// Pop to top (first screen)
navigation.popToTop();
```

### Screen Options

```typescript
<Stack.Screen
  name="ScreenName"
  component={ScreenComponent}
  options={{
    title: 'Display Title',
    headerShown: false,  // Hide header
    animation: 'slide_from_right',
    gestureEnabled: true,
    gestureDirection: 'horizontal',
  }}
/>
```

## 🔐 Security Best Practices

1. **Never store plain passwords** - Always encrypt
2. **Use SecureStore** - For sensitive data storage
3. **Validate inputs** - Client-side validation
4. **Clear state on logout** - Remove all user data
5. **Timeout sessions** - Implement session expiry
6. **HTTPS only** - All API calls over HTTPS

## 📝 Next Steps After Setup

1. ✅ Install dependencies
2. ✅ Test each screen individually
3. ✅ Test complete navigation flows
4. ⏳ Implement backend API integration
5. ⏳ Add biometric authentication
6. ⏳ Implement password reset via email
7. ⏳ Add analytics tracking
8. ⏳ Enhance error handling

---

**Quick Reference Version**: 1.0  
**Last Updated**: 2026-03-29  
**Status**: ✅ Implementation Complete
