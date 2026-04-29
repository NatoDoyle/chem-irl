import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Chem IRL',
    short_name: 'Chem IRL',
    description:
      "Chemistry and vibe aren't on a screen. Meet face to face. Chem IRL gets you from match to meeting in days, not weeks.",
    start_url: '/',
    display: 'standalone',
    background_color: '#FFFBF7',
    theme_color: '#0A7F74',
    orientation: 'portrait',
    categories: ['lifestyle', 'social'],
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
