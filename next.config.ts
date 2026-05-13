import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@fluid/ui'],
  serverExternalPackages: ['@earendil-works/pi-ai', '@earendil-works/pi-agent-core'],
}

export default nextConfig
