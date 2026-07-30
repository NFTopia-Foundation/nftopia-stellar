import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { TokenInfo, AuthError, AuthErrorCode } from './types';

const ACCESS_TOKEN_KEY = 'nftopia_access_token';
const REFRESH_TOKEN_KEY = 'nftopia_refresh_token';
const TOKEN_EXPIRY_KEY = 'nftopia_token_expiry';

const MEMORY_STORE: Record<string, string | null> = {};

export class TokenStorage {
  async isAvailable(): Promise<boolean> {
    try {
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  }

  private async _getItem(key: string): Promise<string | null> {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        return await SecureStore.getItemAsync(key);
      }
    } catch {
    }
    return MEMORY_STORE[key] ?? null;
  }

  private async _setItem(key: string, value: string): Promise<void> {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        await SecureStore.setItemAsync(key, value);
        return;
      }
    } catch {
    }
    MEMORY_STORE[key] = value;
  }

  private async _deleteItem(key: string): Promise<void> {
    try {
      const available = await SecureStore.isAvailableAsync();
      if (available) {
        await SecureStore.deleteItemAsync(key);
        return;
      }
    } catch {
    }
    delete MEMORY_STORE[key];
  }

  async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn?: number,
  ): Promise<void> {
    const expiresAt = expiresIn
      ? Date.now() + expiresIn * 1000
      : Date.now() + 3600 * 1000;
    await this._setItem(ACCESS_TOKEN_KEY, accessToken);
    await this._setItem(REFRESH_TOKEN_KEY, refreshToken);
    await this._setItem(TOKEN_EXPIRY_KEY, expiresAt.toString());
  }

  async getAccessToken(): Promise<string | null> {
    return this._getItem(ACCESS_TOKEN_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    return this._getItem(REFRESH_TOKEN_KEY);
  }

  async getTokenInfo(): Promise<TokenInfo | null> {
    const [accessToken, refreshToken, expiry] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
      this._getItem(TOKEN_EXPIRY_KEY),
    ]);
    if (!accessToken || !refreshToken) return null;
    return {
      accessToken,
      refreshToken,
      expiresAt: expiry ? parseInt(expiry, 10) : 0,
    };
  }

  async isTokenExpired(): Promise<boolean> {
    const expiry = await this._getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return true;
    const expiresAt = parseInt(expiry, 10);
    return Date.now() >= expiresAt;
  }

  async getTimeUntilExpiry(): Promise<number> {
    const expiry = await this._getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return 0;
    return Math.max(0, parseInt(expiry, 10) - Date.now());
  }

  async areTokensStored(): Promise<boolean> {
    const [access, refresh] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);
    return access !== null && refresh !== null;
  }

  async requireBiometricAccess(): Promise<boolean> {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return true;
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return true;
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access wallet',
        fallbackLabel: 'Use passcode',
        cancelLabel: 'Cancel',
      });
      if (!result.success) {
        throw new AuthError(
          'Biometric authentication failed',
          AuthErrorCode.BIOMETRIC_FAILED,
        );
      }
      return true;
    } catch (err) {
      if (err instanceof AuthError) throw err;
      throw new AuthError(
        `Biometric authentication failed: ${(err as Error).message}`,
        AuthErrorCode.BIOMETRIC_FAILED,
      );
    }
  }

  async clearTokens(): Promise<void> {
    await this._deleteItem(ACCESS_TOKEN_KEY);
    await this._deleteItem(REFRESH_TOKEN_KEY);
    await this._deleteItem(TOKEN_EXPIRY_KEY);
  }
}

export const tokenStorage = new TokenStorage();
