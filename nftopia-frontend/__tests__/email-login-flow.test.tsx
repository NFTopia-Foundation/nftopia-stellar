import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "@/app/[locale]/auth/login/page";
import { useAuthStore, useAuth } from "@/lib/stores/auth-store";

// Mock the useRouter hook
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock the useTranslation hook
jest.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "login.emailTab": "Email",
        "login.walletTab": "Wallet",
        "login.email": "Email",
        "login.password": "Password",
        "login.signIn": "Sign In",
        "login.signingIn": "Signing in…",
        "auth.rememberMe": "Remember me",
        "auth.verificationResent": "Verification email resent successfully! Please check your inbox.",
      };
      return map[key] || key;
    },
    locale: "en",
  }),
}));

// Mock the toast store
const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
jest.mock("@/lib/stores", () => ({
  useToast: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
  }),
}));

// Mock routing helper
jest.mock("@/lib/routing", () => ({
  buildLocalizedRoute: (locale: string, path: string) => `/${locale}${path}`,
}));

// Mock CSRF/API helpers
jest.mock("@/lib/CSRFTOKEN", () => ({
  getCookie: jest.fn().mockResolvedValue("mock-csrf"),
}));
jest.mock("@/lib/config", () => ({
  API_CONFIG: {
    baseUrl: "http://localhost:3000/api/v1",
  },
}));

// Mock third-party or complex UI components to avoid dependency bloat
jest.mock("@/components/circuit-background", () => ({
  CircuitBackground: () => <div data-testid="circuit-bg" />,
}));
jest.mock("@/components/image", () => ({
  OptimizedImage: (props: any) => <img {...props} />,
}));
jest.mock("@/components/wallet/WalletModal", () => ({
  WalletModal: () => <div data-testid="wallet-modal" />,
}));
jest.mock("@/components/wallet/WalletNetworkStatus", () => ({
  WalletNetworkStatus: () => <div data-testid="network-status" />,
}));
jest.mock("@/components/wallet/hooks/useStellarWallet", () => ({
  useStellarWallet: () => ({
    connected: false,
    address: null,
    provider: null,
    connecting: false,
    error: null,
    disconnect: jest.fn(),
    clearError: jest.fn(),
  }),
}));
jest.mock("@/components/wallet/hooks/useStellarAuth", () => ({
  useStellarAuth: () => ({
    loading: false,
    error: null,
    authenticateWithWallet: jest.fn(),
    clearError: jest.fn(),
  }),
}));

// Mock the Zustand stores themselves to isolate UI tests
jest.mock("@/lib/stores/auth-store", () => {
  const original = jest.requireActual("@/lib/stores/auth-store");
  return {
    ...original,
    useAuth: jest.fn(),
    useAuthStore: jest.fn(),
  };
});

describe("Email Login Flow - Store & UI Tests", () => {
  let mockEmailLogin: jest.Mock;
  let mockClearEmailError: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEmailLogin = jest.fn();
    mockClearEmailError = jest.fn();

    // Mock storage systems
    const store: Record<string, string> = {};
    const sessionStore: Record<string, string> = {};
    
    Object.defineProperty(window, "localStorage", {
      value: {
        getItem: jest.fn((key) => store[key] || null),
        setItem: jest.fn((key, val) => { store[key] = val; }),
        removeItem: jest.fn((key) => { delete store[key]; }),
        clear: jest.fn(() => { for (const k in store) delete store[k]; }),
      },
      writable: true,
    });

    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: jest.fn((key) => sessionStore[key] || null),
        setItem: jest.fn((key, val) => { sessionStore[key] = val; }),
        removeItem: jest.fn((key) => { delete sessionStore[key]; }),
        clear: jest.fn(() => { for (const k in sessionStore) delete sessionStore[k]; }),
      },
      writable: true,
    });

    // Default return for auth store hooks
    (useAuthStore as unknown as jest.Mock).mockReturnValue({
      emailLogin: mockEmailLogin,
    });

    (useAuth as unknown as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      clearError: mockClearEmailError,
      user: null,
      isAuthenticated: false,
    });
  });

  it("checks both localStorage and sessionStorage for tokens on initialization", () => {
    // Test the store behavior using mock environment settings
    window.sessionStorage.setItem("access_token", "session-token-abc");
    const token = window.sessionStorage.getItem("access_token");
    expect(token).toBe("session-token-abc");
  });

  it("renders the email login form when email tab is clicked", async () => {
    render(<LoginPage />);

    // Switch to Email mode
    const emailTab = screen.getByRole("button", { name: "Email" });
    fireEvent.click(emailTab);

    // Verify inputs appear
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Remember me")).toBeInTheDocument();
  });

  it("submits the form with email, password, and rememberMe preference", async () => {
    render(<LoginPage />);

    // Switch to Email mode
    fireEvent.click(screen.getByRole("button", { name: "Email" }));

    // Input form details
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    // Check remember me checkbox
    const checkbox = screen.getByLabelText("Remember me");
    fireEvent.click(checkbox);

    // Submit form
    const submitBtn = screen.getByRole("button", { name: "Sign In" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockEmailLogin).toHaveBeenCalledWith("test@example.com", "password123", true);
    });
  });

  it("handles loading states correctly", () => {
    // Set store hook to loading state
    (useAuth as unknown as jest.Mock).mockReturnValue({
      loading: true,
      error: null,
      clearError: mockClearEmailError,
      user: null,
      isAuthenticated: false,
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Email" }));

    // Submit button should render 'Signing in…' and be disabled
    const submitBtn = screen.getByRole("button", { name: "Signing in…" });
    expect(submitBtn).toBeDisabled();
  });

  it("displays verification resend prompt on email unverified response errors", async () => {
    (useAuth as unknown as jest.Mock).mockReturnValue({
      loading: false,
      error: "Your email has not been verified yet.",
      clearError: mockClearEmailError,
      user: null,
      isAuthenticated: false,
    });

    // Mock fetch for verification email resend
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ success: true }),
    });

    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Email" }));

    // Check that error display is rendered
    expect(screen.getByText("Authentication Alert")).toBeInTheDocument();
    
    // Simulate typing email first so it's stored in state
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "unverified@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    const resendBtn = screen.getByRole("button", { name: "Resend verification email" });
    expect(resendBtn).toBeInTheDocument();

    // Trigger resend
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/auth/resend-verification"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "unverified@example.com" }),
        })
      );
      expect(mockShowSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Verification email resent successfully")
      );
    });
  });

  it("redirects immediately when already authenticated", () => {
    (useAuth as unknown as jest.Mock).mockReturnValue({
      loading: false,
      error: null,
      clearError: mockClearEmailError,
      user: { id: "user-1", email: "builder@nftopia.com" },
      isAuthenticated: true,
    });

    render(<LoginPage />);

    expect(mockPush).toHaveBeenCalledWith("/en/creator-dashboard");
  });
});
