import * as SecureStore from "expo-secure-store";
import { TokenStorage } from "../tokenStorage";

// Tests for TokenStorage using Jest
// tests cover saveTokens, getAccessToken, getRefreshToken, and clearTokens methods

jest.mock("expo-secure-store");

// The real package has an ESM entry point this Jest config doesn't
// transform; every test touching TokenStorage (which falls back to
// AsyncStorage when SecureStore is unavailable) must replace it with a
// factory mock so the real module is never loaded.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockAsyncStorage = jest.requireMock("@react-native-async-storage/async-storage") as {
  getItem: jest.Mock;
  setItem: jest.Mock;
  removeItem: jest.Mock;
};

describe("TokenStorage", () => {
  let storage: TokenStorage;

  beforeEach(() => {
    storage = new TokenStorage();
    jest.clearAllMocks();
  });

  it("saves both tokens to secure storage", async () => {
    mockSecureStore.setItemAsync.mockResolvedValue(undefined);

    await storage.saveTokens("access-abc", "refresh-xyz");

    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "nftopia_access_token",
      "access-abc",
    );
    expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
      "nftopia_refresh_token",
      "refresh-xyz",
    );
  });

  it("reads the access token from storage", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("access-abc");

    const token = await storage.getAccessToken();

    expect(token).toBe("access-abc");
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      "nftopia_access_token",
    );
  });

  it("reads the refresh token from storage", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue("refresh-xyz");

    const token = await storage.getRefreshToken();

    expect(token).toBe("refresh-xyz");
    expect(mockSecureStore.getItemAsync).toHaveBeenCalledWith(
      "nftopia_refresh_token",
    );
  });

  it("returns null when there is no token stored", async () => {
    mockSecureStore.getItemAsync.mockResolvedValue(null);

    const token = await storage.getAccessToken();

    expect(token).toBeNull();
  });

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

  describe("AsyncStorage fallback", () => {
    it("falls back to AsyncStorage when SecureStore.setItemAsync throws", async () => {
      mockSecureStore.setItemAsync.mockRejectedValue(new Error("unavailable"));

      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "nftopia_access_token",
        "access-abc",
      );
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "nftopia_refresh_token",
        "refresh-xyz",
      );
    });

    it("falls back to AsyncStorage when SecureStore.getItemAsync throws", async () => {
      mockSecureStore.getItemAsync.mockRejectedValue(new Error("unavailable"));
      mockAsyncStorage.getItem.mockResolvedValue("fallback-token");

      const token = await storage.getAccessToken();

      expect(token).toBe("fallback-token");
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
        "nftopia_access_token",
      );
    });

    it("does not fall back when SecureStore succeeds but returns null (no value stored)", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      const token = await storage.getAccessToken();

      expect(token).toBeNull();
      expect(mockAsyncStorage.getItem).not.toHaveBeenCalled();
    });

    it("clears both backends on clearTokens even if SecureStore delete throws", async () => {
      mockSecureStore.deleteItemAsync.mockRejectedValue(new Error("unavailable"));

      await expect(storage.clearTokens()).resolves.toBeUndefined();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "nftopia_access_token",
      );
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "nftopia_refresh_token",
      );
    });
  });

  describe("token expiry", () => {
    // header.payload.signature with payload `{"exp": <unix seconds>}`
    const jwtWithExpiry = (expSeconds: number) => {
      const header = Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64');
      const payload = Buffer.from(JSON.stringify({ exp: expSeconds })).toString('base64');
      return `${header}.${payload}.sig`;
    };

    it("extracts and stores the expiry from a JWT access token", async () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      await storage.saveTokens(jwtWithExpiry(exp), "refresh-xyz");

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_token_expiry",
        exp.toString(),
      );
    });

    it("does not store an expiry for a non-JWT (opaque) access token", async () => {
      await storage.saveTokens("opaque-token", "refresh-xyz");

      const expiryCalls = mockSecureStore.setItemAsync.mock.calls.filter(
        ([key]) => key === "nftopia_token_expiry",
      );
      expect(expiryCalls).toHaveLength(0);
    });

    it("isTokenExpired returns true once the expiry timestamp has passed", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      mockSecureStore.getItemAsync.mockResolvedValue(pastExp.toString());

      expect(await storage.isTokenExpired()).toBe(true);
    });

    it("isTokenExpired returns false while the expiry timestamp is in the future", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 600;
      mockSecureStore.getItemAsync.mockResolvedValue(futureExp.toString());

      expect(await storage.isTokenExpired()).toBe(false);
    });

    it("isTokenExpired returns false when no expiry is known (opaque token)", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      expect(await storage.isTokenExpired()).toBe(false);
    });
  });

  describe("hasValidSession", () => {
    it("returns false when there is no access token", async () => {
      mockSecureStore.getItemAsync.mockResolvedValue(null);

      expect(await storage.hasValidSession()).toBe(false);
    });

    it("returns false when the access token has expired", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 60;
      mockSecureStore.getItemAsync.mockImplementation((key: string) =>
        Promise.resolve(
          key === "nftopia_access_token" ? "some-token" : pastExp.toString(),
        ),
      );

      expect(await storage.hasValidSession()).toBe(false);
    });

    it("returns true when a non-expired access token is stored", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 600;
      mockSecureStore.getItemAsync.mockImplementation((key: string) =>
        Promise.resolve(
          key === "nftopia_access_token" ? "some-token" : futureExp.toString(),
        ),
      );

      expect(await storage.hasValidSession()).toBe(true);
    });
  });

  describe("biometric protection (#399)", () => {
    it("saves without requireAuthentication when the biometric preference is off (default)", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null); // no 'biometric_enabled' entry -> off
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        "access-abc",
      );
    });

    it("saves with requireAuthentication when the biometric preference is on", async () => {
      mockAsyncStorage.getItem.mockImplementation((key: string) =>
        Promise.resolve(key === "biometric_enabled" ? "true" : null),
      );
      mockSecureStore.setItemAsync.mockResolvedValue(undefined);

      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(mockSecureStore.setItemAsync).toHaveBeenCalledWith(
        "nftopia_access_token",
        "access-abc",
        expect.objectContaining({ requireAuthentication: true }),
      );
    });

    it("does not re-prompt (re-hit SecureStore) for a value already read this session", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockSecureStore.getItemAsync.mockResolvedValue("access-abc");

      await storage.getAccessToken();
      await storage.getAccessToken();

      // The token backend call itself only happened once; the second read
      // was served from the in-memory session cache.
      expect(mockSecureStore.getItemAsync).toHaveBeenCalledTimes(1);
    });

    it("does not cache a null result — a later save is still observed", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockSecureStore.getItemAsync.mockResolvedValue(null);
      expect(await storage.getAccessToken()).toBeNull();

      mockSecureStore.setItemAsync.mockResolvedValue(undefined);
      await storage.saveTokens("access-abc", "refresh-xyz");

      expect(await storage.getAccessToken()).toBe("access-abc");
    });

    it("clears the session cache on clearTokens — a subsequent read hits storage again", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockSecureStore.getItemAsync.mockResolvedValue("access-abc");
      await storage.getAccessToken();

      await storage.clearTokens();

      mockSecureStore.getItemAsync.mockResolvedValue(null);
      expect(await storage.getAccessToken()).toBeNull();
    });
  });
});
