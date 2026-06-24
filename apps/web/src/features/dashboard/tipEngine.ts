/**
 * Tip selection engine — pure, no React / time / randomness. The dashboard tips
 * widget assembles a completeness snapshot and a rotation seed and feeds them in;
 * this module decides which tip (if any) to show. Keeping it free of effects
 * makes the selection logic trivially unit-testable.
 */

/** Plain-boolean snapshot of the musician's setup state. Extend by adding a flag. */
export interface TipSnapshot {
  hasHomeAddress: boolean;
  hasLogo: boolean;
  onlyDefaultPackages: boolean;
}

/** What the widget needs to render a tip. */
export interface TipDisplay {
  id: string;
  text: string;
  href: string;
}

/** A pool entry: a display tip plus the precondition that makes it eligible. */
export interface Tip extends TipDisplay {
  condition: (snapshot: TipSnapshot) => boolean;
}

/**
 * The launch pool. Grows by appending one entry. A tip is only ever eligible
 * when its `condition` is true — so a tip for a feature the musician has turned
 * off simply never fires (encode that in the snapshot flag it reads).
 */
export const TIP_POOL: Tip[] = [
  {
    id: 'home-address-missing',
    condition: (s) => !s.hasHomeAddress,
    text: 'Add your home address so GigMan can show travel times to venues',
    href: '/admin/settings',
  },
  {
    id: 'logo-missing',
    condition: (s) => !s.hasLogo,
    text: 'Upload your logo to brand your client portal',
    href: '/admin/settings',
  },
  {
    id: 'packages-still-default',
    condition: (s) => s.onlyDefaultPackages,
    text: 'Tailor your packages to match what you actually offer',
    href: '/admin/packages',
  },
];

/** Tips whose precondition is met and which haven't been dismissed. */
export function selectEligibleTips(
  snapshot: TipSnapshot,
  dismissedHints: string[],
  pool: Tip[] = TIP_POOL,
): Tip[] {
  return pool.filter((tip) => tip.condition(snapshot) && !dismissedHints.includes(tip.id));
}

/**
 * Deterministically pick one tip, rotating as `seed` varies (the widget derives
 * a stable per-session seed that increments across visits). Returns null when
 * nothing is eligible.
 */
export function pickTip(eligible: Tip[], seed: number): Tip | null {
  if (eligible.length === 0) return null;
  const index = ((Math.trunc(seed) % eligible.length) + eligible.length) % eligible.length;
  return eligible[index];
}
