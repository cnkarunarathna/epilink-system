/**
 * Authentication Context Provider
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import * as authApi from "../api/authService";
import { User, LoginRequest } from "../types/user.types";
import {
  storeAuthToken,
  getAuthToken,
  storeUserData,
  clearAuthData,
  storeData,
  STORAGE_KEYS,
} from "../utils/storage";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Initialize auth state on mount
   */
  useEffect(() => {
    initializeAuth();
  }, []);

  /**
   * Initialize authentication state
   */
  const initializeAuth = async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      // Validate token by fetching current user
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      await storeUserData(userData);
    } catch (error) {
      console.error("Auth initialization failed:", error);
      // Token is invalid, clear auth data
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login user
   */
  const login = async (credentials: LoginRequest, rememberMe = false) => {
    try {
      const response = await authApi.login(credentials);
      if (!response.accessToken) {
        throw new Error("Authentication token missing in login response");
      }

      // Store token and user data
      await storeAuthToken(response.accessToken);
      await storeUserData(response.user);

      // Store remember me preference
      if (rememberMe) {
        await storeData(STORAGE_KEYS.REMEMBER_ME, "true");
      }

      setUser(response.user);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  /**
   * Logout user
   */
  const logout = async () => {
    try {
      // Optional: call logout endpoint
      await authApi.logout();
    } catch (error) {
      console.error("Logout API call failed:", error);
      // Continue with logout even if API call fails
    } finally {
      // Clear local data
      await clearAuthData();
      setUser(null);
    }
  };

  /**
   * Refresh user data
   */
  const refreshUser = async () => {
    try {
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      await storeUserData(userData);
    } catch (error) {
      console.error("Failed to refresh user:", error);
      // If refresh fails, logout
      await logout();
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
