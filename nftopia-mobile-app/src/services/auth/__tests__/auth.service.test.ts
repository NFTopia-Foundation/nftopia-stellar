const mockRefreshSession = jest.fn();
jest.mock('../../../../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ refreshSession: mockRefreshSession }) },
}));
// TokenStorage falls back to AsyncStorage when SecureStore is unavailable;
// the real package has an ESM entry point this Jest config doesn't
// transform, so it must be replaced before `../tokenStorage` is loaded —
// jest.mock("../tokenStorage") below still requires the real module once
// to build its automock, which is enough to trigger the parse error.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

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

// What POST /api/v1/auth/register actually returns: the snake_case payload
// wrapped in the backend's { data: { success, data } } envelope.
const fakeRegisterEnvelope = {
  data: {
    success: true,
    data: {
      access_token: "access-abc",
      refresh_token: "refresh-xyz",
      user: {
        id: "user-1",
        email: "test@example.com",
        username: "testuser",
      },
    },
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
    it("calls the backend's register endpoint with email, password, and username", async () => {
      mockPost.mockResolvedValue({ data: fakeRegisterEnvelope });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      await service.emailRegister("test@example.com", "secret", "testuser");

      expect(mockPost).toHaveBeenCalledWith("/api/v1/auth/register", {
        email: "test@example.com",
        password: "secret",
        username: "testuser",
      });
    });

    it("unwraps the { data: { data } } envelope and returns the payload", async () => {
      mockPost.mockResolvedValue({ data: fakeRegisterEnvelope });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      const result = await service.emailRegister(
        "test@example.com",
        "secret",
        "testuser",
      );

      expect(result).toEqual(fakeRegisterEnvelope.data.data);
    });

    it("saves the snake_case tokens after successful registration", async () => {
      mockPost.mockResolvedValue({ data: fakeRegisterEnvelope });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      await service.emailRegister("test@example.com", "secret", "testuser");

      expect(mockedTokenStorage.saveTokens).toHaveBeenCalledWith(
        "access-abc",
        "refresh-xyz",
      );
    });

    it("rejects instead of storing tokens when the response has no tokens", async () => {
      mockPost.mockResolvedValue({ data: { data: { success: true } } });
      mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

      await expect(
        service.emailRegister("test@example.com", "secret", "testuser"),
      ).rejects.toMatchObject({
        message: "Registration failed: invalid response from server",
      });

      expect(mockedTokenStorage.saveTokens).not.toHaveBeenCalled();
    });

    it("surfaces the backend's conflict message with its status code", async () => {
      const axiosError = Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { message: "Email is already registered" },
        },
      });
      mockPost.mockRejectedValue(axiosError);

      await expect(
        service.emailRegister("taken@example.com", "secret", "testuser"),
      ).rejects.toMatchObject({
        message: "Email is already registered",
        statusCode: 409,
      });
      expect(mockedTokenStorage.saveTokens).not.toHaveBeenCalled();
    });

    it("collapses the validation pipe's array of field errors into one message", async () => {
      const axiosError = Object.assign(new Error("Request failed"), {
        isAxiosError: true,
        response: {
          status: 400,
          data: {
            message: [
              "password must include uppercase, lowercase, number, and special character",
              "email must be an email",
            ],
          },
        },
      });
      mockPost.mockRejectedValue(axiosError);

      await expect(
        service.emailRegister("bad", "weak", "x"),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining("password must include uppercase"),
      });
    });

    it("throws a generic error when the request never reaches the server", async () => {
      mockPost.mockRejectedValue(new Error("Network Error"));

      await expect(
        service.emailRegister("test@example.com", "secret", "testuser"),
      ).rejects.toMatchObject({
        message: "Something went wrong. Please try again.",
      });
    });

    it("passes an axios connection failure through without a status code", async () => {
      // Axios network failures carry no `response` object at all - that
      // absence is what the screen keys its distinct network-error UI on.
      const axiosError = Object.assign(new Error("Network Error"), {
        isAxiosError: true,
      });
      mockPost.mockRejectedValue(axiosError);

      await expect(
        service.emailRegister("test@example.com", "secret", "testuser"),
      ).rejects.toMatchObject({ message: "Network Error" });
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

  describe("interceptors (#399)", () => {
    // The outer `beforeEach` replaces `service.api` with a bare
    // `{ post: mockPost }` stub, which has no `.interceptors` at all —
    // these tests need the real axios instance the constructor wires up,
    // so they get their own fresh instance instead.
    let realService: AuthService;
    let postSpy: jest.SpyInstance;
    let requestSpy: jest.SpyInstance;

    beforeEach(() => {
      mockRefreshSession.mockResolvedValue(true);
      mockedTokenStorage.getAccessToken.mockResolvedValue("access-abc");
      realService = new AuthService();
      postSpy = jest.spyOn(realService.api, "post");
      requestSpy = jest.spyOn(realService.api, "request");
    });

    const requestInterceptor = () =>
      (realService.api.interceptors.request as any).handlers[0].fulfilled;
    const responseErrorInterceptor = () =>
      (realService.api.interceptors.response as any).handlers[0].rejected;

    describe("request interceptor", () => {
      it("attaches the Authorization header from the stored access token", async () => {
        mockedTokenStorage.isTokenExpired.mockResolvedValue(false);
        mockedTokenStorage.getAccessToken.mockResolvedValue("valid-token");

        const config = await requestInterceptor()({ url: "/api/v1/nfts", headers: {} });

        expect(config.headers.Authorization).toBe("Bearer valid-token");
      });

      it("proactively refreshes before sending when the token is already expired", async () => {
        mockedTokenStorage.isTokenExpired.mockResolvedValue(true);
        mockedTokenStorage.getRefreshToken.mockResolvedValue("stored-refresh");
        postSpy.mockResolvedValue({ data: fakeResponse });
        mockedTokenStorage.saveTokens.mockResolvedValue(undefined);

        await requestInterceptor()({ url: "/api/v1/nfts", headers: {} });

        expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      });

      it("does not check expiry or attach a header for the auth endpoints themselves", async () => {
        const config = await requestInterceptor()({
          url: "/api/v1/auth/email/login",
          headers: {},
        });

        expect(mockedTokenStorage.isTokenExpired).not.toHaveBeenCalled();
        expect(config.headers.Authorization).toBeUndefined();
      });
    });

    describe("response interceptor (401 handling)", () => {
      const make401 = (url = "/api/v1/nfts") => ({
        response: { status: 401 },
        config: { url, headers: {} },
      });

      it("retries the original request once with a refreshed token", async () => {
        mockedTokenStorage.getRefreshToken.mockResolvedValue("stored-refresh");
        postSpy.mockResolvedValue({ data: fakeResponse }); // the /auth/refresh call
        mockedTokenStorage.saveTokens.mockResolvedValue(undefined);
        requestSpy.mockResolvedValue({ data: "ok" });

        const result = await responseErrorInterceptor()(make401());

        expect(requestSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            url: "/api/v1/nfts",
            headers: expect.objectContaining({ Authorization: "Bearer access-abc" }),
          }),
        );
        expect(result).toEqual({ data: "ok" });
      });

      it("does not retry a request twice (the retry itself failing 401 again propagates)", async () => {
        const error = make401();
        (error.config as any)._retry = true;

        await expect(responseErrorInterceptor()(error)).rejects.toBe(error);
        expect(mockedTokenStorage.getRefreshToken).not.toHaveBeenCalled();
      });

      it("clears tokens and propagates the error when there is no refresh token to fall back on", async () => {
        mockRefreshSession.mockResolvedValue(false);
        mockedTokenStorage.getRefreshToken.mockResolvedValue(null);
        mockedTokenStorage.clearTokens.mockResolvedValue(undefined);

        const error = make401();
        await expect(responseErrorInterceptor()(error)).rejects.toBe(error);

        expect(mockRefreshSession).toHaveBeenCalled();
        expect(requestSpy).not.toHaveBeenCalled();
      });

      it("clears tokens and propagates the error when the refresh call itself fails", async () => {
        mockedTokenStorage.getRefreshToken.mockResolvedValue("stored-refresh");
        mockRefreshSession.mockResolvedValue(false);
        mockedTokenStorage.clearTokens.mockResolvedValue(undefined);

        const error = make401();
        await expect(responseErrorInterceptor()(error)).rejects.toBe(error);

        expect(mockRefreshSession).toHaveBeenCalled();
      });

      it("ignores non-401 errors entirely", async () => {
        const error = { response: { status: 500 }, config: { url: "/api/v1/nfts", headers: {} } };

        await expect(responseErrorInterceptor()(error)).rejects.toBe(error);
        expect(mockedTokenStorage.getRefreshToken).not.toHaveBeenCalled();
      });

      it("dedupes concurrent 401s into a single refresh call", async () => {
        mockedTokenStorage.getRefreshToken.mockResolvedValue("stored-refresh");
        postSpy.mockResolvedValue({ data: fakeResponse });
        mockedTokenStorage.saveTokens.mockResolvedValue(undefined);
        requestSpy.mockResolvedValue({ data: "ok" });

        await Promise.all([
          responseErrorInterceptor()(make401("/api/v1/nfts")),
          responseErrorInterceptor()(make401("/api/v1/listings")),
        ]);

        expect(mockRefreshSession).toHaveBeenCalledTimes(1);
      });
    });
  });
});
