import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  variant?: 'default' | 'portal';
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export function variantForPathname(pathname: string): 'default' | 'portal' {
  // The band portal (#891) is the same unauthenticated-token-route class as the client portal —
  // a stray crash there must not leak a stack trace to a dep either.
  return pathname.startsWith('/booking/') || pathname.startsWith('/band/') ? 'portal' : 'default';
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
    Sentry.captureException(error, { contexts: { react: { componentStack: info.componentStack } } });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isPortal = this.props.variant === 'portal';
      return (
        <div className="px-4 md:px-6 py-12 max-w-md">
          <p className="text-sm font-medium text-foreground mb-1">Something went wrong</p>
          <p className="text-sm text-muted mb-4">
            {isPortal ? 'Please try again, or contact us if the problem continues.' : (this.state.error?.message ?? 'An unexpected error occurred.')}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
