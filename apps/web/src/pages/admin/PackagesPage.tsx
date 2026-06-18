import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { PACKAGE_CATEGORY_LABELS, PACKAGE_CATEGORY_ORDER, PACKAGE_ICON_MAP, PACKAGE_ICON_OPTIONS } from '@/lib/constants';
import type { CreatePackageInput, Package, SlotInput, UpdatePackageInput } from '@/types/api';
import { cn } from '@/lib/utils';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';

const ICON_OPTIONS = PACKAGE_ICON_OPTIONS;

function PackageIcon({ icon, size = 16 }: { icon: string; size?: number }) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={size} strokeWidth={1.75} />;
}

// ─── Category display ─────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: '', label: 'Uncategorised' },
  ...Object.entries(PACKAGE_CATEGORY_LABELS).map(([v, l]) => ({ value: v, label: l })),
];

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  label,
  tags,
  onChange,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) onChange([...tags, input.trim()]);
      setInput('');
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1">{label}</label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 bg-surface border border-border rounded px-2 py-0.5 text-sm"
          >
            {t}
            <button
              type="button"
              onClick={() => onChange(tags.filter((x) => x !== t))}
              className="text-muted hover:text-foreground leading-none"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type and press Enter"
        className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

// ─── Slot list editor ─────────────────────────────────────────────────────────

type SlotDraft = SlotInput & { key: string };

