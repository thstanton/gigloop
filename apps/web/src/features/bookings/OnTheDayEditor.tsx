import { useEffect, useState } from 'react';
import { ChevronDown, Plus, Search, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiGet, apiPatch } from '@/lib/api';
import { DRESS_CODE_OPTIONS, LOGISTICS_FIELD_ICONS, PACKAGE_ICON_OPTIONS } from '@/lib/constants';
import FormatIcon from './FormatIcon';
import { cn } from '@/lib/utils';
import type { BookingDetail, BookingLogisticsEntry, UserProfile } from '@/types/api';

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

type LocalEntry = Pick<BookingLogisticsEntry, 'value' | 'shareWithBand' | 'shareWithClient'> & { icon: string };
type LocalState = Record<TimeFieldKey | DetailFieldKey, LocalEntry>;

function entryFromBooking(
  logistics: BookingDetail['logistics'],
  key: string,
): LocalEntry {
  const entry = logistics?.[key];
  return {
    value:           entry?.value ?? '',
    icon:            entry?.icon ?? '',
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
          logistics[key] = {
            value: f.value,
            ...(f.icon && { icon: f.icon }),
            shareWithBand: f.shareWithBand,
            shareWithClient: f.shareWithClient,
          };
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
            <FormField key={key} label={label}>
              <div className="flex items-center gap-2">
                <LogisticsIconPicker
                  value={entry.icon}
                  defaultIcon={LOGISTICS_FIELD_ICONS[key] ?? ''}
                  onChange={(icon) => setEntry(key, { icon })}
                />
                <Input
                  id={`logistics-${key}`}
                  aria-label={label}
                  placeholder="HH:MM"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  value={entry.value}
                  onChange={(e) => setEntry(key, { value: e.target.value })}
                  className="flex-1"
                />
              </div>
            </FormField>
          );
        })}
      </div>

      <SubLabel className="mb-3">Details</SubLabel>
      <div className="space-y-5">
        {DETAIL_FIELDS.map(({ key, label, type }) => {
          const entry = fields[key];
          return (
            <FormField key={key} label={label}>
              <div className={cn('flex gap-2', type === 'textarea' ? 'items-start' : 'items-center')}>
                <LogisticsIconPicker
                  value={entry.icon}
                  defaultIcon={LOGISTICS_FIELD_ICONS[key] ?? ''}
                  onChange={(icon) => setEntry(key, { icon })}
                />
                <div className="flex-1 min-w-0">
                  <DetailInput
                    fieldKey={key}
                    label={label}
                    type={type}
                    value={entry.value}
                    onChange={(v) => setEntry(key, { value: v })}
                  />
                </div>
              </div>
            </FormField>
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

function LogisticsIconPicker({
  value,
  defaultIcon,
  onChange,
}: {
  value: string;
  defaultIcon: string;
  onChange: (icon: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const effectiveIcon = value || defaultIcon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change icon"
          className={cn(
            'w-8 h-8 flex items-center justify-center rounded border transition-colors',
            value
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-surface text-muted hover:text-foreground',
          )}
        >
          <FormatIcon icon={effectiveIcon} size={16} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="w-64 p-3">
        <div className="flex flex-wrap gap-1.5">
          {PACKAGE_ICON_OPTIONS.map((icon) => {
            const isSelected = icon === value;
            return (
              <button
                key={icon}
                type="button"
                onClick={() => { onChange(isSelected ? '' : icon); setOpen(false); }}
                aria-label={icon}
                title={icon}
                className={cn(
                  'w-8 h-8 flex items-center justify-center rounded border transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface text-muted hover:text-foreground',
                )}
              >
                <FormatIcon icon={icon} size={16} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DressCodeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { isLoaded } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const customOptions = me?.preferences?.customDressCodeOptions ?? [];
  const allOptions = [...new Set([...DRESS_CODE_OPTIONS, ...customOptions])];
  const isCustomSelected = value !== '' && customOptions.includes(value);

  const filtered = search
    ? allOptions.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : allOptions;
  const hasExactMatch = allOptions.some((o) => o.toLowerCase() === search.toLowerCase());

  const addMutation = useMutation({
    mutationFn: (newOption: string) => {
      const updated = [...new Set([...customOptions, newOption])];
      return apiPatch('/me', { preferences: { customDressCodeOptions: updated } });
    },
    onSuccess: (_data, newOption) => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onChange(newOption);
      setOpen(false);
      setSearch('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (option: string) => {
      const updated = customOptions.filter((o) => o !== option);
      return apiPatch('/me', { preferences: { customDressCodeOptions: updated } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      onChange('');
    },
  });

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-label="Dress code"
            id="logistics-dressCode"
            className="w-full flex items-center justify-between rounded-md border border-border bg-background px-3 h-10 text-sm hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          >
            <span className={cn('truncate', value ? 'text-foreground' : 'text-muted')}>
              {value || 'Select…'}
            </span>
            {value ? (
              <X size={14} className="text-muted flex-shrink-0 ml-2 hover:text-foreground transition-colors"
                onClick={(e) => { e.stopPropagation(); onChange(''); }} aria-hidden="true" />
            ) : (
              <ChevronDown size={14} className="text-muted flex-shrink-0 ml-2" aria-hidden="true" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4} style={{ width: 'var(--radix-popover-trigger-width)' }} className="p-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={14} className="text-muted flex-shrink-0" aria-hidden="true" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search or add new…"
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => { onChange(opt); setOpen(false); setSearch(''); }}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors',
                  opt === value && 'font-medium text-primary bg-accent',
                )}
              >
                {opt}
              </button>
            ))}
            {search && !hasExactMatch && (
              <button
                type="button"
                onClick={() => addMutation.mutate(search.trim())}
                disabled={addMutation.isPending}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-primary hover:bg-accent transition-colors border-t border-border text-sm"
              >
                <Plus size={14} className="flex-shrink-0" aria-hidden="true" />
                Add "{search.trim()}"
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {isCustomSelected && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => deleteMutation.mutate(value)}
                disabled={deleteMutation.isPending}
                className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Delete custom option"
              >
                <Trash2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove custom option</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
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
    return <DressCodeField value={value} onChange={onChange} />;
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

