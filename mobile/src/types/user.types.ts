/**
 * Type definitions for User entity
 */

export enum UserRole {
  ADMIN = "admin",
  SUPERVISOR = "supervisor",
  PHI = "phi",
  VIEWER = "viewer",
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  district: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  user: User;
}
