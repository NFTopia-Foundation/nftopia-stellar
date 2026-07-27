import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { EmailAuthResponse, ApiAuthError } from "./types";
import { tokenStorage } from "./tokenStorage";

interface FailedRequest {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}

interface ExtendedConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

function handleError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    const message = data?.message ?? error.message;
    const statusCode = error.response?.status;
    const authError: ApiAuthError = { message, statusCode };
    throw authError;
  }
  throw { message: "Something went wrong. Please try again." } as ApiAuthError;
}

export class AuthService {
  public api: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: FailedRequest[] = [];
  private refreshPromise: Promise<EmailAuthResponse> | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: "http://localhost:3000",
      headers: { "Content-Type": "application/json" },
    });

    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }

  private setupRequestInterceptor(): void {
    this.api.interceptors.request.use(
      async (config: ExtendedConfig) => {
        if (config._retry) return config;

        const accessToken = await tokenStorage.getAccessToken();
        if (accessToken) {
          if (tokenStorage.isTokenExpired(accessToken)) {
            const refreshToken = await tokenStorage.getRefreshToken();
            if (refreshToken) {
              try {
                const response = await this.refreshToken(refreshToken);
                (config.headers as Record<string, string>).Authorization = `Bearer ${response.tokens.accessToken}`;
                return config;
              } catch {
                return config;
              }
            }
          }
          (config.headers as Record<string, string>).Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );
  }

  private setupResponseInterceptor(): void {
    this.api.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedConfig;
        if (!originalRequest) return Promise.reject(error);

        if (error.response?.status !== 401 || originalRequest._retry) {
          return Promise.reject(error);
        }

        if (this.isRefreshing) {
          return new Promise<string>((resolve, reject) => {
            this.failedQueue.push({ resolve, reject });
          }).then((token) => {
            (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${token}`;
            return this.api(originalRequest);
          });
        }

        originalRequest._retry = true;
        this.isRefreshing = true;

        try {
          const refreshToken = await tokenStorage.getRefreshToken();
          if (!refreshToken) {
            throw new Error("No refresh token available");
          }

          const response = await this.performRefresh(refreshToken);
          const newAccessToken = response.tokens.accessToken;

          this.processQueue(null, newAccessToken);

          (originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`;
          return this.api(originalRequest);
        } catch (refreshError) {
          this.processQueue(refreshError, null);
          await this.logout();
          throw handleError(refreshError);
        } finally {
          this.isRefreshing = false;
          this.refreshPromise = null;
        }
      },
    );
  }

  private processQueue(error: unknown, token: string | null): void {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token!);
      }
    });
    this.failedQueue = [];
  }

  async performRefresh(refreshToken: string): Promise<EmailAuthResponse> {
    const { data } = await this.api.post<EmailAuthResponse>(
      "/api/v1/auth/refresh",
      { refreshToken },
    );
    // Save the new tokens (including rotated refresh token)
    await tokenStorage.saveTokens(
      data.tokens.accessToken,
      data.tokens.refreshToken,
    );
    return data;
  }

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

  async refreshToken(refreshToken: string): Promise<EmailAuthResponse> {
    try {
      const { data } = await this.api.post<EmailAuthResponse>(
        "/api/v1/auth/refresh",
        { refreshToken },
      );
      // Persist with rotation - the server returns a new refresh token
      await tokenStorage.saveTokens(
        data.tokens.accessToken,
        data.tokens.refreshToken,
      );
      return data;
    } catch (error) {
      handleError(error);
    }
  }

  async logout(): Promise<void> {
    await tokenStorage.clearAll();
  }

  async validateToken(): Promise<boolean> {
    try {
      const token = await tokenStorage.getAccessToken();
      if (!token) return false;
      if (tokenStorage.isTokenExpired(token)) return false;
      await this.api.get("/api/v1/auth/me");
      return true;
    } catch {
      return false;
    }
  }
}

export const authService = new AuthService();
