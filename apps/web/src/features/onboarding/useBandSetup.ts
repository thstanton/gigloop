import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiPatch, apiPost } from '@/lib/api';
import { isEnabled } from '@/lib/featureFlags';
import { useLineupTemplates } from '@/lib/hooks/useLineupTemplates';
import {
  emptyLineupFormValues,
  lineupFormToPayload,
  type LineupFormValues,
} from '@/features/packages/LineupForm';
import type { LineupTemplate } from '@/types/api';
import type { BandSetupAnswer } from './BandSetupSection';

const BAND_MEMBERS_FLAG = 'VITE_FEATURE_BAND_MEMBERS';

function setBandSetupSkipped(skipped: boolean) {
  return apiPatch('/me', { preferences: { onboardingSkippedBandSetup: skipped } });
}

/** Owns the onboarding answer and persists it through the existing lineup/defaults mechanisms. */
export function useBandSetup() {
  const queryClient = useQueryClient();
  const enabled = isEnabled(BAND_MEMBERS_FLAG);
  const { data: lineups = [], isLoading: lineupsLoading } = useLineupTemplates(enabled);
  const [answer, setAnswer] = useState<BandSetupAnswer>(null);
  const [selectedLineupId, setSelectedLineupId] = useState<string | null>(null);
  const [createNewLineup, setCreateNewLineup] = useState(false);
  const [lineupDraft, setLineupDraft] = useState<LineupFormValues>(emptyLineupFormValues);

  const effectiveLineupId = selectedLineupId ?? lineups[0]?.id ?? null;
  const isCreatingNewLineup = createNewLineup || (!lineupsLoading && lineups.length === 0);
  const isDraftLineupValid =
    lineupDraft.label.trim().length > 0 && lineupDraft.slots.some((slot) => slot.role.trim().length > 0);

  function chooseAnswer(nextAnswer: BandSetupAnswer) {
    setAnswer(nextAnswer);
    if (nextAnswer === 'band') {
      setSelectedLineupId(lineups[0]?.id ?? null);
      setCreateNewLineup(!lineupsLoading && lineups.length === 0);
    }
  }

  async function persistAnswer(skipPackages: boolean): Promise<string | null> {
    if (!enabled) return null;

    if (answer === 'solo') {
      await apiPatch('/me/preferences/checklist-defaults/disable-band-goals', {});
      return null;
    }

    if (answer === 'band') {
      const hasSelectedLineup = !!effectiveLineupId && !isCreatingNewLineup;
      if (skipPackages) {
        await setBandSetupSkipped(!hasSelectedLineup);
        return null;
      }

      if (isCreatingNewLineup) {
        const created = await apiPost<LineupTemplate>('/lineups', lineupFormToPayload(lineupDraft));
        setSelectedLineupId(created.id);
        setCreateNewLineup(false);
        queryClient.setQueryData<LineupTemplate[]>(['lineups'], (current = []) => [created, ...current]);
        await setBandSetupSkipped(false);
        return created.id;
      }

      await setBandSetupSkipped(false);
      return effectiveLineupId;
    }

    await setBandSetupSkipped(true);
    return null;
  }

  return {
    enabled,
    answer,
    chooseAnswer,
    lineups,
    lineupsLoading,
    selectedLineupId: effectiveLineupId,
    selectLineup: setSelectedLineupId,
    createNewLineup,
    startNewLineup: () => {
      setSelectedLineupId(null);
      setCreateNewLineup(true);
    },
    useExistingLineup: () => {
      setSelectedLineupId(lineups[0]?.id ?? null);
      setCreateNewLineup(false);
    },
    lineupDraft,
    updateLineupDraft: (patch: Partial<LineupFormValues>) =>
      setLineupDraft((current) => ({ ...current, ...patch })),
    isCreatingNewLineup,
    isDraftLineupValid,
    persistAnswer,
  };
}
