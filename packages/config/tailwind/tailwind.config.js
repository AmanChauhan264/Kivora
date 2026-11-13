/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        kivora: {
          brown: {
            DEFAULT: '#3B2418',
            dark: '#26160E',
            light: '#5C3A27',
            muted: '#7A543E',
          },
          cream: {
            DEFAULT: '#F2E8DA',
            light: '#FAF5ED',
            dark: '#E5D3BD',
            muted: '#D8C3A8',
          },
          blue: {
            DEFAULT: '#8EC5FF',
            dark: '#5AA7FF',
            light: '#BFE0FF',
            tint: '#E8F3FF',
          },
          sand: {
            DEFAULT: '#E5D3BD',
            light: '#F0E5D4',
            dark: '#CBB296',
          },
          status: {
            success: '#1B7A43',
            'success-bg': '#EAF6EE',
            warning: '#C26700',
            'warning-bg': '#FFF5E8',
            danger: '#BA1A1A',
            'danger-bg': '#FDF0F0',
            info: '#0D6EFD',
            'info-bg': '#EEF5FF',
          },
        },
      },
      fontFamily: {
        kivora: ['"Baloo Bhai 2"', 'sans-serif'],
      },
      borderRadius: {
        micro: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        'kivora-subtle': '0 2px 8px rgba(59, 36, 24, 0.06)',
        'kivora-floating': '0 8px 24px rgba(59, 36, 24, 0.10)',
        'kivora-overlay': '0 16px 48px rgba(59, 36, 24, 0.18)',
      },
    },
  },
  plugins: [],
};
