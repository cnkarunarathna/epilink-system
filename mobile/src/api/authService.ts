/**
 * Authentication API service
 */

import apiClient from "./client";
import { LoginRequest, LoginResponse, User } from "../types/user.types";

type RawLoginResponse = LoginResponse & {
  access_token?: string;
  token?: string;
};

/**
 * Login user
 */
export const login = async (
  credentials: LoginRequest,
): Promise<LoginResponse> => {
  const response = await apiClient.post<RawLoginResponse>(
    "/auth/login",
    credentials,
  );

  const token =
    response.data.accessToken ??
    response.data.access_token ??
    response.data.token;

  if (!token) {
    throw new Error(
      "Login succeeded but no access token was returned by backend",
    );
  }

  return {
    ...response.data,
    accessToken: token,
  };
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
