/**
 * Color palette matching the EpiLink web dashboard
 * Extracted from frontend/app/globals.css
 */

export const colors = {
  // Primary - Rich emerald green for health, vitality
  primary: "#10b981",
  primaryLight: "#34d399",
  primaryDark: "#059669",
  primaryForeground: "#ffffff",

  // Secondary - Sage green for calm
  secondary: "#d1fae5",
  secondaryForeground: "#064e3b",

  // Background & Surface
  background: "#fafaf9",
  backgroundDark: "#1c1917",
  card: "#ffffff",
  cardDark: "#292524",

  // Text colors
  text: "#1c1917",
  textSecondary: "#78716c",
  textDark: "#f5f5f4",
  textSecondaryDark: "#a8a29e",

  // Muted - Soft green-tinted grays
  muted: "#f5f5f4",
  mutedForeground: "#78716c",
  mutedDark: "#292524",
  mutedForegroundDark: "#a8a29e",

  // Accent - Bright lime for highlights
  accent: "#ecfdf5",
  accentForeground: "#065f46",
  accentDark: "#134e4a",

  // Status colors
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",

  // Destructive - Vibrant red-orange
  destructive: "#ef4444",
  destructiveForeground: "#ffffff",

  // Borders
  border: "#e5e7eb",
  borderDark: "#374151",
  input: "#e5e7eb",
  inputDark: "#374151",

  // Task status colors
  status: {
    pending: "#6b7280",
    assigned: "#3b82f6",
    inProgress: "#f59e0b",
    submitted: "#8b5cf6",
    verified: "#06b6d4",
    completed: "#10b981",
    rejected: "#ef4444",
  },

  // Priority colors
  priority: {
    low: "#6b7280",
    medium: "#f59e0b",
    high: "#f97316",
    urgent: "#ef4444",
  },

  // Task type colors
  taskType: {
    cleanup: "#10b981",
    fogging: "#8b5cf6",
    inspection: "#3b82f6",
    investigation: "#f59e0b",
  },

  // Overlay & shadows
  overlay: "rgba(0, 0, 0, 0.5)",
  shadow: "rgba(0, 0, 0, 0.1)",
};

export type Colors = typeof colors;
