import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useMe } from '@/lib/hooks/useMe';
import { Music2 } from 'lucide-react';
import { ProgressIndicator } from '@/features/onboarding/ProgressIndicator';

export default function OnboardingLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: profile, isLoading: profileLoading } = useMe();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/sign-in', { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (profile?.onboardingCompletedAt) {
      navigate('/admin', { replace: true });
    }
  }, [profile, navigate]);

  if (!isLoaded || !isSignedIn || profileLoading) return null;
  if (profile?.onboardingCompletedAt) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2 text-foreground">
          <Music2 className="size-5 text-primary" />
          <span className="font-wordmark font-semibold text-base">GigLoop</span>
        </div>
        <ProgressIndicator currentPath={location.pathname} />
      </header>

      <main className="flex-1 px-4 md:px-8 py-8 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
