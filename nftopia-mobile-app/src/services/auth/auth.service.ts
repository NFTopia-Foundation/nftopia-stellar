import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { EmailAuthResponse, ApiAuthError } from "./types";
import { tokenStorage } from "./tokenStorage";

// error handling function
function handleError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message ?? error.message;
    const statusCode = error.response?.status;
    const authError: ApiAuthError = { message, statusCode };
    throw authError;
  }
  throw { message: "Something went wrong. Please try again." } as ApiAuthError;
}

// Endpoints the request/response interceptors leave alone: attaching a
// (possibly expired) access token to a login/register call makes no sense,
// and refreshing on a 401 *from the refresh call itself* would recurse.
const AUTH_ENDPOINT_MARKERS = ["/auth/email/login", "/auth/email/register", "/auth/refresh"];

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// AuthService class for API Calls
export class AuthService {
  public api: AxiosInstance;
  // Concurrent 401s (or expiry checks) from requests in flight together
  // must not each trigger their own refresh call — the second refresh
  // would race the first and likely get rejected by refresh-token
  // rotation, which invalidates a refresh token as soon as it's used
  // once. Sharing one in-flight promise dedupes them.
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: "http://localhost:3000",
      headers: { "Content-Type": "application/json" },
    });

    this.api.interceptors.request.use(async (config) => {
      if (this.isAuthEndpoint(config.url)) return config;

      if (await tokenStorage.isTokenExpired()) {
        await this.getValidAccessToken();
      }

      const accessToken = await tokenStorage.getAccessToken();
      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as RetryableRequestConfig | undefined;

        if (
          error.response?.status !== 401 ||
          !originalRequest ||
          originalRequest._retry ||
          this.isAuthEndpoint(originalRequest.url)
        ) {
          return Promise.reject(error);
        }

        originalRequest._retry = true;
        const newAccessToken = await this.getValidAccessToken();
        if (!newAccessToken) {
          // Refresh token is missing or no longer valid — there's no way
          // to recover this request. Clearing tokens here (rather than
          // leaving stale ones around) is what lets the app's
          // isAuthenticated-driven navigation fall back to the login
          // screen on its next check.
          await tokenStorage.clearTokens();
          return Promise.reject(error);
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return this.api.request(originalRequest);
      },
    );
  }

  private isAuthEndpoint(url?: string): boolean {
    if (!url) return false;
    return AUTH_ENDPOINT_MARKERS.some((marker) => url.includes(marker));
  }

  // Exchanges the stored refresh token for a new access token, deduping
  // concurrent callers onto a single in-flight request. Resolves `null`
  // (never rejects) when there's no refresh token or the exchange fails,
  // so callers can treat that uniformly as "could not recover".
  private async getValidAccessToken(): Promise<string | null> {
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = null;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<string | null> {
    const refreshToken = await tokenStorage.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const { tokens } = await this.refreshToken(refreshToken);
      return tokens.accessToken;
    } catch {
      return null;
    }
  }

  // Login with email and password
  async emailLogin(email: string, password: string): Promise<EmailAuthResponse> {
    try {
      const { data } = await this.api.post<EmailAuthResponse>(
        "/api/v1/auth/email/login",
        { email, password },
      );
      await tokenStorage.saveTokens(
        data.tokens.accessToken,
        data.tokens.refreshToken,
      );
      return data;
    } catch (error) {
      handleError(error);
    }
  }

  // Register with email, password and username
  async emailRegister(
    email: string,
    password: string,
    username: string,
  ): Promise<EmailAuthResponse> {
    try {
      const { data } = await this.api.post<EmailAuthResponse>(
        "/api/v1/auth/email/register",
        { email, password, username },
      );
      await tokenStorage.saveTokens(
        data.tokens.accessToken,
        data.tokens.refreshToken,
      );
      return data;
    } catch (error) {
      handleError(error);
    }
  }

  // Refresh access token using refresh token
  async refreshToken(refreshToken: string): Promise<EmailAuthResponse> {
    try {
      const { data } = await this.api.post<EmailAuthResponse>(
        "/api/v1/auth/refresh",
        { refreshToken },
      );
      await tokenStorage.saveTokens(
        data.tokens.accessToken,
        data.tokens.refreshToken,
      );
      return data;
    } catch (error) {
      handleError(error);
    }
  }

  // Logout - clearing tokens
  async logout(): Promise<void> {
    await tokenStorage.clearTokens();
  }
}

export const authService = new AuthService();
