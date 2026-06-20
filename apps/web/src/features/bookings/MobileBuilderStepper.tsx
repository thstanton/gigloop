import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { CompletenessStatusIcon, type CompletenessStatus, type SpineId } from './builderCompleteness';

// Mobile-only ambient progress for the Booking Builder one-pager (ADR-0051).
// A horizontal stepper of all eight spine sections, connected by lines. The
// three status-bearing concerns (People, Venue, Itinerary) show the same
// completeness glyphs as the desktop CompletenessRail; the other five render as
// plain position dots (they make no completeness claim). The active node is
// highlighted and its label shown as text. Tapping a node jumps to that section.
// Presentational only — scroll-spy and section refs live in BookingBuilderPage.

export interface StepperSection {
  id: SpineId;
  label: string;
  status: CompletenessStatus;
}

export function MobileBuilderStepper({
  sections,
  activeId,
  onJump,
}: {
  sections: StepperSection[];
  activeId: SpineId | null;
  onJump: (id: SpineId) => void;
}) {
  const activeLabel = sections.find((s) => s.id === activeId)?.label ?? '';

  return (
    <nav aria-label="Builder progress" className="w-full bg-background border-b border-border px-4 py-2">
      <div className="flex items-center">
        {sections.map((section, i) => {
          const isActive = section.id === activeId;
          return (
            <Fragment key={section.id}>
              {i > 0 && <div aria-hidden="true" className="h-px flex-1 bg-border" />}
              <button
                type="button"
                onClick={() => onJump(section.id)}
                aria-label={section.label}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex flex-shrink-0 items-center justify-center rounded-full transition-all',
                  isActive ? 'h-9 w-9 bg-primary' : 'h-7 w-7',
                )}
              >
                {section.status === null ? (
                  <span
                    aria-hidden="true"
                    className={cn(
                      'rounded-full',
                      isActive ? 'h-2.5 w-2.5 bg-primary-foreground' : 'h-2 w-2 bg-border',
                    )}
                  />
                ) : (
                  <CompletenessStatusIcon
                    status={section.status}
                    className={isActive ? 'text-primary-foreground' : undefined}
                  />
                )}
              </button>
            </Fragment>
          );
        })}
      </div>
      <p className="mt-1 text-center text-xs font-medium text-foreground">{activeLabel}</p>
    </nav>
  );
}
