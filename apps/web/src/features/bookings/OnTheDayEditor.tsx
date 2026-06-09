import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { apiPatch } from '@/lib/api';
import type { BookingDetail, BookingLogisticsEntry } from '@/types/api';

type TimeFieldKey = 'arrivalTime' | 'soundCheckTime' | 'finishTime';

const TIME_FIELDS: Array<{ key: TimeFieldKey; label: string }> = [
  { key: 'arrivalTime',    label: 'Arrival time' },
  { key: 'soundCheckTime', label: 'Soundcheck time' },
  { key: 'finishTime',     label: 'Finish time' },
];

type LocalEntry = Pick<BookingLogisticsEntry, 'value' | 'shareWithBand' | 'shareWithClient'>;
type LocalState = Record<TimeFieldKey, LocalEntry>;

function entryFromBooking(
  logistics: BookingDetail['logistics'],
  key: TimeFieldKey,
): LocalEntry {
  const entry = logistics?.[key];
  return {
    value:           entry?.value ?? '',
    shareWithBand:   entry?.shareWithBand ?? false,
    shareWithClient: entry?.shareWithClient ?? false,
  };
}

function buildInitialState(logistics: BookingDetail['logistics']): LocalState {
  return {
    arrivalTime:    entryFromBooking(logistics, 'arrivalTime'),
    soundCheckTime: entryFromBooking(logistics, 'soundCheckTime'),
    finishTime:     entryFromBooking(logistics, 'finishTime'),
  };
}

// ─── OnTheDayEditor ───────────────────────────────────────────────────────────

interface Props {
  booking: BookingDetail;
  isOpen: boolean;
  onSaved?: () => void;
}

export default function OnTheDayEditor({ booking, isOpen, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<LocalState>(() =>
    buildInitialState(booking.logistics),
  );

  useEffect(() => {
    if (isOpen) {
      setFields(buildInitialState(booking.logistics));
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function setEntry(key: TimeFieldKey, patch: Partial<LocalEntry>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const logistics: Record<string, BookingLogisticsEntry> = {};
      for (const { key } of TIME_FIELDS) {
        const f = fields[key];
        if (f.value) {
          logistics[key] = { value: f.value, shareWithBand: f.shareWithBand, shareWithClient: f.shareWithClient };
        }
      }
      return apiPatch(`/bookings/${booking.id}`, { logistics });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      onSaved?.();
    },
  });

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-4">On the day</p>

      <div className="space-y-5">
        {TIME_FIELDS.map(({ key, label }) => {
          const entry = fields[key];
          return (
            <div key={key} className="space-y-2">
              <FormField label={label}>
                <Input
                  id={`logistics-${key}`}
                  aria-label={label}
                  placeholder="HH:MM"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  value={entry.value}
                  onChange={(e) => setEntry(key, { value: e.target.value })}
                />
              </FormField>
              <div className="flex gap-6 pl-1">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${key}-band`}
                    checked={entry.shareWithBand}
                    onCheckedChange={(v) => setEntry(key, { shareWithBand: v })}
                  />
                  <Label htmlFor={`${key}-band`} className="text-sm text-muted-foreground">
                    Share with band
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`${key}-client`}
                    checked={entry.shareWithClient}
                    onCheckedChange={(v) => setEntry(key, { shareWithClient: v })}
                  />
                  <Label htmlFor={`${key}-client`} className="text-sm text-muted-foreground">
                    Share with client
                  </Label>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {mutation.isError && (
        <p className="mt-4 text-sm text-status-cancelled">Failed to save. Please try again.</p>
      )}

      <div className="flex items-center gap-3 mt-5">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : 'Save'}
        </Button>
        {mutation.isSuccess && <span className="text-xs text-muted">Saved</span>}
      </div>
    </div>
  );
}
