import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { SearchOverlay } from '@/components/blog/SearchOverlay';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  weight: ['400', '500', '600', '700'],
});

export const viewport: Viewport = {
  themeColor: '#0A7F74',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://chemirl.app'),
  title: 'Chem IRL - Spend less time texting. Test chemistry IRL.',
  description:
    "Chemistry and vibe aren't on a screen. Meet face to face. Chem IRL gets you from match to meeting in days, not weeks.",
  openGraph: {
    title: 'Chem IRL - Spend less time texting. Test chemistry IRL.',
    description: "Chemistry and vibe aren't on a screen. Meet face to face.",
    url: 'https://chemirl.app',
    siteName: 'Chem IRL',
    type: 'website',
  },
  other: {
    'msapplication-TileColor': '#FFFBF7',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} antialiased`}
      >
        <div data-pagefind-ignore="all">
          <Nav />
        </div>
        <main>{children}</main>
        <div data-pagefind-ignore="all">
          <Footer />
        </div>
        <SearchOverlay />
      </body>
    </html>
  );
}
