import type { Metadata } from 'next';
import './globals.css';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'Pump Fun SDK',
  description:
    'Community TypeScript SDK for the Pump protocol on Solana — create, buy, sell, and migrate tokens with bonding curve pricing, AMM migration, and fee sharing.',
  keywords: [
    'pump fun',
    'pump sdk',
    'solana',
    'token launchpad',
    'bonding curve',
    'AMM',
    'cryptocurrency',
    'blockchain',
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#9945FF" />
      </head>
      <body className="min-h-screen bg-black text-white antialiased dark:bg-black dark:text-white">
        <div className="relative min-h-screen flex flex-col">
          {/* Grid background */}
          <div className="fixed inset-0 bg-grid opacity-100 pointer-events-none" />
          <div className="fixed inset-0 bg-gradient-to-b from-black via-transparent to-black pointer-events-none" />

          <ThemeProvider>
            <Navigation />
            <main className="relative z-10 flex-1">{children}</main>
            <Footer />
            <ServiceWorkerRegistrar />
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
