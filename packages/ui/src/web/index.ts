import { colors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';

/**
 * Common style maps for web application elements
 * Consumed by Seller and Admin Next.js web applications
 */
export const webStylePresets = {
  button: {
    primary: {
      backgroundColor: colors.babyBlue,
      color: colors.primaryBrown,
      borderRadius: radii.sm,
      fontWeight: '600',
    },
    secondary: {
      backgroundColor: colors.creamScale.light,
      color: colors.primaryBrown,
      border: `1px solid ${colors.sand.DEFAULT}`,
      borderRadius: radii.sm,
      fontWeight: '500',
    },
    danger: {
      backgroundColor: colors.status.danger.bg,
      color: colors.status.danger.DEFAULT,
      border: `1px solid ${colors.status.danger.border}`,
      borderRadius: radii.sm,
      fontWeight: '600',
    },
  },
  card: {
    base: {
      backgroundColor: colors.creamScale.light,
      border: `1px solid ${colors.sand.DEFAULT}`,
      borderRadius: radii.md,
      boxShadow: shadows.subtle,
    },
  },
} as const;
