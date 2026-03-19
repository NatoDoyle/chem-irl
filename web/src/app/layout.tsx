import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  themeColor: '#0A7F74',
};

export const metadata: Metadata = {
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
