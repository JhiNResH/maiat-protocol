import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: '/defi/:name/:address',
        destination: '/agent/:name/:address',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
