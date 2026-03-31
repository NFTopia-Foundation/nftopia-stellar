import axios, { AxiosInstance } from "axios";
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

// AuthService class for API Calls
export class AuthService {
  public api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: "http://localhost:3000",
      headers: { "Content-Type": "application/json" },
    });
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
