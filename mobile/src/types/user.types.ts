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
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    district: string | null;
  };
}
