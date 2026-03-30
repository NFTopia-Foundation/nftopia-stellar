export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials extends AuthCredentials {
  username: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
}

export interface AuthResponse {
  tokens: AuthTokens;
  user: UserProfile;
}

export interface AuthError {
  message: string;
  statusCode?: number;
}
