"use client";

import React from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { telemetry } from "@/lib/telemetry";

interface WidgetErrorBoundaryProps {
  children: React.ReactNode;
  widgetName: string;
  onRetry?: () => void | Promise<void>;
  resetKeys?: any[];
}

export function WidgetErrorBoundary({
  children,
  widgetName,
  onRetry,
  resetKeys,
}: WidgetErrorBoundaryProps) {
  
  const handleError = (error: Error, info: React.ErrorInfo) => {
    // Log the error to telemetry with required fields that pass allowlist
    telemetry.track("creator_dashboard_error", {
      error_message: error.message.slice(0, 200), // Ensure it stays within standard size limit
      component_name: widgetName,
      surface: "creator-dashboard",
      status: "widget_crashed",
    });
    console.error(`[Telemetry] Widget [${widgetName}] render error caught:`, error, info);
  };

  const handleReset = () => {
    if (onRetry) {
      onRetry();
    }
  };

  const WidgetFallback = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => {
    const [isRetrying, setIsRetrying] = React.useState(false);

    const handleResetClick = async () => {
      setIsRetrying(true);
      try {
        if (onRetry) {
          await onRetry();
        }
        resetErrorBoundary();
      } catch (err) {
        console.error("Widget retry failed:", err);
      } finally {
        setIsRetrying(false);
      }
    };

    return (
      <div className="flex flex-col items-center justify-center p-6 text-center bg-card border border-border/80 rounded-xl min-h-[160px] shadow-sm backdrop-blur-sm relative">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/10 to-purple-500/10 rounded-xl blur-sm -z-10" />
        <AlertCircle className="w-8 h-8 text-red-400 mb-2" />
        <h4 className="text-sm font-bold text-foreground mb-1">
          Failed to load {widgetName}
        </h4>
        <p className="text-xs text-muted-foreground max-w-xs mb-4">
          There was a rendering issue inside this component.
        </p>
        <Button
          onClick={handleResetClick}
          disabled={isRetrying}
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 min-h-0 min-w-0 px-3 py-1 bg-purple-500/5 border-purple-500/25 hover:border-purple-500/40 text-purple-400 hover:bg-purple-500/10 active:scale-95 text-xs font-semibold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? "animate-spin" : ""}`} />
          <span>{isRetrying ? "Retrying..." : "Retry"}</span>
        </Button>
      </div>
    );
  };

  return (
    <ErrorBoundary
      FallbackComponent={WidgetFallback}
      onError={handleError}
      onReset={handleReset}
      resetKeys={resetKeys}
    >
      {children}
    </ErrorBoundary>
  );
}
