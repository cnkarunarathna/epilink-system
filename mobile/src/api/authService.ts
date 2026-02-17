/**
 * Authentication API service
 */

import apiClient from "./client";
import { LoginRequest, LoginResponse, User } from "../types/user.types";

/**
 * Login user
 */
export const login = async (
  credentials: LoginRequest,
): Promise<LoginResponse> => {
  const response = await apiClient.post<LoginResponse>(
    "/auth/login",
    credentials,
  );
  return response.data;
};

/**
 * Get current user info
 */
export const getCurrentUser = async (): Promise<User> => {
  const response = await apiClient.get<User>("/auth/me");
  return response.data;
};

/**
 * Logout user (optional - JWT is stateless)
 */
export const logout = async (): Promise<void> => {
  await apiClient.post("/auth/logout");
};
