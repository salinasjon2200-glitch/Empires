import type { Metadata } from 'next';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import FullscreenButton from '@/components/FullscreenButton';

export const metadata: Metadata = {
  title: 'EMPIRES — Grand Strategy',
  description: 'A satirical multiplayer grand strategy game powered by AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark-military">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <FullscreenButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
