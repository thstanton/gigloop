import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { Music2 } from 'lucide-react';

export function LaunchHero() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full text-center">
        <div className="flex items-center gap-2 text-primary">
          <Music2 className="size-8" />
          <span className="font-display text-3xl font-semibold text-foreground">GigMan</span>
        </div>

        <p className="text-base text-muted">
          The booking manager built for working musicians.
        </p>

        <div className="flex flex-col gap-3 w-full mt-2">
          <a
            href="/sign-up"
            className="w-full rounded-lg bg-primary text-primary-foreground text-base font-medium py-3 text-center transition-opacity hover:opacity-90"
          >
            Get started free
          </a>
          <a
            href="/sign-in"
            className="w-full rounded-lg border border-border text-foreground text-base font-medium py-3 text-center transition-colors hover:bg-muted/30"
          >
            Sign in
          </a>
        </div>
      </div>
    </main>
  );
}

export default function HomePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate('/admin', { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded || isSignedIn) return null;

  return <LaunchHero />;
}
