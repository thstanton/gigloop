import { useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMe } from '@/lib/hooks/useMe';
import AppShell from '@/components/AppShell';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function AdminLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const { data: profile } = useMe();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/sign-in', { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  useEffect(() => {
    if (profile && profile.onboardingCompletedAt === null) {
      navigate('/onboarding/profile', { replace: true });
    }
  }, [profile, navigate]);

  if (!isLoaded || !isSignedIn) return null;
  if (profile && profile.onboardingCompletedAt === null) return null;

  return (
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  );
}
