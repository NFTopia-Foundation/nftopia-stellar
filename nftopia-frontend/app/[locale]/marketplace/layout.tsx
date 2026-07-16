import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

interface MarketplaceLayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export default function MarketplaceLayout({ children, params }: MarketplaceLayoutProps) {
  return (
    <ErrorBoundary componentName="MarketplaceLayout" showRetry={true} showHome={true}>
      <main className="min-h-screen bg-[#0f0f1a]">
        {children}
      </main>
    </ErrorBoundary>
  );
}