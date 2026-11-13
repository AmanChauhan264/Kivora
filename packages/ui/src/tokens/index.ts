export * from './colors';
export * from './typography';
export * from './spacing';
export * from './radii';
export * from './shadows';

/**
 * Design system conventions and accessibility standards
 */
export const conventions = {
  /**
   * Accessibility Rule:
   * Baby Blue (#8EC5FF) has high luminance (~0.55). Never place white text on Baby Blue.
   * Buttons and badges with baby blue background MUST pair with Primary Brown (#3B2418) text.
   * This yields an 8.5:1 contrast ratio (exceeding WCAG AAA).
   */
  accessibility: {
    babyBlueBackgroundTextColor: '#3B2418',
    primaryBrownBackgroundTextColor: '#F2E8DA',
    creamBackgroundTextColor: '#3B2418',
  },
} as const;
