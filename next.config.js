/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude test files from production build
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: false,
  },
  // Exclude test directories from webpack
  webpack: (config, { isServer }) => {
    // Exclude test files from being processed
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      exclude: /node_modules/,
      use: 'ignore-loader',
    });
    
    return config;
  },
};

module.exports = nextConfig;
