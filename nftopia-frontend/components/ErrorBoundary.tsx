// components/ErrorBoundary.tsx
import React, { ReactNode, Component, ErrorInfo } from 'react';

export interface FallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  FallbackComponent?: React.ComponentType<FallbackProps>;
  onError?: (error: Error, info: ErrorInfo) => void;
  onReset?: () => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
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

  resetErrorBoundary = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, FallbackComponent } = this.props;

    if (hasError && error) {
      if (FallbackComponent) {
        return <FallbackComponent error={error} resetErrorBoundary={this.resetErrorBoundary} />;
      }
      if (fallback !== undefined) {
        return fallback;
      }
      return (
        <div className="error-fallback p-6 text-center text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl">
          Component failed to load
        </div>
      );
    }

    return children;
  }
}

export default ErrorBoundary;