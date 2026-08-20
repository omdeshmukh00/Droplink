import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { PageTransition } from '@/components/PageTransition';
import { InstallPrompt, PWAStatus } from '@/components/pwa';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'DropLink - Instant Secure P2P File Sharing',
  description: 'Transfer files between any devices using only your browser. No login, no installation, no cables.',
  keywords: ['file sharing', 'p2p file transfer', 'secure transfer', 'QR code share', 'PWA', 'DropLink'],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/DropLink-logo.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DropLink',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[#f7f9fb] text-slate-900 font-sans max-w-full overflow-x-clip">
        <PWAStatus />
        <Navbar />
        <main className="flex-grow flex flex-col items-center justify-center py-2 sm:py-4 px-4 sm:px-6 w-full max-w-7xl mx-auto overflow-x-clip">
          <PageTransition>{children}</PageTransition>
        </main>
        <InstallPrompt />
        <Footer />
      </body>
    </html>
  );
}

