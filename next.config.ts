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
      {
        source: '/defi/:name/:address',
        destination: '/agent/:name/:address',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
