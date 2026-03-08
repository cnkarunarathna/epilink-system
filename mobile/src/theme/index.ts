/**
 * Theme configuration
 * Exports all theme-related modules
 */

import { colors } from "./colors";
import { typography } from "./typography";
import { spacing, borderRadius, shadows, animation } from "./spacing";

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
};

export type Theme = typeof theme;

export { colors, typography, spacing, borderRadius, shadows, animation };
