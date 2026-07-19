import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { apiGet } from '@/lib/api';
import { useMe } from '@/lib/hooks/useMe';
import { useDismissibleHint } from '@/lib/hooks/useDismissibleHint';
import { useSongs } from '@/lib/hooks/useSongs';
import type { PackageTemplate, PublicProfile, Song, UserProfile } from '@/types/api';
import { TipsWidget } from './TipsWidget';
import { selectEligibleTips, pickTip, TIP_POOL, type TipSnapshot } from './tipEngine';

// The shipped portal look, mirroring the API's PORTAL_CONFIG_DEFAULTS. A portal still on both of
// these has never been branded — what skipping onboarding step 4 leaves behind.
const DEFAULT_PORTAL_THEME = 'LIGHT_MODERN';
const DEFAULT_PORTAL_BRAND_COLOUR = '#1a1a1a';

function isUnbranded(publicProfile: PublicProfile | undefined): boolean {
  const portal = publicProfile?.clientPortalConfig;
  if (!portal) return false;
  return (
    portal.theme === DEFAULT_PORTAL_THEME &&
    portal.brandColour.toLowerCase() === DEFAULT_PORTAL_BRAND_COLOUR
  );
}

function buildSnapshot(
  me: UserProfile | undefined,
  publicProfile: PublicProfile | undefined,
  packages: PackageTemplate[] | undefined,
  songs: Song[] | undefined,
): TipSnapshot {
  return {
    hasHomeAddress: !!(me?.latitude && me?.longitude),
    hasLogo: !!publicProfile?.logoUrl,
    // No template of their own — an empty library (no auto-seed, #663) or only system defaults.
    noCustomPackage: !!packages && packages.every((p) => p.isSystemDefault),
    usesDefaultPortalBranding: isUnbranded(publicProfile),
    songRequestsEnabled: !!me?.songRequestFormEnabled,
    // Conservative while the query is in flight (like noCustomPackage above): an unloaded
    // repertoire must not read as an empty one, or the tip flashes for someone who has songs.
    hasSongs: !songs || songs.length > 0,
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
  const { data: songs } = useSongs();
  const seed = useTipRotationSeed();

  const snapshot = buildSnapshot(me, publicProfile, packages, songs);
  const dismissed = me?.preferences?.dismissedHints ?? [];
  const eligible = selectEligibleTips(snapshot, dismissed, TIP_POOL);
  // Gate on `me` so nothing flashes before the profile loads.
  const tip = me ? pickTip(eligible, seed) : null;

  const { dismiss } = useDismissibleHint(tip?.id ?? '');

  return <TipsWidget tip={tip} onDismiss={dismiss} />;
}
