/**
 * App constants
 */

// API Configuration
export const API_CONFIG = {
  BASE_URL: __DEV__
    ? "http://localhost:3001/api"
    : "https://api.epilink.gov.lk/api",
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
