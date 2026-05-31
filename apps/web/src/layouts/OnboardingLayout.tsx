import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Music2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types/api';

const STEPS = [
  { label: 'Profile', path: '/onboarding/profile' },
  { label: 'Songs', path: '/onboarding/songs' },
  { label: 'Packages', path: '/onboarding/packages' },
  { label: 'Checklist', path: '/onboarding/checklist' },
];

function stepCircleClass(isActive: boolean, isDone: boolean): string {
  if (isActive) return 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors bg-primary text-primary-foreground';
  if (isDone) return 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors bg-primary/20 text-primary';
  return 'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors bg-muted text-muted-foreground';
}

function ProgressIndicator({ currentPath }: { currentPath: string }) {
  const activeIndex = STEPS.findIndex((s) => currentPath.startsWith(s.path));

  return (
    <div className="flex items-center gap-2">
      {STEPS.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={step.path} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={stepCircleClass(isActive, isDone)}>
                {i + 1}
              </div>
              <span className={cn('text-sm hidden sm:inline', isActive ? 'text-foreground font-medium' : 'text-muted')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px w-6', isDone ? 'bg-primary/40' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded && !!isSignedIn,
  });

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
          <span className="font-display font-semibold text-base">GigMan</span>
        </div>
        <ProgressIndicator currentPath={location.pathname} />
      </header>

      <main className="flex-1 px-4 md:px-8 py-8 max-w-2xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
