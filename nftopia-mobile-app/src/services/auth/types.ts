// --- Email auth types ---
export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  username: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
}

// Response shape for email-based auth endpoints (tokens wrapped in object)
export interface EmailAuthResponse {
  tokens: AuthTokens;
  user: UserProfile;
}

// API-level error shape returned by the backend on failure
export interface ApiAuthError {
  message: string;
  statusCode?: number;
}

// --- Wallet auth types ---
export interface User {
  id: string;
  email?: string;
  username?: string;
  address?: string;
  walletAddress?: string;
  walletProvider?: string;
}

// Matches the backend's actual response shape (snake_case keys)
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface ChallengeResponse {
  sessionId: string;
  walletAddress: string;
  nonce: string;
  message: string;
  expiresAt: string;
}

export interface LinkWalletResponse {
  success: boolean;
  wallet: {
    id: string;
    userId: string;
    walletAddress: string;
    walletProvider?: string;
    isPrimary: boolean;
  };
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export enum AuthErrorCode {
  CHALLENGE_FAILED = 'CHALLENGE_FAILED',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  EXPIRED_NONCE = 'EXPIRED_NONCE',
  LINK_FAILED = 'LINK_FAILED',
  UNLINK_FAILED = 'UNLINK_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  TOKEN_STORAGE_ERROR = 'TOKEN_STORAGE_ERROR',
}
