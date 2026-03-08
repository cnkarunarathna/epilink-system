/**
 * Axios API client with interceptors
 */

import axios, {
  AxiosInstance,
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";
import { API_CONFIG } from "../utils/constants";
import { getAuthToken, clearAuthData } from "../utils/storage";

/**
 * Create axios instance with default configuration
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Request interceptor - Add auth token to requests
 */
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  },
);

/**
 * Response interceptor - Handle errors globally
 */
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error: AxiosError) => {
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401) {
      // Clear auth data and let the app handle redirect to login
      await clearAuthData();
      // You can emit an event here to notify the app about logout
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject({
        message: "Network error. Please check your internet connection.",
        statusCode: 0,
      });
    }

    // Extract error message from response
    const errorMessage =
      (error.response?.data as any)?.message ||
      error.message ||
      "An unexpected error occurred";

    return Promise.reject({
      message: errorMessage,
      statusCode: error.response?.status || 500,
      error: error.response?.data,
    });
  },
);

export default apiClient;
