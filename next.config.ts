import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/monitor',
        destination: '/agent',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
