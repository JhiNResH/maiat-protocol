import type { NextConfig } from 'next'

// Note: Next.js 15+ removed eslint.ignoreDuringBuilds from NextConfig type.
// ESLint is now configured via eslint.config.mjs / .eslintrc.
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
