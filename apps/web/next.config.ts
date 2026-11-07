import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@repo/ai', '@repo/config', '@repo/core', '@repo/data', '@repo/design', '@repo/i18n'],
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.openfoodfacts.org' }],
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
