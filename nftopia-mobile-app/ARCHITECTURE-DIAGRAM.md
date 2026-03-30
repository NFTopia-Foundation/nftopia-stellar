# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NFTopia Mobile App                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
            ┌───────▼────────┐            ┌────────▼────────┐
            │  Presentation  │            │   State Mgmt    │
            │     Layer      │            │     (Zustand)   │
            └───────┬────────┘            └────────┬────────┘
                    │                               │
        ┌───────────┼───────────┐                   │
        │           │           │                   │
┌───────▼──────┐ ┌─▼──────────▼─┐         ┌───────▼───────┐
│  Navigation  │ │   Screens    │         │  AuthStore    │
│   Container  │ │   (UI)       │◄────────┤               │
└───────┬──────┘ └──────────────┘         └───────┬───────┘
        │                                          │
        │                                          │
        ▼                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  SecureStore │  │ AsyncStorage │  │  LocalStorage│      │
│  │  (Sensitive) │  │  (Cache)     │  │  (Settings)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

## Navigation Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        App.tsx                              │
│                  (Root Component)                           │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     AppNavigator                            │
│          (Conditional Router based on Auth State)           │
└──────────────┬──────────────────────┬──────────────────────┘
               │                      │
               │ isCheckingAuth=true  │ isCheckingAuth=false
               ▼                      │
        ┌──────────────┐              │
        │  SplashScreen│              │
        └──────────────┘              │
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
      isAuthenticated=false                         isAuthenticated=true
               │                                             │
               ▼                                             ▼
    ┌─────────────────────┐                    ┌─────────────────────┐
    │   AuthNavigator     │                    │   MainNavigator     │
    │   (Stack Navigator) │                    │   (Stack Navigator) │
    └─────────┬───────────┘                    └─────────┬───────────┘
              │                                          │
    ┌─────────┼──────────────────────────┐              ├──────────┐
    │         │         │        │       │              │          │
    ▼         ▼         ▼        ▼       ▼              ▼          ▼
┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│Onboard │ │Wallet  │ │Create│ │Import│ │Email   │ │ Email  │ │ Home    │
│ ing    │ │Select  │ │Wallet│ │Wallet│ │Login   │ │Register│ │(Placeholder)│
└────────┘ └────────┘ └──────┘ └──────┘ └────────┘ └────────┘ └─────────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │ Marketplace │
                                               │ (Placeholder)│
                                               └─────────────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │  Profile    │
                                               │ (Placeholder)│
                                               └─────────────┘
```

## Authentication Flow

### Wallet Creation Flow
```
┌─────────────┐
│ Onboarding  │
└──────┬──────┘
       │ "Get Started"
       ▼
┌─────────────────┐
│ WalletSelection │
└──────┬──────────┘
       │ "Create New Wallet"
       ▼
┌─────────────────┐
│ WalletCreate    │◄─── User enters password
└──────┬──────────┘
       │ Submit
       ▼
┌─────────────────────────┐
│ WalletService           │
│ - Generate Keypair      │
│ - Encrypt with Password │
│ - Save to SecureStore   │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────┐
│ Update AuthStore│
│ - Set User      │
│ - Set Authenticated=true │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ MainNavigator   │
│ (Auto-redirect) │
└─────────────────┘
```

### Wallet Import Flow
```
┌─────────────┐
│ Onboarding  │
└──────┬──────┘
       │ "Get Started"
       ▼
┌─────────────────┐
│ WalletSelection │
└──────┬──────────┘
       │ "Import Wallet"
       ▼
┌─────────────────┐
│ WalletImport    │◄─── User enters secret key + password
└──────┬──────────┘
       │ Submit
       ▼
┌─────────────────────────┐
│ WalletService           │
│ - Validate Secret Key   │
│ - Derive Public Key     │
│ - Encrypt with Password │
│ - Save to SecureStore   │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────┐
│ Update AuthStore│
│ - Set User      │
│ - Set Authenticated=true │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ MainNavigator   │
│ (Auto-redirect) │
└─────────────────┘
```

### Email Authentication Flow
```
┌─────────────┐
│ Onboarding  │
└──────┬──────┘
       │ "Sign In with Email"
       ▼
┌─────────────────┐
│ EmailLogin      │
└──────┬──────────┘
       │ Login / Register
       ▼
┌─────────────────┐
│ EmailRegister   │◄─── User enters email + password
└──────┬──────────┘
       │ Submit
       ▼
┌─────────────────────────┐
│ Future: API Call        │
│ - Create Account        │
│ - Store User Data       │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────┐
│ Update AuthStore│
│ - Set User      │
│ - Set Authenticated=true │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ MainNavigator   │
│ (Auto-redirect) │
└─────────────────┘
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      AuthStore (Zustand)                    │
│                                                             │
│  State:                                                     │
│  - user: User | null                                        │
│  - loading: boolean                                         │
│  - isAuthenticated: boolean                                 │
│  - error: string | null                                     │
│  - isCheckingAuth: boolean                                  │
│                                                             │
│  Actions:                                                   │
│  - setUser(user)                                            │
│  - setLoading(boolean)                                      │
│  - setError(string)                                         │
│  - clearError()                                             │
│  - setIsCheckingAuth(boolean)                               │
│  - initializeAuth()                                         │
│  - logout()                                                 │
└─────────────────────────────────────────────────────────────┘
           │                              │
           │ Subscribe                    │ Update
           ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│  AppNavigator       │        │   SecureStore       │
