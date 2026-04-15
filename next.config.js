/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
  // Don't attempt to statically render API routes
  output: undefined,
}

module.exports = nextConfig
