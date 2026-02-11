/**
 * App constants
 */

import { Platform } from "react-native";

// Get API base URL based on platform
// iOS Simulator: localhost works
// Android Emulator: needs 10.0.2.2 to reach host machine
// Physical devices: need computer's local IP
const getApiBaseUrl = (): string => {
  if (__DEV__) {
    // Development mode
    if (Platform.OS === "android") {
      return "http://10.0.2.2:3001/api"; // Android emulator
    }
    return "http://localhost:3001/api"; // iOS simulator or web
  }
  // Production mode
  return "https://api.epilink.gov.lk/api";
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
