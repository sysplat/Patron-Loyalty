import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { buildDashboardThemeFlashScript } from '@queueplatform/frontend-core';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QlessQ Loyalty',
  description: 'Patron CRM and loyalty management',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Patron Loyalty',
    statusBarStyle: 'black-translucent',
  },
};

const themeFlashScript = buildDashboardThemeFlashScript({
  kind: 'exclude-paths',
  paths: ['/login'],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeFlashScript }} />
      </head>
      <body
        className={`${inter.className} bg-background min-h-screen antialiased`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
