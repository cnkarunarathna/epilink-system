"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  ACCESS_TOKEN_KEY,
  USER_STORAGE_KEY,
  AUTH_LOGOUT_EVENT,
  isTokenExpired,
  clearAuthStorage,
  getStoredToken,
} from "@/lib/tokenUtils";

export type UserRole = "admin" | "supervisor" | "phi" | "viewer";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  district?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Logout function - clear storage and redirect
  const logout = useCallback(() => {
    clearAuthStorage();
    setUser(null);
    router.push("/login");
  }, [router]);

  // Validate session by calling the /auth/me endpoint
  const validateSession = useCallback(async (): Promise<boolean> => {
    const token = getStoredToken();

    if (!token) {
      return false;
    }

    // Check if token is expired client-side first
    if (isTokenExpired(token)) {
      clearAuthStorage();
      return false;
    }

    try {
      // Validate token with backend
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
        }/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) {
        // Token is invalid on server
        clearAuthStorage();
        return false;
      }

      const userData = await response.json();
      setUser(userData);
      // Update stored user data with fresh server data
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      return true;
    } catch (error) {
      console.error("Session validation failed:", error);
      // Network error - use cached user data if token looks valid
      const storedUser = localStorage.getItem(USER_STORAGE_KEY);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          return true;
        } catch {
          clearAuthStorage();
          return false;
        }
      }
      return false;
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const isValid = await validateSession();
      if (!isValid) {
        setUser(null);
      }
      setLoading(false);
    };

    initAuth();
  }, [validateSession]);

  // Listen for logout events from API interceptor
  useEffect(() => {
    const handleLogoutEvent = () => {
      setUser(null);
      router.push("/login");
    };

    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogoutEvent);

    return () => {
      window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogoutEvent);
    };
  }, [router]);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(
        `${
          process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
        }/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Login failed");
      }

      const data = await response.json();

      // Store token and user data using consistent keys
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setUser(data.user);

      // Redirect based on role
      const dashboardRoutes: Record<UserRole, string> = {
        admin: "/admin",
        supervisor: "/supervisor",
        phi: "/phi",
        viewer: "/viewer",
      };

      router.push(dashboardRoutes[data.user.role as UserRole]);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
