/**
 * BabyGuide Design System - Spacing & Sizing
 * Consistent spacing system for layout
 */

export const Spacing = {
  // Base spacing unit: 4px
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
  '4xl': 64,

  // Specific use cases
  screenPadding: 16,
  cardPadding: 16,
  sectionSpacing: 24,
  buttonPadding: 12,
} as const;

export const Sizing = {
  // Touch targets (minimum 44x44 for accessibility)
  minTouchTarget: 44,

  // Common sizes
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
  },

  // Button heights
  button: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },

  // Border radius
  borderRadius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },

  // Avatar sizes
  avatar: {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  },
} as const;

export const Layout = {
  // Screen dimensions (will be overridden by actual device dimensions)
  screenWidth: 375,  // Default iPhone size
  screenHeight: 812,

  // Tab bar
  tabBarHeight: 60,

  // Header
  headerHeight: 56,
} as const;
