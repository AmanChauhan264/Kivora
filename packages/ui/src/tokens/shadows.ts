/**
 * Kivora Elevation & Shadow Tokens
 */
export const shadows = {
  subtle: '0 2px 8px rgba(59, 36, 24, 0.06)',
  card: '0 4px 12px rgba(59, 36, 24, 0.08)',
  floating: '0 8px 24px rgba(59, 36, 24, 0.10)',
  overlay: '0 16px 48px rgba(59, 36, 24, 0.18)',
} as const;

export type ShadowToken = typeof shadows;
