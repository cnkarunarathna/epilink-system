/**
 * Token utility functions for JWT handling and validation
 */

// Consistent storage keys for auth tokens
export const ACCESS_TOKEN_KEY = "accessToken";
export const USER_STORAGE_KEY = "user";

// Custom event for auth state changes
export const AUTH_LOGOUT_EVENT = "auth:logout";

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  district?: string;
  exp: number;
  iat: number;
}

/**
 * Decode a JWT token payload without verification
 * Note: This is only for client-side expiry checking, actual validation happens server-side
 */
export function getTokenPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode the payload (second part)
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to decode token:", error);
    return null;
  }
}

/**
 * Check if a JWT token is expired based on the exp claim
 * Includes a 30-second buffer to handle clock skew and network latency
 */
export function isTokenExpired(token: string): boolean {
  const payload = getTokenPayload(token);
  if (!payload || !payload.exp) {
    // If we can't decode or no exp claim, treat as expired
    return true;
  }

  // exp is in seconds, Date.now() is in milliseconds
  // Add 30 second buffer for safety
  const expiryTime = payload.exp * 1000;
  const now = Date.now();
  const bufferMs = 30 * 1000; // 30 seconds

  return now >= expiryTime - bufferMs;
}

/**
 * Get the stored access token from localStorage
 */
export function getStoredToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Clear all auth-related data from localStorage
 */
export function clearAuthStorage(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
}

/**
 * Dispatch a custom logout event for cross-component communication
 * This allows the API interceptor to trigger logout in AuthContext
 */
export function dispatchLogoutEvent(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_EVENT));
}
