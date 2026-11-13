/**
 * Kivora Brand Color Tokens
 * Framework-agnostic design system color palette
 */
export const colors = {
  // Brand Core
  primaryBrown: '#3B2418',
  cream: '#F2E8DA',
  babyBlue: '#8EC5FF',

  // Brown Tonal Scale
  brown: {
    DEFAULT: '#3B2418',
    dark: '#26160E',
    light: '#5C3A27',
    muted: '#7A543E',
    surface: '#452B1E',
  },

  // Cream Tonal Scale (Dominant Backgrounds)
  creamScale: {
    DEFAULT: '#F2E8DA',
    light: '#FAF5ED',
    dark: '#E5D3BD',
    muted: '#D8C3A8',
  },

  // Baby Blue Tonal Scale (Interactive Accents & Highlights)
  blue: {
    DEFAULT: '#8EC5FF',
    dark: '#5AA7FF',
    light: '#BFE0FF',
    tint: '#E8F3FF',
    hover: '#7AB8FA',
  },

  // Sand Structural & Neutral Tones
  sand: {
    DEFAULT: '#E5D3BD',
    light: '#F0E5D4',
    dark: '#CBB296',
    border: '#DECABE',
  },

  // Status & Feedback Tokens
  status: {
    success: {
      DEFAULT: '#1B7A43',
      bg: '#EAF6EE',
      border: '#A7DFBA',
    },
    warning: {
      DEFAULT: '#C26700',
      bg: '#FFF5E8',
      border: '#FFD39B',
    },
    danger: {
      DEFAULT: '#BA1A1A',
      bg: '#FDF0F0',
      border: '#F8B4B4',
    },
    info: {
      DEFAULT: '#0D6EFD',
      bg: '#EEF5FF',
      border: '#B6D4FE',
    },
  },
} as const;

export type ColorToken = typeof colors;
