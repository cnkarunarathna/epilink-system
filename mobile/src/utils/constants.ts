/**
 * App constants
 */

import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Resolve the API base URL for the current runtime environment.
 *
 * Priority order:
 *  1. EXPO_PUBLIC_API_URL env variable (set in .env for CI / production overrides)
 *  2. Dev mode: derive from the Expo Metro bundler's host IP so the URL works
 *     on physical devices, emulators, and simulators without manual changes.
 *  3. Production fallback.
 *
 * Why hostUri?
 *  When Expo Go (or a dev build) loads the app it connects to the Metro bundler
 *  running on your machine.  `Constants.expoConfig.hostUri` contains that
 *  connection address, e.g. "192.168.1.42:8081".  The NestJS API runs on the
 *  same machine, so stripping the port and appending ":3001/api" gives us the
 *  correct URL on any device that can reach the dev machine — including a real
 *  Android phone on the same Wi-Fi network.
 */
const getApiBaseUrl = (): string => {
  // 1. Explicit override via .env
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    return envUrl;
  }

  if (__DEV__) {
    // 2a. Extract the LAN IP from the Metro bundler host (works for physical
    //     devices and emulators alike).
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const host = hostUri.split(":")[0]; // strip the Metro port (8081)
      return `http://${host}:3001/api`;
    }

    // 2b. Fallback when hostUri is unavailable (e.g. bare workflow without
    //     a running Metro server).
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3001/api"; // Android emulator → host loopback
    }
    return "http://localhost:3001/api"; // iOS simulator / web
  }

  // 3. Production
  return "https://api.epilink.cnkthedev.tech/api";
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: getApiBaseUrl(),
  TIMEOUT: 10000,
};

// Task status display names
export const TASK_STATUS_LABELS = {
  pending: "Pending",
  assigned: "Assigned",
  in_progress: "In Progress",
  submitted: "Submitted",
  verified: "Verified",
  completed: "Completed",
  rejected: "Rejected",
} as const;

// Task type display names
export const TASK_TYPE_LABELS = {
  cleanup: "Cleanup",
  fogging: "Fogging",
  inspection: "Inspection",
  investigation: "Investigation",
} as const;

// Task priority display names
export const TASK_PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

// Evidence status display names
export const EVIDENCE_STATUS_LABELS = {
  pending: "Pending Verification",
  approved: "Approved",
  rejected: "Rejected",
} as const;

// Maximum file sizes
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_IMAGES_PER_TASK = 5;

// Cache durations (in milliseconds)
export const CACHE_DURATION = {
  TASKS: 5 * 60 * 1000, // 5 minutes
  USER: 30 * 60 * 1000, // 30 minutes
};
