/**
 * BabyGuide Design System - Typography
 * Using Inter font family for optimal readability
 */

export const Typography = {
  // Font Families
  fontFamily: {
    regular: 'System', // Will use system default (San Francisco on iOS, Roboto on Android)
    medium: 'System',
    bold: 'System',
  },

  // Font Sizes
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,      // Body text - optimal readability
    lg: 18,        // Key messages
    xl: 20,        // Section titles
    '2xl': 24,     // Screen titles
    '3xl': 30,
    '4xl': 36,
  },

  // Font Weights
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semiBold: '600' as const,
    bold: '700' as const,
  },

  // Line Heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Text Styles (commonly used combinations)
  styles: {
    // Headers
    h1: {
      fontSize: 24,
      fontWeight: '700' as const,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: 20,
      fontWeight: '700' as const,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: 18,
      fontWeight: '600' as const,
      lineHeight: 1.4,
    },

    // Body text
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      lineHeight: 1.5,
    },
    bodyMedium: {
      fontSize: 16,
      fontWeight: '500' as const,
      lineHeight: 1.5,
    },
    bodySmall: {
      fontSize: 14,
      fontWeight: '400' as const,
      lineHeight: 1.5,
    },

    // Key messages
    keyMessage: {
      fontSize: 18,
      fontWeight: '500' as const,
      lineHeight: 1.5,
    },

    // Captions
    caption: {
      fontSize: 12,
      fontWeight: '400' as const,
      lineHeight: 1.4,
    },

    // Button text
    button: {
      fontSize: 16,
      fontWeight: '600' as const,
      lineHeight: 1.2,
    },
  },
} as const;
