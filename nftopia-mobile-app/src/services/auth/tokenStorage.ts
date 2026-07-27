import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import * as Crypto from "expo-crypto";

const ACCESS_TOKEN_KEY = "nftopia_access_token";
const REFRESH_TOKEN_KEY = "nftopia_refresh_token";
const USER_DATA_KEY = "nftopia_user_data_encrypted";
const MIGRATION_KEY = "nftopia_storage_migrated_v2";

interface EncryptedPayload {
  data: string;
  salt: string;
}

export class TokenStorage {
  private biometricAvailable: boolean | null = null;

  async init(): Promise<void> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    this.biometricAvailable = hasHardware && isEnrolled;
  }

  private async getOptions(): Promise<SecureStore.SecureStoreOptions> {
    if (this.biometricAvailable === null) {
      await this.init();
    }
    if (this.biometricAvailable) {
      return {
        requireAuthentication: true,
        authenticationPrompt: "Authenticate to access your account",
      };
    }
    return {};
  }

  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    const options = await this.getOptions();
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, options);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, options);
  }

  async saveRefreshToken(refreshToken: string): Promise<void> {
    const options = await this.getOptions();
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, options);
  }

  async getAccessToken(): Promise<string | null> {
    const options = await this.getOptions();
    try {
      return await SecureStore.getItemAsync(ACCESS_TOKEN_KEY, options);
    } catch {
      return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    }
  }

  async getRefreshToken(): Promise<string | null> {
    const options = await this.getOptions();
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY, options);
    } catch {
      return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    }
  }

  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }

  async saveUserData(data: Record<string, unknown>): Promise<void> {
    const encrypted = await this.encrypt(JSON.stringify(data));
    const options = await this.getOptions();
    await SecureStore.setItemAsync(USER_DATA_KEY, encrypted, options);
  }

  async getUserData(): Promise<Record<string, unknown> | null> {
    const options = await this.getOptions();
    try {
      const encrypted = await SecureStore.getItemAsync(USER_DATA_KEY, options);
      if (!encrypted) return null;
      const decrypted = await this.decrypt(encrypted);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  async clearUserData(): Promise<void> {
    await SecureStore.deleteItemAsync(USER_DATA_KEY);
  }

  async clearAll(): Promise<void> {
    await this.clearTokens();
    await this.clearUserData();
  }

  isTokenExpired(token: string): boolean {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(
        typeof atob === "function"
          ? atob(parts[1])
          : Buffer.from(parts[1], "base64").toString("utf-8"),
      );
      if (!payload.exp) return false;
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  async migrateIfNeeded(): Promise<void> {
    const migrated = await SecureStore.getItemAsync(MIGRATION_KEY);
    if (migrated === "true") return;

    const oldAccessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const oldRefreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    const oldUserData = await SecureStore.getItemAsync("nftopia_user_data");

    if (oldAccessToken || oldRefreshToken || oldUserData) {
      await SecureStore.setItemAsync(MIGRATION_KEY, "in_progress");

      if (oldAccessToken && oldRefreshToken) {
        const options = await this.getOptions();
        await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, oldAccessToken, options);
        await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, oldRefreshToken, options);
      }
      if (oldUserData) {
        try {
          const parsed = JSON.parse(oldUserData);
          await this.saveUserData(parsed);
        } catch {
          // If old data can't be parsed, skip migration
        }
      }
    }
    await SecureStore.setItemAsync(MIGRATION_KEY, "true");
  }

  private async encrypt(plaintext: string): Promise<string> {
    const saltBytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      saltBytes[i] = Math.floor(Math.random() * 256);
    }
    const salt = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      "nftopia_encrypt_" + salt,
    );

    const encrypted = this.xorTransform(plaintext, key);
    const payload: EncryptedPayload = { data: encrypted, salt };
    return JSON.stringify(payload);
  }

  private async decrypt(ciphertext: string): Promise<string> {
    const { data, salt }: EncryptedPayload = JSON.parse(ciphertext);
    const key = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      "nftopia_encrypt_" + salt,
    );
    return this.xorTransform(data, key);
  }

  private xorTransform(text: string, key: string): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
    }
    return result;
  }
}

export const tokenStorage = new TokenStorage();
