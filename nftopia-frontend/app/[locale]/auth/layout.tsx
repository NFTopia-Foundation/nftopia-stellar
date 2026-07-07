import { ReactNode } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

interface AuthLayoutProps {
  children: ReactNode;
  params: { locale: string };
}

export default function AuthLayout({ children, params }: AuthLayoutProps) {
  return (
    <ErrorBoundary componentName="AuthLayout" showRetry={true} showHome={true}>
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center">
        {children}
      </div>
    </ErrorBoundary>
  );
}