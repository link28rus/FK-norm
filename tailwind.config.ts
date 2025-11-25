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
      },
      textColor: {
        'heading': 'var(--color-text-heading)',  // #000000 - черный для заголовков
        'primary': 'var(--color-text-primary)',
        'secondary': 'var(--color-text-secondary)',
        'muted': 'var(--color-text-muted)',
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
    },
  },
  plugins: [],
}
export default config




