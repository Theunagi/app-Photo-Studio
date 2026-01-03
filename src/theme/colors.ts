/**
 * BabyGuide Design System - Colors
 * Based on PRD specifications for calming, reassuring interface
 */

export const Colors = {
  // Primary Colors
  primary: '#5B9BD5',      // Blue doux (trust, serenity)
  secondary: '#A8D08D',    // Green mint (growth, nature)

  // Alert System Colors
  success: '#92D050',      // Green - Everything is fine
  warning: '#FFC000',      // Orange - Monitor
  danger: '#FF5050',       // Red - Consult now

  // Neutral Colors
  background: '#FAFAFA',   // Off-white
  surface: '#FFFFFF',      // Pure white for cards
  surfaceAlt: '#F0F0F0',   // Light grey

  // Text Colors
  text: '#333333',         // Dark grey (never pure black)
  textSecondary: '#666666',
  textLight: '#999999',

  // Module-specific accent colors
  feeding: '#5B9BD5',      // Blue
  diaper: '#FFD966',       // Soft yellow
  vomiting: '#FFA07A',     // Light coral
  sleep: '#9B9BD5',        // Lavender
  diversification: '#A8D08D', // Green
  allergens: '#FFB347',    // Orange
  growth: '#87CEEB',       // Sky blue

  // Semantic Colors
  info: '#5B9BD5',
  transparent: 'transparent',

  // Gradient colors for charts
  gradientStart: '#5B9BD5',
  gradientEnd: '#A8D08D',
} as const;

export type ColorKey = keyof typeof Colors;
