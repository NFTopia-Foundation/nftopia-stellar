// components/ErrorBoundary.tsx
import React, { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    return this.state.hasError ? (
      <div className="error-fallback">Component failed to load</div>
    ) : (
      this.props.children
    );
  }
}

export default ErrorBoundary;