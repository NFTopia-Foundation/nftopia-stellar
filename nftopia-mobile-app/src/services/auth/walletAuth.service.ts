import * as SecureStore from 'expo-secure-store';
import { Wallet } from '../stellar/types';
import { StellarWalletService } from '../stellar/wallet.service';
import {
  AuthError,
  AuthErrorCode,
  AuthResponse,
  ChallengeResponse,
  LinkWalletResponse,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
} from './types';
import { tokenStorage } from './tokenStorage';

const ACCESS_TOKEN_KEY = 'nftopia_access_token';
const REFRESH_TOKEN_KEY = 'nftopia_refresh_token';

export class WalletAuthService {
  private readonly walletService: StellarWalletService;
  private readonly baseUrl: string;
  private readonly retryConfig: RetryConfig;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(
    walletService?: StellarWalletService,
    baseUrl?: string,
    retryConfig?: RetryConfig,
  ) {
    this.walletService = walletService ?? new StellarWalletService();
    this.baseUrl = baseUrl ?? 'http://localhost:3000';
    this.retryConfig = retryConfig ?? DEFAULT_RETRY_CONFIG;
  }

  private async _fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = this.retryConfig.maxRetries,
  ): Promise<Response> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        return response;
      } catch (err) {
        if (attempt < retries) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.retryConfig.retryDelay * (attempt + 1)),
          );
          continue;
        }
        throw new AuthError(
          `Network error: ${(err as Error).message}`,
          AuthErrorCode.NETWORK_ERROR,
        );
      }
    }
    throw new AuthError(
      'Max retries exceeded',
      AuthErrorCode.NETWORK_ERROR,
    );
  }

  private _isNonceExpired(nonce: string, expiresAt: string): boolean {
    if (!expiresAt) return false;
    const expiry = new Date(expiresAt).getTime();
    if (isNaN(expiry)) return false;
    return Date.now() >= expiry;
  }

  private async _tryRefreshToken(): Promise<boolean> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }
    this.isRefreshing = true;
    this.refreshPromise = this._refreshToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async _refreshToken(): Promise<boolean> {
    try {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseUrl}/auth/wallet/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as AuthResponse;
      await this._storeTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  private async _authenticatedFetch(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const accessToken = await this._getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers as Record<string, string>),
    };

    const response = await this._fetchWithRetry(url, { ...options, headers });

    if (response.status === 401) {
      const refreshed = await this._tryRefreshToken();
      if (refreshed) {
        const newAccessToken = await this._getAccessToken();
        const retryHeaders = {
          ...headers,
          ...(newAccessToken ? { Authorization: `Bearer ${newAccessToken}` } : {}),
        };
        return this._fetchWithRetry(url, { ...options, headers: retryHeaders });
      }
      throw new AuthError(
        'Session expired',
        AuthErrorCode.SESSION_EXPIRED,
      );
    }

    return response;
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

      const authResponse = (await response.json()) as AuthResponse;
      await this._storeTokens(authResponse.access_token, authResponse.refresh_token);
      return authResponse;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Failed to authenticate: ${(err as Error).message}`,
        AuthErrorCode.NETWORK_ERROR,
      );
    }
  }

  async walletLogin(wallet: Wallet): Promise<AuthResponse> {
    const challenge = await this.getChallenge(wallet.publicKey);

    if (this._isNonceExpired(challenge.nonce, challenge.expiresAt)) {
      throw new AuthError(
        'Challenge nonce has expired. Please try again.',
        AuthErrorCode.EXPIRED_NONCE,
      );
    }

    const signature = await this.walletService.signMessage(
      challenge.message,
      wallet.secretKey,
    );
    return this.authenticate(wallet.publicKey, signature, challenge.nonce);
  }

  async linkWallet(
    walletAddress: string,
    signature: string,
    nonce: string,
  ): Promise<LinkWalletResponse> {
    try {
      const response = await this._authenticatedFetch(
        `${this.baseUrl}/auth/wallet/link`,
        {
          method: 'POST',
          body: JSON.stringify({ walletAddress, signature, nonce }),
        },
      );

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
      const response = await this._authenticatedFetch(
        `${this.baseUrl}/auth/wallet/unlink`,
        {
          method: 'DELETE',
          body: JSON.stringify({ walletAddress }),
        },
      );

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

  async refreshSession(): Promise<boolean> {
    return this._tryRefreshToken();
  }

  private async _storeTokens(
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
    } catch (err) {
      throw new AuthError(
        `Failed to store tokens: ${(err as Error).message}`,
        AuthErrorCode.TOKEN_STORAGE_ERROR,
      );
    }
  }

  private async _getAccessToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }
}
