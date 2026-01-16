// Common API response type
type ApiResponse<T> = {
  data: T;
  message?: string;
  error?: string;
  status?: number;
};

// Error type for API
export type ApiError = {
  message: string;
  code?: string | number;
  details?: any;
};

// Generic request type
export type ApiRequest<T = any> = {
  body?: T;
  params?: Record<string, any>;
  headers?: Record<string, string>;
};

export type { ApiResponse };
