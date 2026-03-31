import * as SecureStore from "expo-secure-store";

// token keys
const ACCESS_TOKEN_KEY = "nftopia_access_token";
const REFRESH_TOKEN_KEY = "nftopia_refresh_token";

// TokenStorage class for managing tokens in secure storage
export class TokenStorage {
  // save tokens
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  }

  // get access token
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  }

  // get refresh token
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  }

  // clear all tokens
  async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export const tokenStorage = new TokenStorage();
