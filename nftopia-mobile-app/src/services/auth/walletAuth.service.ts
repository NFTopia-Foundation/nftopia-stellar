import { Wallet } from '../stellar/types';
import { StellarWalletService } from '../stellar/wallet.service';
import { tokenStorage } from './tokenStorage';
import {
  AuthError,
  AuthErrorCode,
  AuthResponse,
  ChallengeResponse,
  LinkWalletResponse,
  User,
} from './types';

const NETWORK_RETRY_ATTEMPTS = 1;
const NETWORK_RETRY_DELAY_MS = 200;

export class WalletAuthService {
  private readonly walletService: StellarWalletService;
  private readonly baseUrl: string;

  constructor(walletService?: StellarWalletService, baseUrl?: string) {
    this.walletService = walletService ?? new StellarWalletService();
    this.baseUrl = baseUrl ?? 'http://localhost:3000';
  }

  async getChallenge(walletAddress: string): Promise<ChallengeResponse> {
    try {
      const response = await this._fetchWithRetry(
        `${this.baseUrl}/auth/wallet/challenge`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Challenge request failed with status ${response.status}`,
          AuthErrorCode.CHALLENGE_FAILED,
        );
      }

      return response.json() as Promise<ChallengeResponse>;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to get challenge: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async authenticate(
    walletAddress: string,
    signature: string,
    nonce: string,
  ): Promise<AuthResponse> {
    try {
      const response = await this._fetchWithRetry(
        `${this.baseUrl}/auth/wallet/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, signature, nonce }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        const message =
          error.message ?? `Authentication failed with status ${response.status}`;
        const code =
          response.status === 401
            ? AuthErrorCode.INVALID_SIGNATURE
            : AuthErrorCode.AUTHENTICATION_FAILED;
        throw new AuthError(message, code);
      }

      const body = (await response.json()) as
        | AuthResponse
        | { requiresTwoFactor: true; tempToken: string };

      if (!('access_token' in body)) {
        // Wallet login for a 2FA-protected account needs a follow-up
        // verification step this client doesn't implement yet — fail loudly
        // rather than store `undefined` tokens.
        throw new AuthError(
          'Two-factor authentication is required for this account and is not yet supported for wallet login.',
          AuthErrorCode.AUTHENTICATION_FAILED,
        );
      }

      await this._storeTokens(body.access_token, body.refresh_token);
      return body;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to authenticate: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  /** Full challenge -> sign -> verify flow for logging in with a Stellar wallet. */
  async walletLogin(wallet: Wallet): Promise<AuthResponse> {
    const challenge = await this.getChallenge(wallet.publicKey);

    if (new Date(challenge.expiresAt).getTime() <= Date.now()) {
      throw new AuthError(
        'Challenge has expired — please try signing in again.',
        AuthErrorCode.EXPIRED_NONCE,
      );
    }

    const signature = await this.walletService.signMessage(
      challenge.message,
      wallet.secretKey,
    );
    return this.authenticate(wallet.publicKey, signature, challenge.nonce);
  }

  /** Exchanges the stored refresh token for a new access/refresh pair. */
  async refreshAccessToken(): Promise<AuthResponse> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) {
      throw new AuthError(
        'No refresh token available',
        AuthErrorCode.AUTHENTICATION_FAILED,
      );
    }

    try {
      const response = await this._fetchWithRetry(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Token refresh failed with status ${response.status}`,
          AuthErrorCode.AUTHENTICATION_FAILED,
        );
      }

      const authResponse = (await response.json()) as AuthResponse;
      await this._storeTokens(authResponse.access_token, authResponse.refresh_token);
      return authResponse;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to refresh token: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  /**
   * Confirms the stored access token is still accepted by the server (not
   * just locally unexpired) by fetching the authenticated user's profile.
   * Used by `initializeAuth()` — a token that decodes as locally
   * unexpired can still have been revoked server-side (password change,
   * admin action, blacklisted after logout elsewhere).
   */
  async validateSession(): Promise<User> {
    const accessToken = await tokenStorage.getAccessToken();
    if (!accessToken) {
      throw new AuthError('No access token available', AuthErrorCode.AUTHENTICATION_FAILED);
    }

    try {
      const response = await this._fetchWithRetry(`${this.baseUrl}/auth/me`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        throw new AuthError(
          `Session validation failed with status ${response.status}`,
          AuthErrorCode.AUTHENTICATION_FAILED,
        );
      }

      const body = (await response.json()) as { data: { data: User } };
      return body.data.data;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to validate session: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async linkWallet(
    walletAddress: string,
    signature: string,
    nonce: string,
  ): Promise<LinkWalletResponse> {
    try {
      const accessToken = await this._getAccessToken();
      const response = await this._fetchWithRetry(`${this.baseUrl}/auth/wallet/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ walletAddress, signature, nonce }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Wallet link failed with status ${response.status}`,
          AuthErrorCode.LINK_FAILED,
        );
      }

      return response.json() as Promise<LinkWalletResponse>;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to link wallet: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async unlinkWallet(walletAddress: string): Promise<void> {
    try {
      const accessToken = await this._getAccessToken();
      const response = await this._fetchWithRetry(`${this.baseUrl}/auth/wallet/unlink`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { message?: string };
        throw new AuthError(
          error.message ?? `Wallet unlink failed with status ${response.status}`,
          AuthErrorCode.UNLINK_FAILED,
        );
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to unlink wallet: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  private async _storeTokens(
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    try {
      await tokenStorage.saveTokens(accessToken, refreshToken);
    } catch (err) {
      throw new AuthError(
        `Failed to store tokens: ${(err as Error).message}`,
        AuthErrorCode.TOKEN_STORAGE_ERROR,
      );
    }
  }

  private async _getAccessToken(): Promise<string | null> {
    try {
      return await tokenStorage.getAccessToken();
    } catch {
      return null;
    }
  }

  /**
   * Retries once on a transient network failure (fetch rejecting outright —
   * DNS/connection issues), never on an HTTP error response, which the
   * caller classifies and surfaces as-is.
   */
  private async _fetchWithRetry(
    url: string,
    options: RequestInit,
    attemptsLeft = NETWORK_RETRY_ATTEMPTS,
  ): Promise<Response> {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attemptsLeft <= 0) throw err;
      await new Promise((resolve) => setTimeout(resolve, NETWORK_RETRY_DELAY_MS));
      return this._fetchWithRetry(url, options, attemptsLeft - 1);
    }
  }
}

export const walletAuthService = new WalletAuthService();
