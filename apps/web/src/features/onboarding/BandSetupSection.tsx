import type { ReactNode } from 'react';
import { PageSection } from '@/components/common/PageSection';
import { SubLabel } from '@/components/common/SubLabel';
import { TogglePill } from '@/components/ui/toggle-pill';
import type { LineupTemplate } from '@/types/api';
import { LineupForm, type LineupFormValues } from '@/features/packages/LineupForm';

export type BandSetupAnswer = 'solo' | 'band' | null;

export interface LineupSetupState {
  lineups: LineupTemplate[];
  lineupsLoading: boolean;
  selectedLineupId: string | null;
  onSelectLineup: (id: string) => void;
  createNewLineup: boolean;
  onCreateNewLineup: () => void;
  onUseExistingLineup: () => void;
  lineupDraft: LineupFormValues;
  onLineupDraftChange: (patch: Partial<LineupFormValues>) => void;
}

interface BandSetupSectionProps {
  answer: BandSetupAnswer;
  onAnswerChange: (answer: BandSetupAnswer) => void;
  lineup: LineupSetupState;
}

export function BandSetupSection({
  answer,
  onAnswerChange,
  lineup,
}: BandSetupSectionProps) {
  const {
    lineups,
    lineupsLoading,
    selectedLineupId,
    onSelectLineup,
    createNewLineup,
    onCreateNewLineup,
    onUseExistingLineup,
    lineupDraft,
    onLineupDraftChange,
  } = lineup;
  const showNewLineupForm = createNewLineup || lineups.length === 0;
  let lineupSetupContent: ReactNode;

  if (lineupsLoading) {
    lineupSetupContent = <div className="h-10 w-full animate-pulse rounded bg-border/40" />;
  } else if (showNewLineupForm) {
    lineupSetupContent = (
      <div className="space-y-3">
        <LineupForm value={lineupDraft} onChange={onLineupDraftChange} />
        {lineups.length > 0 && (
          <button type="button" className="text-sm text-primary underline" onClick={onUseExistingLineup}>
            Choose an existing lineup instead
          </button>
        )}
      </div>
    );
  } else {
    lineupSetupContent = (
      <div className="space-y-2">
        <SubLabel>Choose one of your saved lineups</SubLabel>
        <div className="flex flex-wrap gap-2">
          {lineups.map((lineup) => (
            <TogglePill
              key={lineup.id}
              active={selectedLineupId === lineup.id}
              aria-pressed={selectedLineupId === lineup.id}
              onClick={() => onSelectLineup(lineup.id)}
            >
              {lineup.label}
            </TogglePill>
          ))}
        </div>
        <button type="button" className="text-sm text-primary underline" onClick={onCreateNewLineup}>
          Create a new lineup
        </button>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border p-4 sm:p-6">
      <PageSection
        title="Who's on stage?"
        description="Tell us whether you usually play solo or with other musicians. You can change this later."
        className="mb-4"
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label="Who you play with">
        <TogglePill
          active={answer === 'solo'}
          aria-pressed={answer === 'solo'}
          onClick={() => onAnswerChange(answer === 'solo' ? null : 'solo')}
        >
          Just me
        </TogglePill>
        <TogglePill
          active={answer === 'band'}
          aria-pressed={answer === 'band'}
          onClick={() => onAnswerChange(answer === 'band' ? null : 'band')}
        >
          I play with other musicians
        </TogglePill>
      </div>

      {answer === 'solo' && (
        <p className="mt-3 text-base text-muted">We won't show band checklist goals on your bookings.</p>
      )}

      {answer === 'band' && (
        <div className="mt-5 space-y-4">
          <div>
            <h3 className="text-base font-medium text-foreground">Your usual lineup</h3>
            <SubLabel>Save it once, then choose it as the starting lineup for future bookings.</SubLabel>
          </div>

          {lineupSetupContent}
        </div>
      )}
    </section>
  );
}
