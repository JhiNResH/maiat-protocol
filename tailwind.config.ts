import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        page: 'var(--bg-page)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        'border-default': 'var(--border-default)',
        'border-subtle': 'var(--border-subtle)',
        gold: 'var(--primary-gold)',
        'gold-light': 'var(--primary-gold-light)',
        accent: 'var(--accent-blue)',
        'accent-dim': 'var(--accent-blue-dim)',
        turquoise: 'var(--secondary-turquoise)',
        emerald: 'var(--success-emerald)',
        crimson: 'var(--danger-crimson)',
        amber: 'var(--warning-amber)',
        'txt-primary': 'var(--text-primary)',
        'txt-secondary': 'var(--text-secondary)',
        'txt-muted': 'var(--text-muted)',
      },
    },
  },
  plugins: [],
}
export default config
