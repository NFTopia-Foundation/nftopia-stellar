import { AuthService } from "../auth.service";
import { tokenStorage } from "../tokenStorage";
import { EmailAuthResponse } from "../types";

// Tests for AuthService using Jest
// tests cover emailLogin, emailRegister, refreshToken, and logout methods

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
    service = new AuthService();
    mockPost = jest.fn();
    service.api = { post: mockPost } as any;
    jest.clearAllMocks();
  });

  describe("emailLogin", () => {
    it("calls the login endpoint with email and password", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      const result = await service.emailLogin("test@example.com", "secret");

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/email/login", {
        email: "test@example.com",
        password: "secret",
      });
      expect(result).toEqual(fakeResponse);
    });

    it("saves tokens after a successful login", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      await service.emailLogin("test@example.com", "secret");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
    });

    it("throws an AuthError when credentials are wrong", async () => {
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
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

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
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

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
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      const result = await service.refreshToken("refresh-xyz");

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/refresh", {
        refreshToken: "refresh-xyz",
      });
      expect(result).toEqual(fakeResponse);
    });

    it("saves the new tokens after a successful refresh", async () => {
      mockPost.mockResolvedValue({ data: fakeResponse });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      await service.refreshToken("refresh-xyz");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
    });
  });

  describe("logout", () => {
    it("clears all stored tokens", async () => {
      mockedTokenStorage.clearTokens.mockResolvedValue(undefined);

      await service.logout();

      expect(mockedTokenStorage.clearTokens).toHaveBeenCalled();
    });
  });
});
