/**
 * BabyGuide Design System
 * Central export for all theme constants
 */

export { Colors } from './colors';
export { Typography } from './typography';
export { Spacing, Sizing, Layout } from './spacing';

// Combined theme object for easy access
import { Colors } from './colors';
import { Typography } from './typography';
import { Spacing, Sizing, Layout } from './spacing';

export const Theme = {
  colors: Colors,
  typography: Typography,
  spacing: Spacing,
  sizing: Sizing,
  layout: Layout,

  // Shadow presets for elevation
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
    },
  },
} as const;

export default Theme;
