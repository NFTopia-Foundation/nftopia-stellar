import { AuthService } from "../auth.service";
import { tokenStorage } from "../tokenStorage";
import { EmailAuthResponse } from "../types";

jest.mock("../tokenStorage");

const mockedTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;

const fakeResponse: EmailAuthResponse = {
  tokens: {
    accessToken: "access-abc",
    refreshToken: "refresh-xyz",
  },
  user: {
    id: "user-1",
    email: "test@example.com",
    username: "testuser",
  },
};

describe("AuthService", () => {
  let service: AuthService;
  let mockPost: jest.Mock;

  beforeEach(() => {
    mockedTokenStorage.saveTokens.mockResolvedValue(undefined);
    mockedTokenStorage.clearTokens.mockResolvedValue(undefined);
    mockedTokenStorage.clearAll.mockResolvedValue(undefined);
    mockedTokenStorage.getAccessToken.mockResolvedValue("valid-token");
    mockedTokenStorage.getRefreshToken.mockResolvedValue("refresh-xyz");
    mockedTokenStorage.isTokenExpired.mockReturnValue(false);

    service = new AuthService();
    mockPost = jest.fn();
    service.api = { post: mockPost } as any;
    jest.clearAllMocks();
  });

  describe("emailLogin", () => {
    it("calls the login endpoint with email and password", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      const result = await service.emailLogin("test@example.com", "secret");

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/email/login", {
        email: "test@example.com",
        password: "secret",
      });
      expect(result).toEqual(fakeResponse);
    });

    it("saves tokens after a successful login", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      await service.emailLogin("test@example.com", "secret");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
    });

    it("throws an ApiAuthError when credentials are wrong", async () => {
      const axiosError = Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: { status: 401, data: { message: "Invalid credentials" } },
      });
      mockPost.mockRejectedValue(axiosError);

      await expect(
        service.emailLogin("wrong@example.com", "bad"),
      ).rejects.toMatchObject({
        message: "Invalid credentials",
        statusCode: 401,
      });
    });

    it("throws a generic error on network failure", async () => {
      mockPost.mockRejectedValue(new Error("Network Error"));

      await expect(
        service.emailLogin("test@example.com", "secret"),
      ).rejects.toMatchObject({
        message: "Something went wrong. Please try again.",
      });
    });
  });

  describe("emailRegister", () => {
    it("calls the register endpoint with email, password, and username", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      const result = await service.emailRegister(
        "test@example.com",
        "secret",
        "testuser",
      );

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/email/register", {
        email: "test@example.com",
        password: "secret",
        username: "testuser",
      });
      expect(result).toEqual(fakeResponse);
    });

    it("saves tokens after successful registration", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      await service.emailRegister("test@example.com", "secret", "testuser");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
    });
  });

  describe("refreshToken", () => {
    it("calls the refresh endpoint with the refresh token", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      const result = await service.refreshToken("refresh-xyz");

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/refresh", {
        refreshToken: "refresh-xyz",
      });
      expect(result).toEqual(fakeResponse);
    });

    it("saves the new tokens after a successful refresh", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      await service.refreshToken("refresh-xyz");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
    });
  });

  describe("logout", () => {
    it("clears all tokens and user data", async () => {
      await service.logout();

      expect(mockedTokenStorage.clearAll).toHaveBeenCalled();
    });
  });

  describe("performRefresh", () => {
    it("calls refresh endpoint and saves rotated tokens", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });

      const result = await service.performRefresh("old-refresh-token");

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/refresh", {
        refreshToken: "old-refresh-token",
      });
      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
      expect(result).toEqual(fakeResponse);
    });

    it("persists the rotated refresh token from the server", async () => {
      const rotatedResponse: EmailAuthResponse = {
        tokens: {
          accessToken: "new-access",
          refreshToken: "new-refresh",
        },
        user: fakeResponse.user,
      };
      mockPost.mockResolvedValue({ data: rotatedResponse });

      await service.performRefresh("old-refresh-token");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "new-access",
        "new-refresh",
      );
    });
  });

  describe("validateToken", () => {
    it("returns true when token is valid and API confirms", async () => {
      mockedTokenStorage.getAccessToken.mockResolvedValue("valid-jwt");
      mockedTokenStorage.isTokenExpired.mockReturnValue(false);

      const mockGet = jest.fn().mockResolvedValue({ data: {} });
      service.api = { get: mockGet } as any;

      const result = await service.validateToken();
      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith("/api/v1/auth/me");
    });

    it("returns false when no token exists", async () => {
      mockedTokenStorage.getAccessToken.mockResolvedValue(null);

      const result = await service.validateToken();
      expect(result).toBe(false);
    });

    it("returns false when token is expired", async () => {
      mockedTokenStorage.getAccessToken.mockResolvedValue("expired-jwt");
      mockedTokenStorage.isTokenExpired.mockReturnValue(true);

      const result = await service.validateToken();
      expect(result).toBe(false);
    });

    it("returns false when API call fails", async () => {
      mockedTokenStorage.getAccessToken.mockResolvedValue("valid-jwt");
      mockedTokenStorage.isTokenExpired.mockReturnValue(false);

      const mockGet = jest.fn().mockRejectedValue(new Error("Unauthorized"));
      service.api = { get: mockGet } as any;

      const result = await service.validateToken();
      expect(result).toBe(false);
    });
  });
});
