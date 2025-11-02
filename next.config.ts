import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' vercel-insights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: cdn.supabase.co",
              "connect-src 'self' *.supabase.co *.posthog.com *.vercel-insights.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'"
            ].join('; ')
          }
        ]
      }
    ];
  },
  
  // Image optimization
  images: {
    domains: ['cdn.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Performance optimizations
  experimental: {
    optimizeCss: true,
  },
  
  // Environment variables
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'Chem IRL',
    NEXT_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_DOMAIN || 'chemirl.app',
  },
  
  // Redirects for SEO
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
