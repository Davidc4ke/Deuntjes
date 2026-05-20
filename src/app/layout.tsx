import type { Metadata, Viewport } from 'next';
import './globals.css';
import { QueryProvider } from '@/components/app/QueryProvider';

export const metadata: Metadata = {
  title: 'Deuntjes',
  description: 'Private songwriting for 3-4 friends across time zones',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0b0b0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <div id="app-root">{children}</div>
          <div id="transport-portal" />
        </QueryProvider>
      </body>
    </html>
  );
}
