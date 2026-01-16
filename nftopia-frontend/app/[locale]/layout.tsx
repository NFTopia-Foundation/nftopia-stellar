"use client";

import { Inter } from "next/font/google";
import { Navbar } from "@/components/navbar";
import "../globals.css";
import Footer from "@/components/Footer";
import { CircuitBackground } from "@/components/circuit-background";
import { WebVitals } from "@/components/web-vitals";
import { StarknetProvider } from "@/components/StarknetProvider";
import { StoreProvider } from "@/lib/stores/store-provider";
import { Toast } from "@/components/ui/toast";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";
import { ClientBody } from "@/components/layout/ClientBody";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: {
    locale: string;
  };
}

export default function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const pathname = usePathname();
  const { t, locales } = useTranslation();
  const isAuthPage = pathname?.includes("/auth/");
  const isCreatorDashboard = pathname?.includes("/creator-dashboard");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const currentPath = pathname?.replace(/^\/[a-z]{2}/, "") || "";

  // Generate hreflang URLs dynamically based on available locales
  const hreflangUrls = locales.reduce((acc, loc) => {
    acc[loc] = `${baseUrl}/${loc}${currentPath}`;
    return acc;
  }, {} as Record<string, string>);

  return (
    <html lang={params.locale}>
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

        <title>{t("seo.title")}</title>
        <meta name="description" content={t("seo.description")} />
        <meta name="keywords" content={t("seo.keywords")} />

        {/* Hreflang Tags */}
        {Object.entries(hreflangUrls).map(([lang, url]) => (
          <link key={lang} rel="alternate" hrefLang={lang} href={url} />
        ))}
        <link rel="alternate" hrefLang="x-default" href={hreflangUrls.en} />

        <link rel="icon" href="/nftopia-03.svg" id="favicon" />

        <meta property="og:title" content={t("seo.title")} />
        <meta property="og:description" content={t("seo.description")} />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content={params.locale} />
        {locales
          .filter((loc) => loc !== params.locale)
          .map((alt) => (
            <meta key={alt} property="og:locale:alternate" content={alt} />
          ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={t("seo.title")} />
        <meta name="twitter:description" content={t("seo.description")} />
      </head>
      <body className={inter.className}>
        <StoreProvider>
          <StarknetProvider>
            {isCreatorDashboard ? (
              <ClientBody>
                <WebVitals />
                {children}
              </ClientBody>
            ) : (
              <div className="min-h-screen bg-gradient-to-b from-[#0f0c38] via-[#181359] to-[#241970] text-white relative contain-layout">
                <main className="relative z-10 pt-16 md:pt-20">
                  {!isAuthPage && <Navbar />}
                  {!isAuthPage && <CircuitBackground />}
                  <WebVitals />
                  <div className="container-responsive py-4 md:py-8">
                    {children}
                  </div>
                  {!isAuthPage && <Footer />}
                </main>
              </div>
            )}
            <Toast />
          </StarknetProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
