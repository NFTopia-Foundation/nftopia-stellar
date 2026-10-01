import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// token keys
const ACCESS_TOKEN_KEY = "nftopia_access_token";
const REFRESH_TOKEN_KEY = "nftopia_refresh_token";
const TOKEN_EXPIRY_KEY = "nftopia_token_expiry";
// Same key `biometricService.getBiometricPreference()` / `BiometricSettings`
// read and write. Read directly here (rather than importing that service)
// so this module — on the path of every authenticated request — doesn't
// pull in its heavier dependency chain (expo-local-authentication,
// analytics, error logging). `biometricService` remains the only writer.
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

interface TokenPayload {
  exp?: number;
  iat?: number;
  [key: string]: any;
}

// TokenStorage class for managing tokens in secure storage
export class TokenStorage {
  // Read tokens for the lifetime of the app session once SecureStore has
  // released them, so a biometric-protected item only prompts once per
  // session instead of on every `getAccessToken()` call (which happens on
  // essentially every authenticated API request). Cleared on `clearTokens()`.
  private sessionCache: Map<string, string> = new Map();

  // Writes through expo-secure-store; if the platform has no secure store
  // (e.g. web) that throws, so fall back to AsyncStorage rather than losing
  // the token entirely. Best-effort persistence without OS-level encryption
  // beats forcing the user to re-authenticate on every load.
  //
  // When the user has opted into biometric protection (the same
  // preference `BiometricSettings`/`biometricService` already manage),
  // tokens are written with SecureStore's `requireAuthentication: true`,
  // which ties the OS Keychain/Keystore entry itself to a biometric/device
  // passcode prompt on read — no separate LocalAuthentication call needed.
  // That option only takes effect for an item as it's (re-)created, so
  // toggling the preference protects tokens from the next save onward
  // (next login/refresh), not retroactively.
  private async setItem(key: string, value: string): Promise<void> {
    const requireAuthentication = await this.isBiometricProtectionEnabled();
    try {
      if (requireAuthentication) {
        await SecureStore.setItemAsync(key, value, {
          requireAuthentication: true,
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          authenticationPrompt: "Authenticate to access your NFTopia session",
        });
      } else {
        await SecureStore.setItemAsync(key, value);
      }
      this.sessionCache.set(key, value);
    } catch {
      // No SecureStore on this platform (e.g. web) — requireAuthentication
      // has no AsyncStorage equivalent, so this falls back unprotected.
      await AsyncStorage.setItem(key, value);
      this.sessionCache.set(key, value);
    }
  }

  private async getItem(key: string): Promise<string | null> {
    if (this.sessionCache.has(key)) {
      return this.sessionCache.get(key)!;
    }
    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) this.sessionCache.set(key, value);
      return value;
    } catch {
      const value = await AsyncStorage.getItem(key);
      if (value !== null) this.sessionCache.set(key, value);
      return value;
    }
  }

  private async isBiometricProtectionEnabled(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
      return value ? JSON.parse(value) : false;
    } catch {
      return false;
    }
  }

  // A key may have been written via either backend depending on what was
  // available at save time, so clear both to guarantee nothing lingers.
  private async removeItem(key: string): Promise<void> {
    this.sessionCache.delete(key);
    await Promise.all([
      SecureStore.deleteItemAsync(key).catch(() => {}),
      AsyncStorage.removeItem(key).catch(() => {}),
    ]);
  }

  // save tokens
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await this.setItem(ACCESS_TOKEN_KEY, accessToken);
    await this.setItem(REFRESH_TOKEN_KEY, refreshToken);

    // Extract and store expiry time from JWT
    const expiry = this.getTokenExpiry(accessToken);
    if (expiry) {
      await this.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
    }
  }

  // get access token
  async getAccessToken(): Promise<string | null> {
    return this.getItem(ACCESS_TOKEN_KEY);
  }

  // get refresh token
  async getRefreshToken(): Promise<string | null> {
    return this.getItem(REFRESH_TOKEN_KEY);
  }

  // get token expiry time
  async getTokenExpiryTime(): Promise<number | null> {
    const expiry = await this.getItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  }

  // get time remaining until token expiry (in seconds)
  async getTimeRemaining(): Promise<number | null> {
    const expiry = await this.getTokenExpiryTime();
    if (!expiry) return null;

    const now = Math.floor(Date.now() / 1000);
    const remaining = expiry - now;
    return remaining > 0 ? remaining : 0;
  }

  // check if token is expired
  async isTokenExpired(): Promise<boolean> {
    const remaining = await this.getTimeRemaining();
    return remaining === null ? false : remaining <= 0;
  }

  // Whether there's a stored access token that either has no known expiry
  // (opaque token) or has not yet expired.
  async hasValidSession(): Promise<boolean> {
    const token = await this.getAccessToken();
    if (!token) return false;
    return !(await this.isTokenExpired());
  }

  // decode JWT payload (without verification)
  private decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded) as TokenPayload;
    } catch {
      return null;
    }
  }

  // extract expiry from JWT
  private getTokenExpiry(token: string): number | null {
    const payload = this.decodeToken(token);
    return payload?.exp || null;
  }

  // clear all tokens
  async clearTokens(): Promise<void> {
    await this.removeItem(ACCESS_TOKEN_KEY);
    await this.removeItem(REFRESH_TOKEN_KEY);
    await this.removeItem(TOKEN_EXPIRY_KEY);
  }

  // Drops the in-memory session cache without touching stored tokens, so
  // the next read re-hits SecureStore (and, if biometric protection is
  // on, re-prompts). Exposed for app-lock to call when it locks, and for
  // tests to isolate cases that reconfigure the mocked backend mid-file.
  clearSessionCache(): void {
    this.sessionCache.clear();
  }
}

export const tokenStorage = new TokenStorage();
