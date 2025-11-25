import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Brand colors
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          light: 'var(--color-primary-light)',
          text: 'var(--color-primary-text)',
        },
        // Status colors
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
          text: 'var(--color-success-text)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          light: 'var(--color-danger-light)',
          text: 'var(--color-danger-text)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
          text: 'var(--color-warning-text)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          light: 'var(--color-info-light)',
          text: 'var(--color-info-text)',
        },
        // Neutral colors
        neutral: {
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          500: 'var(--color-neutral-500)',
          700: 'var(--color-neutral-700)',
          900: 'var(--color-neutral-900)',
        },
        // Muted background
        muted: {
          DEFAULT: 'var(--color-neutral-100)',
          foreground: 'var(--color-text-muted)',
        },
      },
      textColor: {
        'heading': 'var(--color-text-heading)',  // #000000 - черный для заголовков
        'primary': 'var(--color-text-primary)',
        'secondary': 'var(--color-text-secondary)',
        'muted': 'var(--color-text-muted)',
      },
      backgroundColor: {
        'muted': 'var(--color-neutral-100)',
      },
      fontFamily: {
        base: ['var(--font-family-base)'],
        sans: ['var(--font-family-base)'],
      },
      fontSize: {
        'title': 'var(--font-size-title)',
        'subtitle': 'var(--font-size-subtitle)',
        'body': 'var(--font-size-body)',
      },
      fontWeight: {
        'normal': 'var(--font-weight-normal)',
        'medium': 'var(--font-weight-medium)',
        'semibold': 'var(--font-weight-semibold)',
        'bold': 'var(--font-weight-bold)',
      },
      borderRadius: {
        'sm': 'var(--radius-sm)',
        'md': 'var(--radius-md)',
        'lg': 'var(--radius-lg)',
        'xl': 'var(--radius-xl)',
        'full': 'var(--radius-full)',
      },
      boxShadow: {
        'sm': 'var(--shadow-sm)',
        'md': 'var(--shadow-md)',
        'lg': 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}
export default config




