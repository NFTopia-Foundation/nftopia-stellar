"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  FallbackComponent?: React.ComponentType<{ error: Error; resetErrorBoundary: () => void }>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: any[];
  componentName?: string;
  showRetry?: boolean;
  showHome?: boolean;
  showReport?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName = "UnknownComponent", onError } = this.props;
    
    // Log to console
    console.error(`Error in ${componentName}:`, error);
    console.error("Component stack:", errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Log to telemetry if available
    if (typeof window !== "undefined") {
      try {
        const telemetry = (window as any).__TELEMETRY__;
        if (telemetry?.captureException) {
          telemetry.captureException(error, {
            tags: { component: componentName },
            extra: { componentStack: errorInfo.componentStack },
          });
        }
      } catch (telemetryError) {
        // Silently fail if telemetry not available
      }
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && this.props.resetKeys) {
      if (this.checkKeysChange(prevProps.resetKeys, this.props.resetKeys)) {
        this.resetErrorBoundary();
      }
    }
  }

  private checkKeysChange(prevKeys: any[] | undefined, nextKeys: any[] | undefined): boolean {
    if (!prevKeys || !nextKeys) return true;
    if (prevKeys.length !== nextKeys.length) return true;
    for (let i = 0; i < prevKeys.length; i++) {
      if (prevKeys[i] !== nextKeys[i]) return true;
    }
    return false;
  }

  resetErrorBoundary = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleRetry = (): void => {
    this.resetErrorBoundary();
  };

  handleReport = (): void => {
    const { error, errorInfo } = this.state;
    const { componentName = "UnknownComponent" } = this.props;
    
    const report = {
      component: componentName,
      error: error?.toString(),
      stack: error?.stack,
      componentStack: errorInfo?.componentStack,
      url: typeof window !== "undefined" ? window.location.href : "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      timestamp: new Date().toISOString(),
    };

    console.error("Error Report:", report);

    if (typeof window !== "undefined") {
      const subject = encodeURIComponent(`Error Report: ${componentName}`);
      const body = encodeURIComponent(
        `Error: ${error?.toString()}\n\nStack: ${error?.stack}\n\nComponent Stack: ${errorInfo?.componentStack}\n\nURL: ${report.url}`
      );
      window.open(`mailto:support@nftopia.io?subject=${subject}&body=${body}`);
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { 
      children, 
      fallback, 
      FallbackComponent,
      showRetry = true, 
      showHome = true, 
      showReport = true 
    } = this.props;

    if (!hasError) {
      return children;
    }

    if (error && FallbackComponent) {
      return <FallbackComponent error={error} resetErrorBoundary={this.resetErrorBoundary} />;
    }

    if (fallback !== undefined) {
      return fallback;
    }

    // Default styled fallback UI
    return (
      <div className="min-h-[400px] flex items-center justify-center p-6 bg-gradient-to-br from-[#0f0f1a] to-[#1a1a3e] rounded-xl border border-red-900/30">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-red-900/20 rounded-full border border-red-900/30">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-400 mb-6">
            {error?.message || "An unexpected error occurred while rendering this component."}
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            {showRetry && (
              <Button
                onClick={this.handleRetry}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
            
            {showHome && (
              <Link href="/" legacyBehavior>
                <a>
                  <Button variant="outline" className="border-purple-600/50 text-purple-400 hover:bg-purple-600/20">
                    <Home className="mr-2 h-4 w-4" />
                    Go Home
                  </Button>
                </a>
              </Link>
            )}
            
            {showReport && (
              <Button
                onClick={this.handleReport}
                variant="outline"
                className="border-gray-600 text-gray-400 hover:bg-gray-800/50"
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                Report Issue
              </Button>
            )}
          </div>

          {process.env.NODE_ENV === "development" && error?.stack && (
            <details className="mt-6 text-left">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-400">
                Error Details
              </summary>
              <pre className="mt-2 p-4 bg-black/50 rounded-lg text-xs text-gray-400 overflow-auto max-h-[200px]">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
