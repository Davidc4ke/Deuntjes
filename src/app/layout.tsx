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
  themeColor: '#1c2330',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Major+Mono+Display&family=UnifrakturCook:wght@700&family=Pirata+One&family=IM+Fell+English:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <QueryProvider>
          <div id="app-root">{children}</div>
          <div id="transport-portal" />
        </QueryProvider>
      </body>
    </html>
  );
}
