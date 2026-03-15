import type { Metadata, Viewport } from 'next';
import './globals.css';
import QueryProvider from '@/providers/QueryProvider';
import ThemeInitializer from '@/components/layout/ThemeInitializer';
import ToastProvider from '@/components/layout/ToastProvider';

export const metadata: Metadata = {
  title: 'T-Cardio Pro',
  description: 'Plateforme de suivi cardiovasculaire',
  manifest: undefined,
  icons: {
    icon: '/logo-T-Cardio.png',
    shortcut: '/logo-T-Cardio.png',
    apple: '/logo-T-Cardio.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'T-Cardio Pro',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark">
      <body className="antialiased" style={{ background: 'var(--cardio-900)', color: 'var(--text-primary)' }}>
        <ThemeInitializer />
        <QueryProvider>{children}</QueryProvider>
        <ToastProvider />
      </body>
    </html>
  );
}
