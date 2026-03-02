import type { Config } from 'tailwindcss';
import COLORS from './src/lib/colors';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-roboto)', 'ui-sans-serif', 'system-ui'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        'hapus-dark-bg': COLORS.darkBackground,
        'hapus-dark-card': COLORS.darkCard,
        'hapus-dark-text': COLORS.darkText,
        'hapus-dark-muted': COLORS.darkMutedText,
        'hapus-dark-border': COLORS.darkBorder,

        'hapus-light-bg': COLORS.lightBackground,
        'hapus-light-card': COLORS.lightCard,
        'hapus-light-text': COLORS.lightText,
        'hapus-light-muted': COLORS.lightMutedText,
        'hapus-light-border': COLORS.lightBorder,

        'hapus-primary': COLORS.primary,
        'hapus-secondary': COLORS.secondary,
        'hapus-accent': COLORS.accent,
        'hapus-danger': COLORS.danger,
        'hapus-success': COLORS.success,
      },
    },
  },
  darkMode: 'class',
  plugins: [],
};

export default config;
