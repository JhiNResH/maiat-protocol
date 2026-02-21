import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['DM Mono', 'SF Mono', 'monospace'],
      },
      colors: {
        maat: {
          primary: '#572f61',
          bg: {
            primary: '#1a0e2e',
            secondary: '#24123d',
            tertiary: '#2d164d',
          },
          border: {
            DEFAULT: '#2d164d',
            light: '#572f61',
          },
          text: {
            primary: '#d9d4e8',
            secondary: '#adadb0',
            muted: '#6b6b70',
          },
          accent: {
            purple: '#d9d4e8',
            green: '#22c55e',
            orange: '#ff8a4c',
            red: '#ef4444',
          },
        },
      },
    },
  },
  plugins: [],
}
export default config