│  (Conditional Route)│        │   (Persistence)     │
└─────────────────────┘        └─────────────────────┘
```

## Component Hierarchy

```
App
│
├── SafeAreaView
│   │
│   ├── StatusBar
│   │
│   └── AppNavigator
│       │
│       ├── NavigationContainer
│           │
│           ├── SplashScreen (if isCheckingAuth)
│           │
│           ├── AuthNavigator (if !isAuthenticated)
│           │   │
│           │   ├── Stack.Navigator
│           │   │   │
│           │   │   ├── OnboardingScreen
│           │   │   │   └── View
│           │   │   │       ├── Image (Logo)
│           │   │   │       ├── Text (Title)
│           │   │   │       ├── Text (Subtitle)
│           │   │   │       ├── View (Features)
│           │   │   │       │   └── Text[] (Feature items)
│           │   │   │       └── View (Buttons)
│           │   │   │           └── TouchableOpacity[]
│           │   │   │
│           │   │   ├── WalletSelectionScreen
│           │   │   │   └── ScrollView
│           │   │   │       ├── Text (Title)
│           │   │   │       ├── View (Wallet Cards)
│           │   │   │       │   └── TouchableOpacity[]
│           │   │   │       ├── View (Divider)
│           │   │   │       └── TouchableOpacity (Email)
│           │   │   │
│           │   │   ├── WalletCreateScreen
│           │   │   │   └── View
│           │   │   │       ├── Text (Title)
│           │   │   │       ├── TextInput[] (Password)
│           │   │   │       ├── View (Warning)
│           │   │   │       └── TouchableOpacity (Submit)
│           │   │   │
│           │   │   ├── WalletImportScreen
│           │   │   │   └── ScrollView
│           │   │   │       ├── Text (Title)
│           │   │   │       ├── TextInput (Secret Key)
│           │   │   │       ├── TextInput (Password)
│           │   │   │       ├── View (Warning)
│           │   │   │       └── TouchableOpacity (Submit)
│           │   │   │
│           │   │   ├── EmailLoginScreen
│           │   │   │   └── View
│           │   │   │       ├── Text (Title)
│           │   │   │       ├── TextInput (Email)
│           │   │   │       ├── TextInput (Password)
│           │   │   │       ├── TouchableOpacity (Forgot)
│           │   │   │       └── TouchableOpacity[] (Actions)
│           │   │   │
│           │   │   └── EmailRegisterScreen
│           │   │       └── ScrollView
│           │   │           ├── Text (Title)
│           │   │           ├── TextInput[] (Form fields)
│           │   │           ├── View (Terms)
│           │   │           └── TouchableOpacity[] (Actions)
│           │   │
│           └── MainNavigator (if isAuthenticated)
│               │
│               ├── Stack.Navigator
│               │   │
│               │   ├── Home (Placeholder)
│               │   ├── Marketplace (Placeholder)
│               │   └── Profile (Placeholder)
│               │
│               └── Placeholder screens
```

## Data Flow

### Initialization
```
App Launch
    │
    ▼
AppNavigator mounts
    │
    ▼
useEffect triggers initializeAuth()
    │
    ▼
Check SecureStore for user data
    │
    ├─► Found ──► Set user, isAuthenticated=true
    │
    └─► Not Found ──► Set isCheckingAuth=false
    │
    ▼
Re-render based on auth state
```

### Authentication Success
```
User completes form
    │
    ▼
Submit handler called
    │
    ▼
Validate inputs
    │
    ▼
Call WalletService / API
    │
    ▼
Receive success response
    │
    ▼
Call setUser() in AuthStore
    │
    ├─► Persist to SecureStore
    │
    └─► Update state
    │
    ▼
AppNavigator detects isAuthenticated=true
    │
    ▼
Switch to MainNavigator
    │
    ▼
User in main app
```

### Logout
```
User taps Logout
    │
    ▼
Call logout() from AuthStore
    │
    ▼
Clear SecureStore
    │
    ▼
Reset state to initial
    │
    ▼
AppNavigator detects isAuthenticated=false
    │
    ▼
Switch to AuthNavigator
    │
    ▼
User sees Onboarding screen
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Input Validation                                       │ │
│  │ - Email format                                         │ │
│  │ - Password strength                                    │ │
│  │ - Secret key format                                    │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Application Logic Layer                   │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Error Handling                                         │ │
│  │ - Try/catch blocks                                     │ │
│  │ - User-friendly messages                               │ │
│  │ - Logging                                              │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Storage Layer                            │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Encryption                                             │ │
│  │ - Password-based encryption                            │ │
│  │ - Secure key derivation                                │ │
│  │ - Encrypted storage in SecureStore                     │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                 Platform Security Layer                     │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Expo SecureStore                                       │ │
│  │ - iOS: Keychain                                        │ │
│  │ - Android: EncryptedSharedPreferences                  │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## File Dependencies

```
App.tsx
├── navigation/AppNavigator.tsx
│   ├── stores/authStore.ts
│   │   ├── types/auth.ts
│   │   └── expo-secure-store
│   ├── navigation/AuthNavigator.tsx
│   │   └── screens/Auth/*.tsx
│   ├── navigation/MainNavigator.tsx
│   └── components/SplashScreen.tsx
│
screens/Auth/*.tsx
├── stores/authStore.ts
├── types/auth.ts
└── src/services/stellar/wallet.service.ts
```

---

This architecture ensures:
✅ Separation of concerns
✅ Maintainable code structure
✅ Type safety throughout
✅ Secure data handling
✅ Smooth user experience
✅ Easy to test and extend
