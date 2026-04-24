import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',

  turbopack: {
    root: __dirname,
  },

  images: {
    unoptimized: true,
  },

  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Chem IRL',
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'chemirl.app',
  },
};

export default nextConfig;
