import type { AppearancePreference } from '@/lib/constants';

export type RouteVariant = 'admin' | 'portal' | 'default';

export function variantForPathname(pathname: string): RouteVariant {
  if (pathname.startsWith('/booking/') || pathname.startsWith('/band/')) return 'portal';
  if (pathname === '/admin' || pathname.startsWith('/admin/') || pathname.startsWith('/onboarding/')) {
    return 'admin';
  }
  return 'default';
}

export function resolveAppearance({
  enabled,
  preference,
  systemDark,
  pathname,
}: {
  enabled: boolean;
  preference: AppearancePreference;
  systemDark: boolean;
  pathname: string;
}): 'light' | 'dark' {
  if (!enabled || variantForPathname(pathname) !== 'admin') return 'light';
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return systemDark ? 'dark' : 'light';
}
