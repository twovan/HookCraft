/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.optimization.splitChunks = false;
    }
    return config;
  },
}
module.exports = nextConfig
