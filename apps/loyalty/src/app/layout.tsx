import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { buildDashboardThemeFlashScript } from '@queueplatform/frontend-core';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'QlessQ Loyalty',
  description: 'Patron CRM and loyalty management',
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
