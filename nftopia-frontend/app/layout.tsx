import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ['system-ui', 'arial'],
});

export const metadata = {
  title: 'NFTopia - NFT Marketplace',
  description: 'Discover, collect, and trade unique NFTs on the most innovative blockchain marketplace',
  manifest: '/manifest.json',
  themeColor: '#181359',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NFTopia',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/nftopia-03.png', sizes: 'any', type: 'image/png' },
    ],
    apple: [
      { url: '/nftopia-03.png', sizes: 'any', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'NFTopia',
    title: 'NFTopia - NFT Marketplace',
    description: 'Discover, collect, and trade unique NFTs on the most innovative blockchain marketplace',
    images: ['/nftopia-03.png'],
  },
  twitter: {
    card: 'summary',
    title: 'NFTopia - NFT Marketplace',
    description: 'Discover, collect, and trade unique NFTs on the most innovative blockchain marketplace',
    images: ['/nftopia-03.png'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="mt-0 pt-0 border-t-0">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, minimum-scale=1, viewport-fit=cover"
        />
        <meta name="theme-color" content="#181359" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="NFTopia" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#181359" />
        <meta name="msapplication-tap-highlight" content="no" />
        
        {/* Favicon using only PNG */}
        <link rel="icon" href="/nftopia-03.png" type="image/png" />
        <link rel="shortcut icon" href="/nftopia-03.png" type="image/png" />
        <link rel="apple-touch-icon" href="/nftopia-03.png" />
        
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        
        {/* Microsoft Tiles */}
        <meta name="msapplication-TileImage" content="/nftopia-03.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
