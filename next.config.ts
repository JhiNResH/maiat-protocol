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
  async rewrites() {
    return [
      {
        source: '/demo',
        destination: 'https://playground-edk1zdudk-jhinreshs-projects.vercel.app/',
      },
      {
        source: '/demo/:path*',
        destination: 'https://playground-edk1zdudk-jhinreshs-projects.vercel.app/:path*',
      },
    ]
  },
}

export default nextConfig
