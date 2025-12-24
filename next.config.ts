import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for marketing site
  output: 'export',
  
  // Image optimization (unoptimized for static export)
  images: {
    unoptimized: true,
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Chem IRL',
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'chemirl.app',
  },
  
  // Exclude API routes from static export (they'll be deployed separately)
  // Note: Webhooks and cron jobs should be deployed as separate serverless functions
};

export default nextConfig;
