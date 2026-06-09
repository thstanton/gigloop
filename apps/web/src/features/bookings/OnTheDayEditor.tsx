import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import { apiPatch } from '@/lib/api';
import { DRESS_CODE_OPTIONS } from '@/lib/constants';
import type { BookingDetail, BookingLogisticsEntry } from '@/types/api';

type TimeFieldKey = 'arrivalTime' | 'soundCheckTime' | 'finishTime';
type DetailFieldKey = 'dressCode' | 'performanceSpace' | 'foodProvided' | 'greenRoom' | 'equipmentRequired';

const TIME_FIELDS: Array<{ key: TimeFieldKey; label: string }> = [
  { key: 'arrivalTime',    label: 'Arrival time' },
  { key: 'soundCheckTime', label: 'Soundcheck time' },
  { key: 'finishTime',     label: 'Finish time' },
];

const DETAIL_FIELDS: Array<{ key: DetailFieldKey; label: string; type: 'input' | 'select' | 'textarea' }> = [
  { key: 'dressCode',          label: 'Dress code',          type: 'select' },
  { key: 'performanceSpace',   label: 'Performance space',   type: 'input' },
  { key: 'foodProvided',       label: 'Food provided',       type: 'input' },
  { key: 'greenRoom',          label: 'Green room',          type: 'input' },
  { key: 'equipmentRequired',  label: 'Equipment required',  type: 'textarea' },
];

type LocalEntry = Pick<BookingLogisticsEntry, 'value' | 'shareWithBand' | 'shareWithClient'>;
type LocalState = Record<TimeFieldKey | DetailFieldKey, LocalEntry>;

function entryFromBooking(
  logistics: BookingDetail['logistics'],
  key: string,
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
    arrivalTime:       entryFromBooking(logistics, 'arrivalTime'),
    soundCheckTime:    entryFromBooking(logistics, 'soundCheckTime'),
    finishTime:        entryFromBooking(logistics, 'finishTime'),
    dressCode:         entryFromBooking(logistics, 'dressCode'),
    performanceSpace:  entryFromBooking(logistics, 'performanceSpace'),
    foodProvided:      entryFromBooking(logistics, 'foodProvided'),
    greenRoom:         entryFromBooking(logistics, 'greenRoom'),
    equipmentRequired: entryFromBooking(logistics, 'equipmentRequired'),
  };
}

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

  function setEntry(key: TimeFieldKey | DetailFieldKey, patch: Partial<LocalEntry>) {
    setFields((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const mutation = useMutation({
    mutationFn: () => {
      const logistics: Record<string, BookingLogisticsEntry> = {};
      const allFields = [
        ...TIME_FIELDS.map(f => f.key),
        ...DETAIL_FIELDS.map(f => f.key),
      ];
      for (const key of allFields) {
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

      <SubLabel className="mb-3">Itinerary</SubLabel>
      <div className="space-y-5 mb-6">
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
              <SharingToggles fieldKey={key} entry={entry} onChange={(patch) => setEntry(key, patch)} />
            </div>
          );
        })}
      </div>

      <SubLabel className="mb-3">Details</SubLabel>
      <div className="space-y-5">
        {DETAIL_FIELDS.map(({ key, label, type }) => {
          const entry = fields[key];
          return (
            <div key={key} className="space-y-2">
              <FormField label={label}>
                <DetailInput
                  fieldKey={key}
                  label={label}
                  type={type}
                  value={entry.value}
                  onChange={(v) => setEntry(key, { value: v })}
                />
              </FormField>
              <SharingToggles fieldKey={key} entry={entry} onChange={(patch) => setEntry(key, patch)} />
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

function DetailInput({
  fieldKey,
  label,
  type,
  value,
  onChange,
}: {
  fieldKey: string;
  label: string;
  type: 'input' | 'select' | 'textarea';
  value: string;
  onChange: (v: string) => void;
}) {
  if (type === 'select') {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`logistics-${fieldKey}`} aria-label={label}>
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {DRESS_CODE_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (type === 'textarea') {
    return (
      <Textarea
        id={`logistics-${fieldKey}`}
        aria-label={label}
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <Input
      id={`logistics-${fieldKey}`}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function SharingToggles({
  fieldKey,
  entry,
  onChange,
}: {
  fieldKey: string;
  entry: LocalEntry;
  onChange: (patch: Partial<LocalEntry>) => void;
}) {
  return (
    <div className="flex gap-6 pl-1">
      <div className="flex items-center gap-2">
        <Switch
          id={`${fieldKey}-band`}
          checked={entry.shareWithBand}
          onCheckedChange={(v) => onChange({ shareWithBand: v })}
        />
        <Label htmlFor={`${fieldKey}-band`} className="text-sm text-muted-foreground">
          Share with band
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id={`${fieldKey}-client`}
          checked={entry.shareWithClient}
          onCheckedChange={(v) => onChange({ shareWithClient: v })}
        />
        <Label htmlFor={`${fieldKey}-client`} className="text-sm text-muted-foreground">
          Share with client
        </Label>
      </div>
    </div>
  );
}
