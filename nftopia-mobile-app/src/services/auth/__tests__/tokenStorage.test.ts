import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { TokenStorage } from "../tokenStorage";
import { AuthErrorCode } from "../types";

jest.mock("expo-secure-store");
jest.mock("expo-local-authentication");

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockLocalAuth = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;

describe("TokenStorage", () => {
  let storage: TokenStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    storage = new TokenStorage();
    mockSecureStore.isAvailableAsync.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("saveTokens", () => {
    it("saves access token, refresh token, and expiry to SecureStore", async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      const now = Date.now();
      jest.setSystemTime(now);
      await storage.saveTokens("access-abc", "refresh-xyz", 3600);

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        "access-abc",
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
        "refresh-xyz",
      );
      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_token_expiry",
        (now + 3600 * 1000).toString(),
      );
    });

    it("defaults expiry to 1 hour when expiresIn not provided", async () => {
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      const now = Date.now();
      jest.setSystemTime(now);
      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_token_expiry",
        (now + 3600 * 1000).toString(),
      );
    });

    it("stores tokens in memory when SecureStore is not available", async () => {
      mockSecureStore.isAvailableAsync.mockResolvedValue(false);

      await storage.saveTokens("mem-access", "mem-refresh", 3600);

      const access = await storage.getAccessToken();
      const refresh = await storage.getRefreshToken();
      expect(access).toBe("mem-access");
      expect(refresh).toBe("mem-refresh");
    });
  });

  describe("getAccessToken / getRefreshToken", () => {
    it("returns null when no token stored", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      expect(await storage.getAccessToken()).toBeNull();
    });

    it("retrieves stored access token from SecureStore", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("stored-access");

      const token = await storage.getAccessToken();

      expect(token).toBe("stored-access");
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
      );
    });

    it("retrieves stored refresh token from SecureStore", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("stored-refresh");

      const token = await storage.getRefreshToken();

      expect(token).toBe("stored-refresh");
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
      );
    });

    it("falls back to memory when SecureStore read fails", async () => {
      mockSecureStore.isAvailableAsync
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      mockSecureStore.getItemAsync.mockRejectedValue(new Error("read error"));

      await storage.saveTokens("mem-access", "mem-refresh", 3600);

      mockSecureStore.isAvailableAsync.mockResolvedValue(false);

      const access = await storage.getAccessToken();
      expect(access).toBe("mem-access");
    });
  });

  describe("getTokenInfo", () => {
    it("returns combined token info when both tokens exist", async () => {
      mockSecureStore.getItemAsync.mockImplementation((key: string) => {
        if (key === "nftopia_access_token") return Promise.resolve("access-123");
        if (key === "nftopia_refresh_token") return Promise.resolve("refresh-456");
        if (key === "nftopia_token_expiry") return Promise.resolve("9999999999000");
        return Promise.resolve(null);
      });

      const info = await storage.getTokenInfo();

      expect(info).toEqual({
        accessToken: "access-123",
        refreshToken: "refresh-456",
        expiresAt: 9999999999000,
      });
    });

    it("returns null when no tokens stored", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      expect(await storage.getTokenInfo()).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("returns true when no expiry stored", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      expect(await storage.isTokenExpired()).toBe(true);
    });

    it("returns true when token is expired", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("1000");

      expect(await storage.isTokenExpired()).toBe(true);
    });

    it("returns false when token is still valid", async () => {
      const future = Date.now() + 3600_000;
      mockSecureStore.getItemAsync.mockResolvedValue(future.toString());

      expect(await storage.isTokenExpired()).toBe(false);
    });
  });

  describe("getTimeUntilExpiry", () => {
    it("returns time in ms until token expires", async () => {
      const now = Date.now();
      jest.setSystemTime(now);
      mockSecureStore.getItemAsync.mockResolvedValue((now + 5000).toString());

      const remaining = await storage.getTimeUntilExpiry();

      expect(remaining).toBe(5000);
    });

    it("returns 0 when no expiry stored", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      expect(await storage.getTimeUntilExpiry()).toBe(0);
    });
  });

  describe("areTokensStored", () => {
    it("returns true when both tokens exist", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue("some-token");

      expect(await storage.areTokensStored()).toBe(true);
    });

    it("returns false when access token is missing", async () => {
      mockSecureStore.getItemAsync.mockImplementation((key: string) => {
        if (key === "nftopia_access_token") return Promise.resolve(null);
        if (key === "nftopia_refresh_token") return Promise.resolve("refresh");
        return Promise.resolve(null);
      });

      expect(await storage.areTokensStored()).toBe(false);
    });

    it("returns false when refresh token is missing", async () => {
      mockSecureStore.getItemAsync.mockImplementation((key: string) => {
        if (key === "nftopia_access_token") return Promise.resolve("access");
        if (key === "nftopia_refresh_token") return Promise.resolve(null);
        return Promise.resolve(null);
      });

      expect(await storage.areTokensStored()).toBe(false);
    });
  });

  describe("requireBiometricAccess", () => {
    beforeEach(() => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(true);
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(true);
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: true, error: null } as any);
    });

    it("returns true when biometric auth succeeds", async () => {
      const result = await storage.requireBiometricAccess();

      expect(result).toBe(true);
    });

    it("returns true when no biometric hardware is available", async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValue(false);

      const result = await storage.requireBiometricAccess();

      expect(result).toBe(true);
    });

    it("returns true when no biometric is enrolled", async () => {
      mockLocalAuth.isEnrolledAsync.mockResolvedValue(false);

      const result = await storage.requireBiometricAccess();

      expect(result).toBe(true);
    });

    it("throws AuthError with BIOMETRIC_FAILED when auth fails", async () => {
      mockLocalAuth.authenticateAsync.mockResolvedValue({ success: false, error: null } as any);

      await expect(storage.requireBiometricAccess()).rejects.toMatchObject({
        code: AuthErrorCode.BIOMETRIC_FAILED,
      });
    });
  });

  describe("clearTokens", () => {
    it("deletes all token-related keys from storage", async () => {
      mockSecureStore.deleteItemAsync.mockResolvedValue(undefined);

      await storage.clearTokens();

      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_refresh_token",
      );
      expect(mockSecureStore.deleteItemAsync).toHaveBeenCalledWith(
        "nftopia_token_expiry",
      );
    });
  });

  describe("isAvailable", () => {
    it("returns true when SecureStore is available", async () => {
      mockSecureStore.isAvailableAsync.mockResolvedValue(true);

      expect(await storage.isAvailable()).toBe(true);
    });

    it("returns false when SecureStore is not available", async () => {
      mockSecureStore.isAvailableAsync.mockRejectedValue(new Error("unavailable"));

      expect(await storage.isAvailable()).toBe(false);
    });
  });
});
