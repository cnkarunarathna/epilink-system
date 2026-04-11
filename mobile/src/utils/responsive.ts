/**
 * Responsive scale utilities
 *
 * Base reference: iPhone 14 Pro (390 × 844 pt logical pixels).
 * On smaller devices values shrink proportionally; on tablets they grow.
 *
 * Usage:
 *   import { scale, moderateScale, TAB_BAR_HEIGHT } from './responsive';
 *
 *   decorCircle: { width: scale(140), height: scale(140) }
 *   scrollPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
 */

import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get("window");

const BASE_WIDTH = 390; // iPhone 14 Pro reference
const BASE_HEIGHT = 844;

/** Linear scale — mirrors the device width ratio. */
export const scale = (size: number): number =>
  Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);

/** Vertical scale — mirrors the device height ratio. */
export const verticalScale = (size: number): number =>
  Math.round((SCREEN_HEIGHT / BASE_HEIGHT) * size);

/**
 * Moderate scale — a gentler curve that avoids extremes on very small/large
 * screens. `factor` controls how much of the linear scale is applied.
 * Default factor = 0.5 means halfway between no scale and full linear scale.
 */
export const moderateScale = (size: number, factor = 0.5): number =>
  Math.round(size + (scale(size) - size) * factor);

/** Returns true for phones narrower than iPhone SE (320 pt). */
export const isSmallDevice = SCREEN_WIDTH < 375;

/** Returns true for devices wider than 768 pt (iPads, foldables). */
export const isTablet = SCREEN_WIDTH >= 768;

/** Percentage of screen height. */
export const hp = (percent: number): number =>
  Math.round((SCREEN_HEIGHT * percent) / 100);

/** Percentage of screen width. */
export const wp = (percent: number): number =>
  Math.round((SCREEN_WIDTH * percent) / 100);

/**
 * Height of the floating custom tab bar (not counting safe-area insets).
 * Add `insets.bottom` from `useSafeAreaInsets` to get the full clearance:
 *   paddingBottom = TAB_BAR_HEIGHT + insets.bottom + extraGap
 */
export const TAB_BAR_HEIGHT = 72;

/**
 * Adaptive padding-bottom for gradient headers.
 * Taller phones get slightly more breathing room; short phones stay compact.
 */
export const HEADER_PADDING_BOTTOM = SCREEN_HEIGHT > 800 ? 48 : 32;

/**
 * Accessibility-aware font size.
 * Respects the OS large-text setting (PixelRatio.getFontScale) but caps
 * growth at 1.3× to prevent layout breakage in dense UI sections.
 *
 * Apply to: task titles, status badges, counter values.
 * Leave decorative labels (role pill, district banner) at fixed sizes.
 *
 * Usage:
 *   fontSize: accessibleFontSize(typography.fontSize.base)
 */
export const accessibleFontSize = (size: number): number =>
  Math.min(size * PixelRatio.getFontScale(), size * 1.3);
