/**
 * Kivora Border Radius Tokens
 */
export const radii = {
  none: '0px',
  micro: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
} as const;

export type RadiiToken = typeof radii;
