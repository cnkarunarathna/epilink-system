/**
 * API Health Check Utility
 * Use this to test backend connectivity during development
 */

import { API_CONFIG } from "./constants";

interface HealthCheckResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Test backend connectivity
 */
export const testBackendConnection = async (): Promise<HealthCheckResult> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/me`, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 401) {
      // 401 is expected without auth token - means backend is reachable
      return {
        success: true,
        message: "Backend is reachable",
        details: { url: API_CONFIG.BASE_URL, status: response.status },
      };
    }

    return {
      success: true,
      message: "Backend is reachable",
      details: { url: API_CONFIG.BASE_URL, status: response.status },
    };
  } catch (error: any) {
    if (error.name === "AbortError") {
      return {
        success: false,
        message: "Connection timeout - backend not reachable",
        details: { url: API_CONFIG.BASE_URL, error: "Timeout after 5s" },
      };
    }

    return {
      success: false,
      message: "Cannot connect to backend",
      details: {
        url: API_CONFIG.BASE_URL,
        error: error.message,
        networkError:
          error.name === "TypeError" ? "Network request failed" : error.name,
      },
    };
  }
};

/**
 * Test login with credentials
 */
export const testLogin = async (
  email: string,
  password: string,
): Promise<HealthCheckResult> => {
  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        message: "Login successful",
        details: {
          user: data.user,
          hasToken: !!data.accessToken,
        },
      };
    }

    return {
      success: false,
      message: data.message || "Login failed",
      details: { status: response.status, error: data },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Login request failed",
      details: { error: error.message },
    };
  }
};

/**
 * Get comprehensive diagnostics
 */
export const getConnectionDiagnostics = async () => {
  const results = {
    baseUrl: API_CONFIG.BASE_URL,
    timeout: API_CONFIG.TIMEOUT,
    timestamp: new Date().toISOString(),
    tests: [] as HealthCheckResult[],
  };

  // Test 1: Basic connectivity
  console.log("🔍 Testing backend connectivity...");
  const connectivityTest = await testBackendConnection();
  results.tests.push(connectivityTest);

  if (connectivityTest.success) {
    console.log("✅ Backend is reachable");
  } else {
    console.log("❌ Backend is NOT reachable");
    console.log("Details:", connectivityTest.details);
  }

  return results;
};
