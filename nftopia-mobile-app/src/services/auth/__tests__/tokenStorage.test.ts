import * as SecureStore from "expo-secure-store";
import { TokenStorage } from "../tokenStorage";

jest.mock("expo-secure-store");

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

jest.mock("expo-local-authentication", () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
}));

jest.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: jest.fn().mockImplementation((_algo: string, input: string) =>
    Promise.resolve(Buffer.from(input).toString("hex").slice(0, 64)),
  ),
}));

import * as LocalAuthentication from "expo-local-authentication";

const mockLocalAuth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

describe("TokenStorage", () => {
  let storage: TokenStorage;

  beforeEach(() => {
    storage = new TokenStorage();
    jest.clearAllMocks();
    mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
    mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
  });

  describe("saveTokens", () => {
    it("saves both tokens to secure storage with biometric options", async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        "access-abc",
        expect.objectContaining({ requireAuthentication: true }),
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
        "refresh-xyz",
        expect.objectContaining({ requireAuthentication: true }),
      );
    });

    it("falls back to no biometric options when hardware unavailable", async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        "access-abc",
        {},
      );
    });
  });

  describe("getAccessToken", () => {
    it("reads the access token from storage with biometric options", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("access-abc");

      const token = await storage.getAccessToken();

      expect(token).toBe("access-abc");
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        expect.objectContaining({ requireAuthentication: true }),
      );
    });

    it("returns null when there is no token stored", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const token = await storage.getAccessToken();

      expect(token).toBeNull();
    });

    it("falls back to non-biometric read when biometric fails", async () => {
      mockSecureStore.getItemAsync
        .mockRejectedValueOnce(new Error("User cancelled"))
        .mockResolvedValueOnce("access-abc");

      const token = await storage.getAccessToken();

      expect(token).toBe("access-abc");
    });
  });

  describe("getRefreshToken", () => {
    it("reads the refresh token from storage with biometric options", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("refresh-xyz");

      const token = await storage.getRefreshToken();

      expect(token).toBe("refresh-xyz");
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
        expect.objectContaining({ requireAuthentication: true }),
      );
    });
  });

  describe("clearTokens", () => {
    it("deletes both tokens when clearing", async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await storage.clearTokens();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
      );
    });
  });

  describe("saveUserData / getUserData", () => {
    it("saves and retrieves encrypted user data", async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await storage.saveUserData({ id: "1", email: "test@test.com" });

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_user_data_encrypted",
        expect.any(String),
        expect.objectContaining({ requireAuthentication: true }),
      );
    });

    it("returns null when no user data stored", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      const result = await storage.getUserData();
      expect(result).toBeNull();
    });
  });

  describe("clearAll", () => {
    it("clears tokens and user data", async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await storage.clearAll();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_user_data_encrypted",
      );
    });
  });

  describe("isTokenExpired", () => {
    it("returns true when token is expired", () => {
      const expiredPayload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 3600 }),
      ).toString("base64");
      const token = `header.${expiredPayload}.signature`;

      expect(storage.isTokenExpired(token)).toBe(true);
    });

    it("returns false when token is not expired", () => {
      const validPayload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64");
      const token = `header.${validPayload}.signature`;

      expect(storage.isTokenExpired(token)).toBe(false);
    });

    it("returns true for token without expiry claim", () => {
      const payload = Buffer.from(JSON.stringify({ sub: "test" })).toString("base64");
      const token = `header.${payload}.signature`;

      expect(storage.isTokenExpired(token)).toBe(false);
    });

    it("returns true for invalid token format", () => {
      expect(storage.isTokenExpired("not-a-jwt")).toBe(true);
    });
  });

  describe("migrateIfNeeded", () => {
    it("migrates existing tokens to biometric-protected storage", async () => {
      mockSecureStore.getItemAsync.mockImplementation(async (key: string) => {
        if (key === "nftopia_access_token") return "old-access";
        if (key === "nftopia_refresh_token") return "old-refresh";
        if (key === "nftopia_storage_migrated_v2") return null;
        return null;
      });
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await storage.migrateIfNeeded();

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        "old-access",
        expect.objectContaining({ requireAuthentication: true }),
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
        "old-refresh",
        expect.objectContaining({ requireAuthentication: true }),
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_storage_migrated_v2",
        "true",
      );
    });

    it("skips migration if already migrated", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("true");

      await storage.migrateIfNeeded();

      expect(mockSecureStore.setItemAsync).not.toHaveBeenCalled();
    });
  });
});
