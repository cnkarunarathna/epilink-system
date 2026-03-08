/**
 * Common API response types
 */

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}
