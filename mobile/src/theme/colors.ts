/**
 * Color palette matching the EpiLink web dashboard
 * Extracted from frontend/app/globals.css
 * Enhanced with gradient & glass presets
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
    in_progress: "#dca400",
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

  // ── Gradient presets ──
  gradient: {
    primary: ["#00823c", "#007559", "#005d47"] as const,
    header: ["#00823c", "#00a060", "#1cb657"] as const,
    accent: ["#1cb657", "#00a580", "#007559"] as const,
    warm: ["#00823c", "#1cb657", "#4ade80"] as const,
    splash: ["#003d1e", "#00633a", "#00823c"] as const,
    card: ["rgba(255,255,255,0.95)", "rgba(255,255,255,0.85)"] as const,
    risk: {
      veryHigh: ["#7f1d1d", "#991b1b"] as const,
      high: ["#dc2626", "#ef4444"] as const,
      medium: ["#f59e0b", "#fbbf24"] as const,
      low: ["#facc15", "#fde047"] as const,
      veryLow: ["#4ade80", "#86efac"] as const,
    },
  },

  // ── Glass / frosted tokens ──
  glass: {
    background: "rgba(255, 255, 255, 0.82)",
    backgroundDark: "rgba(255, 255, 255, 0.65)",
    border: "rgba(255, 255, 255, 0.3)",
    card: "rgba(255, 255, 255, 0.9)",
  },
};

export type Colors = typeof colors;
