import { cn } from '@/lib/utils';
import { ONBOARDING_STEPS } from '@/lib/constants';

const BASE_STEP_CIRCLE =
  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors';

function stepCircleClass(isActive: boolean, isDone: boolean): string {
  if (isActive) return cn(BASE_STEP_CIRCLE, 'bg-primary text-primary-foreground');
  if (isDone) return cn(BASE_STEP_CIRCLE, 'bg-primary/20 text-primary');
  return cn(BASE_STEP_CIRCLE, 'bg-muted text-muted-foreground');
}

/**
 * Onboarding progress indicator, driven by ONBOARDING_STEPS (PRD #478). Highlights the
 * step whose path prefixes the current location and marks earlier steps as done.
 */
export function ProgressIndicator({ currentPath }: { currentPath: string }) {
  const activeIndex = ONBOARDING_STEPS.findIndex((s) => currentPath.startsWith(s.path));

  return (
    <div className="flex items-center gap-2">
      {ONBOARDING_STEPS.map((step, i) => {
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={step.path} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={stepCircleClass(isActive, isDone)}>{i + 1}</div>
              <span
                className={cn(
                  'text-sm hidden sm:inline',
                  isActive ? 'text-foreground font-medium' : 'text-muted',
                )}
              >
                {step.label}
              </span>
            </div>
            {i < ONBOARDING_STEPS.length - 1 && (
              <div className={cn('h-px w-6', isDone ? 'bg-primary/40' : 'bg-border')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
