"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, WifiOff, RefreshCw, ShoppingBag, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useLocalizedRoute } from "@/lib/routing";

interface DashboardErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function DashboardErrorFallback({
  error,
  resetErrorBoundary,
}: DashboardErrorFallbackProps) {
  const { t } = useTranslation();
  const localizedRoute = useLocalizedRoute();
  const [isOffline, setIsOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Network connection monitor
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOffline(!navigator.onLine);

      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    // Give a brief visual feedback before executing reset
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      resetErrorBoundary();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4 py-12">
      <div className="relative bg-card/60 border border-border/80 text-card-foreground rounded-2xl p-8 max-w-md w-full shadow-2xl backdrop-blur-lg transition-all duration-300">
        
        {/* Subtle decorative purple glow background */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-15 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-tilt -z-10" />

        <div className="flex flex-col items-center text-center">
          
          {/* Animated Header Icon */}
          <div className="mb-6 relative flex items-center justify-center">
            {isOffline ? (
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDuration: '3s' }} />
                <div className="p-4 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <WifiOff className="h-10 w-10" />
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-purple-500/25 animate-ping" style={{ animationDuration: '3.5s' }} />
                <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <AlertCircle className="h-10 w-10" />
                </div>
              </div>
            )}
          </div>

          {/* Heading */}
          <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3 font-sans">
            {isOffline 
              ? (t("creatorDashboard.errorOfflineTitle") || "No Internet Connection") 
              : (t("creatorDashboard.errorFallbackTitle") || "Unable to Load Dashboard")}
          </h2>

          {/* Subtext description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">
            {isOffline
              ? (t("creatorDashboard.errorOfflineMessage") || "It looks like you're offline. Please check your network connection and try again.")
              : (t("creatorDashboard.errorFallbackMessage") || "Something went wrong while rendering the dashboard. We have recorded this issue and are working to resolve it.")}
          </p>

          {/* Details toggle (shows error trace if not offline, helpful for debugging dev errors) */}
          {!isOffline && process.env.NODE_ENV !== "production" && (
            <div className="w-full text-left mb-6 p-3 bg-muted/50 rounded-lg border border-border/60 overflow-x-auto max-h-36 text-xs font-mono text-muted-foreground">
              <span className="font-semibold text-foreground">Error Details:</span>
              <p className="mt-1">{error.message || "Unknown rendering exception"}</p>
            </div>
          )}

          {/* Main Action Buttons */}
          <div className="flex flex-col gap-3 w-full">
            <Button
              onClick={handleRetry}
              disabled={isRetrying}
              variant="cosmic"
              className="w-full font-bold flex items-center justify-center gap-2 group"
            >
              <RefreshCw className={`h-4 w-4 transition-transform duration-500 ${isRetrying ? "animate-spin" : "group-hover:rotate-180"}`} />
              <span>{isRetrying ? "Reloading Components..." : "Retry Loading"}</span>
            </Button>

            <Link href={localizedRoute("/marketplace")} passHref className="w-full">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2 border-border/80 hover:border-purple-500/50 hover:bg-purple-500/5">
                <ShoppingBag className="h-4 w-4 text-purple-400" />
                <span>Go to Marketplace</span>
              </Button>
            </Link>
          </div>

          {/* Support Link */}
          <div className="mt-6 border-t border-border/60 pt-4 w-full flex justify-center">
            <a 
              href="https://discord.gg/nftopia" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-purple-400 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Need help? Contact Support on Discord</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
