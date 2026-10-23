import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AlertPulse - Google Alerts Mobile App',
  description: 'Google Alertの情報をスマホから快適に閲覧・収集・管理できるモバイルアプリ風Web App',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AlertPulse',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased select-none touch-manipulation">
        {children}
      </body>
    </html>
  );
}
