import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import { useMe } from '@/lib/hooks/useMe';
import { useDismissibleHint } from '@/lib/hooks/useDismissibleHint';
import type { PackageTemplate, PublicProfile, UserProfile } from '@/types/api';
import { TipsWidget } from './TipsWidget';
import { selectEligibleTips, pickTip, TIP_POOL, type TipSnapshot } from './tipEngine';

function buildSnapshot(
  me: UserProfile | undefined,
  publicProfile: PublicProfile | undefined,
  packages: PackageTemplate[] | undefined,
): TipSnapshot {
  return {
    hasHomeAddress: !!(me?.latitude && me?.longitude),
    hasLogo: !!publicProfile?.logoUrl,
    // Still on the seeded defaults: at least one package, all system-supplied.
    onlyDefaultPackages: !!packages && packages.length > 0 && packages.every((p) => p.isSystemDefault),
  };
}

/**
 * Stable per-session rotation seed that increments across visits, so the widget
 * shows a different eligible tip on a return visit without churning within a
 * session. Computed once on mount; no time/randomness dependency.
 */
function useTipRotationSeed(): number {
  const [seed] = useState(() => {
    try {
      const KEY = 'gigloop:tipSeed';
      const SESSION = 'gigloop:tipSeedBumped';
      let n = Number(window.localStorage.getItem(KEY) ?? '0') || 0;
      if (!window.sessionStorage.getItem(SESSION)) {
        n += 1;
        window.localStorage.setItem(KEY, String(n));
        window.sessionStorage.setItem(SESSION, '1');
      }
      return n;
    } catch {
      return 0;
    }
  });
  return seed;
}

/** Wires the snapshot + dismissal state into the presentational TipsWidget. */
export function TipsWidgetContainer() {
  const { isLoaded } = useAuth();
  const { data: me } = useMe();
  const { data: publicProfile } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded,
  });
  const { data: packages } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: isLoaded,
  });
  const seed = useTipRotationSeed();

  const snapshot = buildSnapshot(me, publicProfile, packages);
  const dismissed = me?.preferences?.dismissedHints ?? [];
  const eligible = selectEligibleTips(snapshot, dismissed, TIP_POOL);
  // Gate on `me` so nothing flashes before the profile loads.
  const tip = me ? pickTip(eligible, seed) : null;

  const { dismiss } = useDismissibleHint(tip?.id ?? '');

  return <TipsWidget tip={tip} onDismiss={dismiss} />;
}
