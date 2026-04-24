import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { SessionProvider } from 'next-auth/react';
import React from 'react';

import './globals.css';
import { auth } from '@/auth';
import { Toaster } from '@/components/ui/toaster';
import ThemeProvider from '@/context/Theme';

const inter = localFont({
  src: './fonts/Inter.ttf',
  variable: '--font-inter',
  weight: '100 200 300 400 500 600 700 900',
});

const spaceGrotesk = localFont({
  src: './fonts/SpaceGrotesk.ttf',
  variable: '--font-space-grotesk',
  weight: '300 400 500 700',
});

export const metadata: Metadata = {
  generator: 'Next.js',
  applicationName: 'Dev Overflow',
  referrer: 'origin-when-cross-origin',
  title: 'DevFlow',
  authors: [
    {
      name: 'Subik',
    },
  ],
  creator: 'Subik',
  publisher: 'Dev Overflow',
  formatDetection: {
    // This prevents browsers (especially on mobile) from automatically linking email addresses, phone numbers, or addresses in your content.
    email: false,
    address: false,
    telephone: false,
  },
  description:
    'A community-driven platform for asking and answering programming questions. Get help, share knowledge, and collaborate with developers from around the world. Explore topics in web development, mobile app development, algorithms, data structures, and more.',
  icons: {
    icon: '/images/site-logo.svg',
  },
  openGraph: {
    // This is for facebook or linkedin
    title: 'Dev Overflow | Ask & Answer Programming Questions',
    description:
      'Explore coding topics with help from the global dev community.',
    url: 'https://devoverflow.dev',
    siteName: 'Dev Overflow',
    images: [
      {
        url: '/images/og-banner.png',
        width: 1200,
        height: 630,
        alt: 'Dev Overflow OG Banner',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dev Overflow on Twitter',
    description: 'Get dev answers fast. Join the community.',
    images: ['/images/twitter-banner.png'],
    creator: '@adriandev',
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

const RootLayout: React.FC<{ children: React.ReactNode }> = async ({
  children,
}) => {
  const session = await auth();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          type="text/css"
          href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css"
        />
      </head>
      <SessionProvider session={session}>
        <body
          className={`${inter.className} ${spaceGrotesk.variable} antialiased`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
          <Toaster />
        </body>
      </SessionProvider>
    </html>
  );
};

export default RootLayout;
