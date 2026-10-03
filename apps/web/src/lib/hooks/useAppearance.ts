import { useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import { APPEARANCE_PREFERENCES, type AppearancePreference } from '@/lib/constants';
import { resolveAppearance, variantForPathname } from '@/lib/appearance';
import { isEnabled } from '@/lib/featureFlags';

export const APPEARANCE_STORAGE_KEY = 'gigloop-appearance';
const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function isAppearancePreference(value: string | null): value is AppearancePreference {
  return APPEARANCE_PREFERENCES.some((option) => option.value === value);
}

// The preference is shared device state: the root hook (main.tsx) owns the `dark` class while the
// account-menu control and palette command write it from elsewhere, so every instance subscribes to
// one store instead of holding its own copy. Storage stays the source of truth; `unpersisted` only
// carries a choice for this session when storage refuses the write.
const preferenceListeners = new Set<() => void>();
let unpersisted: AppearancePreference | null = null;

function subscribeToPreference(onChange: () => void) {
  preferenceListeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === APPEARANCE_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    preferenceListeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function readPreference(): AppearancePreference {
  if (unpersisted) return unpersisted;
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
  const preference = useSyncExternalStore(subscribeToPreference, readPreference, (): AppearancePreference => 'system');

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
    try {
      window.localStorage.setItem(APPEARANCE_STORAGE_KEY, next);
      unpersisted = null;
    } catch {
      // Keep the in-memory preference for this session when storage is unavailable.
      unpersisted = next;
    }
    preferenceListeners.forEach((listener) => listener());
  }, []);

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }, [resolved]);

  return { preference, resolved, setPreference } as const;
}
