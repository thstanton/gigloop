import { ONBOARDING_STEPS } from '@/lib/constants';

export interface StepNav {
  /** Index of the step in ONBOARDING_STEPS, or -1 if the path is not a known step. */
  index: number;
  isFirst: boolean;
  isLast: boolean;
  /** Previous step's path, or undefined at the first step / for an unknown path. */
  prev?: string;
  /** Next step's path, or undefined at the last step / for an unknown path. */
  next?: string;
}

/**
 * Resolve a step's neighbours from ONBOARDING_STEPS. Each step page passes its own
 * literal path so navigation resolves independently of router state (page stories
 * render with no route). An unknown path returns undefined prev/next rather than
 * throwing, so router/story edge cases stay safe.
 */
export function stepNav(path: string): StepNav {
  const index = ONBOARDING_STEPS.findIndex((s) => s.path === path);
  if (index === -1) {
    return { index: -1, isFirst: false, isLast: false };
  }
  return {
    index,
    isFirst: index === 0,
    isLast: index === ONBOARDING_STEPS.length - 1,
    prev: index > 0 ? ONBOARDING_STEPS[index - 1].path : undefined,
    next: index < ONBOARDING_STEPS.length - 1 ? ONBOARDING_STEPS[index + 1].path : undefined,
  };
}
