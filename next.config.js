/** @type {import('next').NextConfig} */
const nextConfig = {
  // API routes will be handled by Express server.js
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*', // Handled by api/server.js
      },
    ];
  },
};

module.exports = nextConfig;

