import { useCallback, useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { APPEARANCE_PREFERENCES, type AppearancePreference } from '@/lib/constants';
import { resolveAppearance, variantForPathname } from '@/lib/appearance';
import { isEnabled } from '@/lib/featureFlags';

export const APPEARANCE_STORAGE_KEY = 'gigloop-appearance';
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return APPEARANCE_PREFERENCES.some((option) => option.value === value);
}

function readPreference(): AppearancePreference {
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return isAppearancePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function useAppearance(pathname = window.location.pathname) {
  const enabled = isEnabled('VITE_FEATURE_APPEARANCE');
  const variant = variantForPathname(pathname);
  const [preference, setPreferenceState] = useState<AppearancePreference>(readPreference);

  const subscribeToColorScheme = useCallback(
    (onChange: () => void) => {
      if (!enabled || variant !== 'admin' || preference !== 'system') return () => {};

      const media = window.matchMedia(COLOR_SCHEME_QUERY);
      media.addEventListener('change', onChange);
      return () => media.removeEventListener('change', onChange);
    },
    [enabled, preference, variant],
  );
  const getSystemPreference = useCallback(
    () => window.matchMedia(COLOR_SCHEME_QUERY).matches,
    [],
  );
  const systemDark = useSyncExternalStore(subscribeToColorScheme, getSystemPreference, () => false);

  const resolved = resolveAppearance({ enabled, preference, systemDark, pathname });

  const setPreference = useCallback((next: AppearancePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
    } catch {
      // Keep the in-memory preference for this session when storage is unavailable.
    }
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  return { preference, resolved, setPreference } as const;
}
