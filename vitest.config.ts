import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
    globals: true,
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@/': path.resolve(__dirname, './src/'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
