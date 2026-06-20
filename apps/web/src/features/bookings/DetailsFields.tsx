import { useState } from 'react';
import { ChevronDown, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiGet, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { DRESS_CODE_OPTIONS, PACKAGE_ICON_OPTIONS } from '@/lib/constants';
import FormatIcon from './FormatIcon';
import { cn } from '@/lib/utils';
import type { BookingDetail, BookingLogisticsEntry, UserProfile } from '@/types/api';

// PRD #511 Module B — the non-temporal logistics field primitives, extracted so DetailsAtom
// stays lean. These are the "conditions" half of the logistics JSON (the temporal half — the
// time anchors — belongs to the Itinerary atom, slice 7a). OnTheDayEditor keeps its own copies
// until #521 retires it; refactoring a file that's about to be deleted would be wasted churn.

/** A single logistics entry in editable local form (icon/notes always present as strings). */
export type LocalEntry = Pick<BookingLogisticsEntry, 'value' | 'shareWithBand' | 'shareWithClient'> & {
  icon: string;
  notes: string;
};

/** A user-defined logistics field, with transient edit-mode flag. */
export type CustomFieldLocal = {
  key: string;
  label: string;
  value: string;
  icon: string;
  shareWithBand: boolean;
  shareWithClient: boolean;
  isEditing: boolean;
};

export function entryFromBooking(logistics: BookingDetail['logistics'], key: string): LocalEntry {
  const entry = logistics?.[key];
  return {
    value:           entry?.value ?? '',
    icon:            entry?.icon ?? '',
    notes:           entry?.notes ?? '',
    shareWithBand:   entry?.shareWithBand ?? false,
    shareWithClient: entry?.shareWithClient ?? false,
  };
}

export function buildCustomFields(
  logistics: BookingDetail['logistics'],
  systemKeys: ReadonlySet<string>,
): CustomFieldLocal[] {
  if (!logistics) return [];
  return Object.entries(logistics)
    .filter(([key]) => !systemKeys.has(key))
    .map(([key, entry]) => ({
      key,
      label: entry.label ?? '',
      value: entry.value ?? '',
      icon: entry.icon ?? '',
      shareWithBand: entry.shareWithBand,
      shareWithClient: entry.shareWithClient,
      isEditing: false,
    }));
}

export function getNextCustomFieldKey(
  logistics: BookingDetail['logistics'],
  currentCustomFields: CustomFieldLocal[],
): string {
  const existingKeys = new Set([
    ...Object.keys(logistics ?? {}),
    ...currentCustomFields.map((f) => f.key),
  ]);
  let n = 1;
  while (existingKeys.has(`customField${n}`)) n++;
  return `customField${n}`;
}

export function toSystemEntry(f: LocalEntry): BookingLogisticsEntry {
  return {
    value: f.value,
    ...(f.icon && { icon: f.icon }),
    ...(f.notes && { notes: f.notes }),
    shareWithBand: f.shareWithBand,
    shareWithClient: f.shareWithClient,
  };
}

export function toCustomEntry(cf: CustomFieldLocal): BookingLogisticsEntry {
  return {
    value: cf.value,
    label: cf.label,
    ...(cf.icon && { icon: cf.icon }),
    shareWithBand: cf.shareWithBand,
    shareWithClient: cf.shareWithClient,
  };
}

export function LogisticsIconPicker({
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
    onError: () => toast({ title: 'Failed to add dress code. Please try again.', variant: 'destructive' }),
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
    onError: () => toast({ title: 'Failed to remove dress code. Please try again.', variant: 'destructive' }),
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

export function DetailInput({
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

export function CustomFieldsList({
  customFields,
  onUpdate,
  onRemove,
  onAdd,
}: {
  customFields: CustomFieldLocal[];
  onUpdate: (key: string, patch: Partial<CustomFieldLocal>) => void;
  onRemove: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      {customFields.map((cf) =>
        cf.isEditing ? (
          <CustomFieldEditRow
            key={cf.key}
            field={cf}
            onChange={(patch) => onUpdate(cf.key, patch)}
            onDone={() => onUpdate(cf.key, { isEditing: false })}
            onRemove={() => onRemove(cf.key)}
          />
        ) : (
          <CustomFieldCompactRow
            key={cf.key}
            field={cf}
            onEdit={() => onUpdate(cf.key, { isEditing: true })}
            onRemove={() => onRemove(cf.key)}
          />
        ),
      )}
      <Button type="button" variant="outline" size="sm" onClick={onAdd} className="w-full">
        <Plus size={14} className="mr-1.5" aria-hidden="true" />
        Add field
      </Button>
    </div>
  );
}

function CustomFieldCompactRow({
  field,
  onEdit,
  onRemove,
}: {
  field: CustomFieldLocal;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const iconKey = field.icon || 'star';
  return (
    <div className="flex items-center gap-2 border border-border rounded-md px-3 py-2">
      <span className="text-muted flex-shrink-0">
        <FormatIcon icon={iconKey} size={16} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted truncate">{field.label || 'Untitled field'}</p>
        <p className="text-sm truncate">{field.value || '—'}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="Edit field"
        className="text-muted hover:text-foreground transition-colors p-1"
      >
        <Pencil size={14} />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove field"
        className="text-muted hover:text-destructive transition-colors p-1"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function CustomFieldEditRow({
  field,
  onChange,
  onDone,
  onRemove,
}: {
  field: CustomFieldLocal;
  onChange: (patch: Partial<CustomFieldLocal>) => void;
  onDone: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-md p-3 space-y-3">
      <div className="flex items-center gap-2">
        <LogisticsIconPicker
          value={field.icon}
          defaultIcon="star"
          onChange={(icon) => onChange({ icon })}
        />
        <Input
          placeholder="Field label"
          aria-label="Field label"
          value={field.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="flex-1"
        />
      </div>
      <Input
        placeholder="Value"
        aria-label="Field value"
        value={field.value}
        onChange={(e) => onChange({ value: e.target.value })}
      />
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-destructive transition-colors flex items-center gap-1"
        >
          <Trash2 size={12} aria-hidden="true" />
          Remove
        </button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}
