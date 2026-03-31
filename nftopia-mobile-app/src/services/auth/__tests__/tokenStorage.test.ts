import * as SecureStore from "expo-secure-store";
import { TokenStorage } from "../tokenStorage";

// Tests for TokenStorage using Jest
// tests cover saveTokens, getAccessToken, getRefreshToken, and clearTokens methods

jest.mock("expo-secure-store");

const mockSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;

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
});
