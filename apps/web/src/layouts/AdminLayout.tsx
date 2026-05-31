import { useAuth } from '@clerk/react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import AppShell from '@/components/AppShell';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { UserProfile } from '@/types/api';

export default function AdminLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded && !!isSignedIn,
  });

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
