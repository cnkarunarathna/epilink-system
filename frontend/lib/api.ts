import axios from "axios";
import {
  ACCESS_TOKEN_KEY,
  isTokenExpired,
  dispatchLogoutEvent,
  clearAuthStorage,
} from "./tokenUtils";

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token from localStorage
    if (typeof window !== "undefined") {
      const token = localStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) {
        // Check if token is expired before making request
        if (isTokenExpired(token)) {
          // Token expired, clear storage and trigger logout
          clearAuthStorage();
          dispatchLogoutEvent();
          return Promise.reject(new Error("Token expired"));
        }
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized - trigger logout
    if (error.response?.status === 401) {
      clearAuthStorage();
      dispatchLogoutEvent();
    }

    // Handle common errors here
    if (error.response) {
      // Server responded with error status
      console.error("API Error:", error.response.data);
    } else if (error.request) {
      // Request made but no response
      console.error("Network Error:", error.message);
    } else {
      // Something else happened
      console.error("Error:", error.message);
    }
    return Promise.reject(error);
  },
);

export default api;
