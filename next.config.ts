import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Next.js 15+ 穩定版不使用 experimental.turbopack.root
}

export default nextConfig
