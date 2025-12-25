import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for marketing site
  output: 'export',
  
  // Pin Turbopack root to web/ directory to avoid lockfile warning
  // (Turbopack infers workspace root when it sees multiple lockfiles in repo)
  turbopack: {
    root: __dirname,
  },
  
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
