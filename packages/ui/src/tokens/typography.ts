/**
 * Kivora Typography Tokens
 * Primary typeface: Baloo Bhai 2
 */
export const typography = {
  fontFamily: {
    primary: '"Baloo Bhai 2", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: '"Baloo Bhai 2", cursive',
  },
  weights: {
    regular: 400,
    medium: 500,
    semiBold: 600,
    bold: 700,
    extraBold: 800,
  },
  sizes: {
    xs: { fontSize: '11px', lineHeight: '15px' },
    sm: { fontSize: '13px', lineHeight: '18px' },
    base: { fontSize: '15px', lineHeight: '22px' },
    md: { fontSize: '18px', lineHeight: '24px' },
    lg: { fontSize: '20px', lineHeight: '28px' },
    xl: { fontSize: '24px', lineHeight: '32px' },
    display2: { fontSize: '30px', lineHeight: '38px' },
    display1: { fontSize: '36px', lineHeight: '44px' },
  },
} as const;

export type TypographyToken = typeof typography;
