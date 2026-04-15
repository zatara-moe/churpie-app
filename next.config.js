/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverActions: { allowedOrigins: ['churpie.me', 'localhost:3000'] } },
}
module.exports = nextConfig
