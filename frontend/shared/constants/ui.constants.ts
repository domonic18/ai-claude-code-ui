/**
 * UI Constants
 *
 * UI-related constants and configuration.
 */

/**
 * Breakpoints for responsive design
 */
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

/**
 * Z-index layers
 */
export const Z_INDEX = {
  BASE: 0,
  DROPDOWN: 1000,
  STICKY: 1100,
  FIXED: 1200,
  MODAL_BACKDROP: 1300,
  MODAL: 1400,
  POPOVER: 1500,
  TOOLTIP: 1600,
  NOTIFICATION: 1700,
} as const;

/**
 * Animation durations (in milliseconds)
 */
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 300,
  SLOW: 500,
} as const;

/**
 * Transition timing functions
 */
export const TIMING_FUNCTION = {
  LINEAR: 'linear',
  EASE: 'ease',
  EASE_IN: 'ease-in',
  EASE_OUT: 'ease-out',
  EASE_IN_OUT: 'ease-in-out',
} as const;

/**
 * Common icon sizes (in pixels)
 */
export const ICON_SIZES = {
  XS: 12,
  SM: 16,
  MD: 20,
  LG: 24,
  XL: 32,
  '2XL': 48,
} as const;

/**
 * Border radius values
 */
export const BORDER_RADIUS = {
  NONE: '0',
  SM: '0.125rem',
  MD: '0.375rem',
  LG: '0.5rem',
  XL: '0.75rem',
  FULL: '9999px',
} as const;

/**
 * Spacing scale
 */
export const SPACING = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const;

/**
 * Font sizes
 */
export const FONT_SIZES = {
  XS: '0.75rem',
  SM: '0.875rem',
  MD: '1rem',
  LG: '1.125rem',
  XL: '1.25rem',
  '2XL': '1.5rem',
  '3XL': '1.875rem',
  '4XL': '2.25rem',
} as const;

/**
 * Toast notification types
 */
export const TOAST_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

/**
 * Toast durations (in milliseconds)
 */
export const TOAST_DURATIONS = {
  SHORT: 3000,
  MEDIUM: 5000,
  LONG: 10000,
  PERSISTENT: -1,
} as const;
