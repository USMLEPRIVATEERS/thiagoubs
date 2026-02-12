import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath: '/thiagoubs',
  images: {
    unoptimized: true,
  },
}

export default nextConfig
