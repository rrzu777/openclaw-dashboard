import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone for easier deployment
  output: 'standalone',
  
  // Optimize for production
  poweredByHeader: false,
  
  // Image optimization
  images: {
    unoptimized: true,
  },
  
  // Ensure static assets are served correctly
  assetPrefix: process.env.ASSET_PREFIX || '',
};

export default nextConfig;
