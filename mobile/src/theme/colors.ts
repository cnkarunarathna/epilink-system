/**
 * Color palette matching the EpiLink web dashboard
 * Extracted from frontend/app/globals.css
 */

export const colors = {
  // Primary - Rich emerald green for health, vitality
  primary: "#00823c",
  primaryLight: "#1cb657",
  primaryDark: "#007559",
  primaryForeground: "#fcfcfc",

  // Secondary - Sage green for calm
  secondary: "#e1f0e1",
  secondaryForeground: "#132717",

  // Background & Surface
  background: "#fdfefc",
  backgroundDark: "#050b06",
  card: "#ffffff",
  cardDark: "#0a120b",

  // Text colors
  text: "#070d08",
  textSecondary: "#646b64",
  textDark: "#eaf0ea",
  textSecondaryDark: "#8d958d",

  // Muted - Soft green-tinted grays
  muted: "#f2f6f1",
  mutedForeground: "#646b64",
  mutedDark: "#121b14",
  mutedForegroundDark: "#8d958d",

  // Accent - Bright lime for highlights
  accent: "#dff6de",
  accentForeground: "#003508",
  accentDark: "#0c2e16",

  // Status colors
  success: "#1cb657",
  warning: "#dca400",
  error: "#d40c1a",
  info: "#00823c",

  // Destructive - Vibrant red-orange
  destructive: "#d40c1a",
  destructiveForeground: "#fcfcfc",

  // Borders
  border: "#dde3dc",
  borderDark: "#172319",
  input: "#dde3dc",
  inputDark: "#1e2a20",

  // Task status colors
  status: {
    pending: "#646b64",
    assigned: "#00823c",
    inProgress: "#dca400",
    submitted: "#007559",
    verified: "#00a580",
    completed: "#1cb657",
    rejected: "#d40c1a",
  },

  // Priority colors
  priority: {
    low: "#646b64",
    medium: "#dca400",
    high: "#e5481e",
    urgent: "#d40c1a",
  },

  // Task type colors
  taskType: {
    cleanup: "#1cb657",
    fogging: "#007559",
    inspection: "#00823c",
    investigation: "#dca400",
  },

  // Overlay & shadows
  overlay: "rgba(0, 0, 0, 0.5)",
  shadow: "rgba(0, 0, 0, 0.1)",
};

export type Colors = typeof colors;