function SlotEditor({
  slots,
  onChange,
}: {
  slots: SlotDraft[];
  onChange: (slots: SlotDraft[]) => void;
}) {
  function move(index: number, dir: -1 | 1) {
    const next = [...slots];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((s, i) => ({ ...s, order: i })));
  }

  function update(index: number, field: 'label' | 'duration', value: string) {
    const next = [...slots];
    if (field === 'duration') {
      next[index] = { ...next[index], duration: parseInt(value, 10) || 1 };
    } else {
      next[index] = { ...next[index], label: value };
    }
    onChange(next);
  }

  function remove(index: number) {
    onChange(slots.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  }

  function add() {
    onChange([
      ...slots,
      { key: crypto.randomUUID(), duration: 60, order: slots.length },
    ]);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Slots</label>
      <div className="space-y-2">
        {slots.map((slot, i) => (
          <div key={slot.key} className="flex items-center gap-2">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-muted hover:text-foreground disabled:opacity-30 leading-none text-xs"
                aria-label="Move up"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === slots.length - 1}
                className="text-muted hover:text-foreground disabled:opacity-30 leading-none text-xs"
                aria-label="Move down"
              >
                ▼
              </button>
            </div>
            <input
              type="text"
              value={slot.label ?? ''}
              onChange={(e) => update(i, 'label', e.target.value)}
              placeholder="Label"
              className="flex-1 border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground min-w-0"
            />
            <input
              type="number"
              value={slot.duration}
              min={1}
              onChange={(e) => update(i, 'duration', e.target.value)}
              className="w-16 border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground"
              aria-label="Duration (min)"
            />
            <span className="text-sm text-muted flex-shrink-0">min</span>
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-muted hover:text-status-cancelled flex-shrink-0"
              aria-label="Remove slot"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 text-sm text-primary hover:underline"
      >
        + Add slot
      </button>
    </div>
  );
}

// ─── Icon picker ──────────────────────────────────────────────────────────────

function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-2">Icon</label>
      <div className="flex flex-wrap gap-2">
        {ICON_OPTIONS.map((icon) => (
          <button
            key={icon}
            type="button"
            onClick={() => onChange(icon)}
            className={cn(
              'w-9 h-9 flex items-center justify-center rounded border transition-colors',
              value === icon
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted hover:text-foreground',
            )}
            aria-label={icon}
            title={icon}
          >
            <PackageIcon icon={icon} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Package drawer ───────────────────────────────────────────────────────────

type DrawerMode = { type: 'create' } | { type: 'edit'; pkg: Package };

function toSlotDrafts(slots: Package['slots']): SlotDraft[] {
  return slots.map((s) => ({ ...s, label: s.label ?? undefined, key: s.id }));
}

function PackageDrawer({
  mode,
  open,
  onClose,
}: {
  mode: DrawerMode;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = mode.type === 'edit';
  const existing = isEdit ? mode.pkg : null;

  const [label, setLabel] = useState(existing?.label ?? '');
  const [icon, setIcon] = useState(existing?.icon ?? 'music');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [keyMoments, setKeyMoments] = useState<string[]>(existing?.keyMoments ?? []);
  const [defaultGenreSelection, setDefaultGenreSelection] = useState<string[]>(
    existing?.defaultGenreSelection ?? [],
  );
  const [slots, setSlots] = useState<SlotDraft[]>(
    existing ? toSlotDrafts(existing.slots) : [],
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function reset(pkg?: Package) {
    setLabel(pkg?.label ?? '');
    setIcon(pkg?.icon ?? 'music');
    setCategory(pkg?.category ?? '');
    setNotes(pkg?.notes ?? '');
    setKeyMoments(pkg?.keyMoments ?? []);
    setDefaultGenreSelection(pkg?.defaultGenreSelection ?? []);
    setSlots(pkg ? toSlotDrafts(pkg.slots) : []);
    setDeleteError(null);
    setConfirmDelete(false);
  }

  // Reset when drawer opens
  const [lastMode, setLastMode] = useState<DrawerMode | null>(null);
  if (open && mode !== lastMode) {
    setLastMode(mode);
    reset(existing ?? undefined);
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        label: label.trim(),
        icon,
        category: category || undefined,
        notes: notes.trim() || undefined,
        keyMoments,
        defaultGenreSelection,
        slots: slots.map((s, i) => ({
          id: s.id,
          label: s.label?.trim() || undefined,
          duration: s.duration,
          order: i,
        })),
      };
      if (isEdit) {
        return apiPatch<Package>(`/packages/${existing!.id}`, payload as UpdatePackageInput);
      }
      return apiPost<Package>('/packages', payload as CreatePackageInput);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    },
  });

  const deletePkg = useMutation({
    mutationFn: () => apiDelete(`/packages/${existing!.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['packages'] });
      onClose();
    },
    onError: (err: Error) => {
      setDeleteError(err.message || 'This package is used by existing bookings and cannot be deleted');
      setConfirmDelete(false);
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <PackageIcon icon={icon} size={16} />
            </div>
            <SheetTitle className="text-base">
              {isEdit ? 'Edit package' : 'New package'}
            </SheetTitle>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Package name"
            />
          </div>

          {/* Icon */}
          <IconPicker value={icon} onChange={setIcon} />

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-border rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              placeholder="Optional notes"
            />
          </div>

          {/* Key moments */}
          <TagInput label="Key moments" tags={keyMoments} onChange={setKeyMoments} />

          {/* Genre selection */}
          <TagInput
            label="Default genre selection"
            tags={defaultGenreSelection}
            onChange={setDefaultGenreSelection}
          />

          {/* Slots */}
          <SlotEditor slots={slots} onChange={setSlots} />
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex-shrink-0 space-y-3">
          {save.error && (
            <p className="text-sm text-status-cancelled">{(save.error as Error).message}</p>
          )}
          <Button
            onClick={() => save.mutate()}
            disabled={!label.trim() || save.isPending}
            className="w-full"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </Button>

          {isEdit && (
            <>
              {deleteError && (
                <p className="text-sm text-status-cancelled">{deleteError}</p>
              )}
              {confirmDelete ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => deletePkg.mutate()}
                    disabled={deletePkg.isPending}
                    className="flex-1"
                  >
                    {deletePkg.isPending ? 'Deleting…' : 'Confirm delete'}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)} className="flex-1">
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full text-status-cancelled hover:text-status-cancelled"
                >
                  Delete package
                </Button>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  onEdit,
}: {
  pkg: Package;
  onEdit: (pkg: Package) => void;
}) {
  const qc = useQueryClient();

  const toggle = useMutation({
    mutationFn: (enabled: boolean) =>
      apiPatch<Package>(`/packages/${pkg.id}`, { enabled } as UpdatePackageInput),
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: ['packages'] });
      const previous = qc.getQueryData<Package[]>(['packages']);
      qc.setQueryData<Package[]>(['packages'], (old) =>
        old?.map((p) => (p.id === pkg.id ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) qc.setQueryData(['packages'], context.previous);
      toast({ title: 'Failed to update package', variant: 'destructive' });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['packages'] }),
  });

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <PackageIcon icon={pkg.icon} size={15} />
          </div>
          <span className="text-sm font-medium text-foreground truncate">{pkg.label}</span>
        </div>
        <Switch
          checked={pkg.enabled}
          onCheckedChange={(checked) => toggle.mutate(checked)}
          aria-label={pkg.enabled ? 'Disable package' : 'Enable package'}
        />
      </div>

      {pkg.slots.length > 0 && (
        <ul className="space-y-1">
          {pkg.slots.map((slot) => (
            <li key={slot.id} className="text-sm text-muted flex items-center gap-2">
              <span className="flex-1 truncate">{slot.label || 'Unnamed'}</span>
              <span className="flex-shrink-0">{slot.duration} min</span>
            </li>
          ))}
        </ul>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => onEdit(pkg)}
        className="w-full"
      >
        Edit
      </Button>
    </Card>
  );
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  title,
  packages,
  onEdit,
}: {
  title: string;
  packages: Package[];
  onEdit: (pkg: Package) => void;
}) {
  if (packages.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onEdit={onEdit} />
        ))}
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PackagesPage() {
  const { isLoaded } = useAuth();
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<Package[]>('/packages'),
    enabled: isLoaded,
  });

  const grouped = PACKAGE_CATEGORY_ORDER.reduce<Record<string, Package[]>>((acc, cat) => {
    acc[cat] = packages.filter((p) => p.category === cat);
    return acc;
  }, {});
  const uncategorised = packages.filter((p) => !p.category);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Packages</h1>
        <Button onClick={() => setDrawerMode({ type: 'create' })}>+ New package</Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-surface rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && packages.length === 0 && (
        <EmptyState
          icon={<Music size={40} strokeWidth={1.5} />}
          heading="No packages yet"
          description="Create a package to get started."
          action={<Button onClick={() => setDrawerMode({ type: 'create' })}>New package</Button>}
        />
      )}

      {!isLoading && packages.length > 0 && (
        <div className="space-y-8">
          {PACKAGE_CATEGORY_ORDER.map((cat) => (
            <CategoryGroup
              key={cat}
              title={PACKAGE_CATEGORY_LABELS[cat]}
              packages={grouped[cat]}
              onEdit={(pkg) => setDrawerMode({ type: 'edit', pkg })}
            />
          ))}
          <CategoryGroup
            title="Uncategorised"
            packages={uncategorised}
            onEdit={(pkg) => setDrawerMode({ type: 'edit', pkg })}
          />
        </div>
      )}

      {drawerMode && (
        <PackageDrawer
          mode={drawerMode}
          open={drawerMode != null}
          onClose={() => setDrawerMode(null)}
        />
      )}
    </div>
  );
}
