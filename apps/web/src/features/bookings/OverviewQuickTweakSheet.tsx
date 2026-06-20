import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useAuth } from '@clerk/react';
import { apiGet, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { OverviewAtom, type OverviewChanges, type SeriesChange } from './OverviewAtom';
import type { BookingSeries, EventType, UpdateBookingSeriesResponse } from '@/types/api';

// PRD #511 Module B — the quick-tweak shell for the Overview atom. Consistent with every
// quick-tweak sheet, a *clean* save closes the sheet (the updated header strip is the feedback).
// These are the booking's own scalar columns; regular fields PATCH /bookings/:id (plain scalar
// patch, no JSON-merge seam). Series assignment takes a separate path: PATCH /bookings/:id/series,
// which returns { requiresConfirmation: true, warning } on customer mismatch or throws
// ConflictException (409) when non-VOID invoices exist. Those two outcomes KEEP the sheet open —
// the confirmation is handled inline, the 409 surfaces as an inline saveError — so the close only
// fires on an unambiguous success. Opened from the strip's ghost pencil via ?sheet=overviewTweak.

function isConfirmationRequired(r: unknown): r is Required<UpdateBookingSeriesResponse> {
  return Boolean(r && typeof r === 'object' && 'requiresConfirmation' in r);
}

interface Props {
  bookingId: string;
  initialEventType: EventType;
  /** Date-only (YYYY-MM-DD). */
  initialDate: string;
  initialFee: string | null;
  initialTitle: string | null;
  initialSeriesId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OverviewQuickTweakSheet({
  bookingId,
  initialEventType,
  initialDate,
  initialFee,
  initialTitle,
  initialSeriesId,
  open,
  onOpenChange,
}: Props) {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const [seriesConfirmation, setSeriesConfirmation] = useState<{ seriesId: string; warning: string } | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  // A single Save can fire both the scalar and the series mutation. The sheet must close exactly
  // once, only after the relevant outcome settles cleanly — so the scalar branch defers closing to
  // the series branch whenever a series change was part of the same save.
  const seriesDispatchedRef = useRef(false);

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => apiGet<BookingSeries[]>('/series'),
    enabled: isLoaded && open,
  });

  const saveMutation = useMutation({
    mutationFn: (changes: Omit<OverviewChanges, 'series'>) =>
      apiPatch(`/bookings/${bookingId}`, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      // Close now only for a scalar-only save; if a series change rode along, the series branch owns
      // the close (it may still need confirmation or hit a 409, both of which keep the sheet open).
      if (!seriesDispatchedRef.current) onOpenChange(false);
    },
    // Toast as well as the inline saveError: in the both-dispatched race the series branch may have
    // already closed the sheet, so the inline surface can be gone when the scalar save fails.
    onError: () => toast({ title: 'Failed to save. Please try again.', variant: 'destructive' }),
  });

  const seriesMutation = useMutation({
    mutationFn: (payload: { seriesId?: string | null; newSeriesLabel?: string; confirm?: boolean }) =>
      apiPatch<UpdateBookingSeriesResponse | object>(`/bookings/${bookingId}/series`, payload),
    onSuccess: (result, variables) => {
      if (isConfirmationRequired(result)) {
        setSeriesConfirmation({ seriesId: variables.seriesId!, warning: result.warning });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      setSeriesError(null);
      onOpenChange(false);
    },
    onError: (error) => {
      const msg = error instanceof Response && error.status === 409
        ? 'This booking has non-VOID invoices. Void or delete them before adding to a series.'
        : 'Failed to update series assignment. Please try again.';
      setSeriesError(msg);
    },
  });

  function handleSave(changes: OverviewChanges) {
    const { series, ...rest } = changes;
    seriesDispatchedRef.current = !!series;
    setSeriesError(null);
    setSeriesConfirmation(null);

    if (Object.keys(rest).length > 0) {
      saveMutation.mutate(rest);
    }

    if (series) {
      dispatchSeriesChange(series);
    }
  }

  function dispatchSeriesChange(series: SeriesChange, confirm?: boolean) {
    if (series.mode === 'none') {
      seriesMutation.mutate({ seriesId: null });
    } else if (series.mode === 'existing') {
      seriesMutation.mutate({ seriesId: series.seriesId, confirm });
    } else {
      seriesMutation.mutate({ newSeriesLabel: series.label });
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      saveMutation.reset();
      seriesMutation.reset();
      setSeriesConfirmation(null);
      setSeriesError(null);
    }
    onOpenChange(next);
  }

  const isSaving = saveMutation.isPending || seriesMutation.isPending;
  // A clean save closes the sheet, so there is no inline "Saved"; only the stay-open outcomes
  // (scalar error, or a series 409) surface inline via saveError.
  const saveError = seriesError ?? (saveMutation.isError ? 'Failed to save. Please try again.' : null);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Overview</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <OverviewAtom
            initialEventType={initialEventType}
            initialDate={initialDate}
            initialFee={initialFee}
            initialTitle={initialTitle}
            initialSeriesId={initialSeriesId}
            series={seriesList}
            onSave={handleSave}
            isSaving={isSaving}
            saved={false}
            saveError={saveError}
          />

          {/* Customer-mismatch confirmation — shown inline within the sheet when the API returns
              requiresConfirmation: true (different customer between booking and target series). */}
          {seriesConfirmation && (
            <div className="p-4 border border-border rounded-md bg-muted/30 space-y-3">
              <p className="text-sm">{seriesConfirmation.warning}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    const { seriesId } = seriesConfirmation;
                    setSeriesConfirmation(null);
                    seriesMutation.mutate({ seriesId, confirm: true });
                  }}
                  disabled={seriesMutation.isPending}
                >
                  {seriesMutation.isPending ? 'Saving…' : 'Continue anyway'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSeriesConfirmation(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
