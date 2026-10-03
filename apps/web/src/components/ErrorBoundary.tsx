import { Component, type ErrorInfo, type ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { variantForPathname, type RouteVariant } from '@/lib/appearance';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  variant?: RouteVariant;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export { variantForPathname };

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
