import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { PackageIcon } from '@/components/common/PackageIcon';
import { IconPicker } from '@/components/common/IconPicker';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type {
  BookingDetail,
  BookingPackageSummary,
  PackageTemplate,
  PerformanceSet,
} from '@/types/api';

// ─── Set edit row ─────────────────────────────────────────────────────────────

function SetEditRow({
  set,
  bookingId,
  onDelete,
  isDeleting = false,
}: {
  set: PerformanceSet;
  bookingId: string;
  onDelete: (setId: string) => void;
  isDeleting?: boolean;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(set.label ?? '');
  const [duration, setDuration] = useState(set.duration.toString());
  const [startTime, setStartTime] = useState(set.startTime ?? '');
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowFocused = useRef(false);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Sync from server after query invalidation — but never while the user is
  // mid-edit, or an in-flight save resolving would clobber what they retyped.
  useEffect(() => {
    if (rowFocused.current) return;
    setLabel(set.label ?? '');
    setDuration(set.duration.toString());
    setStartTime(set.startTime ?? '');
  }, [set.label, set.duration, set.startTime]);

  const saveMutation = useMutation({
    mutationFn: (values: { label: string; duration: string; startTime: string }) =>
      apiPatch(`/bookings/${bookingId}/sets/${set.id}`, {
        label: values.label.trim() || null,
        duration: parseInt(values.duration, 10) || 1,
        startTime: values.startTime || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      setSavedVisible(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedVisible(false), 2000);
    },
    onError: () => {
      toast({ title: 'Failed to save set. Please try again.', variant: 'destructive' });
    },
  });

  function handleRowFocus() {
    rowFocused.current = true;
  }

  // Save once when focus leaves the whole row — not when tabbing between the
  // fields within it — so a multi-field edit isn't interrupted mid-flow.
  function handleRowBlur(e: FocusEvent<HTMLDivElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    rowFocused.current = false;
    const dirty =
      (label.trim() || null) !== (set.label ?? null) ||
      (parseInt(duration, 10) || 0) !== set.duration ||
      (startTime || null) !== (set.startTime ?? null);
    if (!dirty) return;
    saveMutation.mutate({ label, duration, startTime });
  }

  const isPending = saveMutation.isPending;

  return (
    <div
      className="border-b border-border last:border-0"
      onFocus={handleRowFocus}
      onBlur={handleRowBlur}
    >
      <div className="grid grid-cols-[1fr_5rem_5rem_1.25rem] items-center gap-2 py-2">
        <input
          type="text"
          value={label}
          placeholder="Label"
          onChange={(e) => setLabel(e.target.value)}
          className="text-sm text-foreground border border-border rounded px-2 py-0.5 bg-background min-w-0"
          aria-label="Set label"
        />
        <input
          type="number"
          value={duration}
          min={1}
          onChange={(e) => setDuration(e.target.value)}
          className="text-sm text-foreground border border-border rounded px-2 py-0.5 bg-background w-full"
          aria-label="Duration in minutes"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="text-sm text-muted border border-border rounded px-2 py-0.5 bg-background"
          aria-label="Start time"
        />
        <button
          type="button"
          onClick={() => onDelete(set.id)}
          disabled={isPending || isDeleting}
          className="text-muted hover:text-status-cancelled transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Remove set"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      {(isPending || savedVisible) && (
        <p className={`text-xs pb-1.5 ${isPending ? 'text-muted' : 'text-status-confirmed'}`}>
          {isPending ? 'Saving…' : 'Saved'}
        </p>
      )}
    </div>
  );
}

// ─── Package header (rename / re-icon / remove) ─────────────────────────────────

function PackageHeader({
  pkg,
  onUpdate,
  onRemove,
  isRemoving,
}: {
  pkg: BookingPackageSummary;
  onUpdate: (dto: { label?: string; icon?: string }) => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const [label, setLabel] = useState(pkg.label);
  const [iconOpen, setIconOpen] = useState(false);

  // Re-sync when the server value changes (e.g. after a save invalidation).
  useEffect(() => setLabel(pkg.label), [pkg.label]);

  function commitLabel() {
    const next = label.trim();
    if (!next || next === pkg.label) {
      setLabel(pkg.label);
      return;
    }
    onUpdate({ label: next });
  }

  return (
    <div className="mb-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setIconOpen((o) => !o)}
            className="text-foreground hover:text-primary transition-colors flex-shrink-0"
            aria-label={`Change ${pkg.label} icon`}
          >
            <PackageIcon icon={pkg.icon} />
          </button>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            className="text-sm font-medium text-foreground bg-transparent border border-transparent hover:border-border focus:border-border rounded px-1 py-0.5 min-w-0 flex-1"
            aria-label={`Package name`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={isRemoving}
          className="text-muted hover:text-status-cancelled transition-colors disabled:opacity-50 flex-shrink-0"
          aria-label={`Remove ${pkg.label}`}
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
      {iconOpen && (
        <div className="mt-2 mb-1">
          <IconPicker
            value={pkg.icon}
            onChange={(icon) => { onUpdate({ icon }); setIconOpen(false); }}
            label={null}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PerformanceEditor({ booking, isOpen }: { booking: BookingDetail; isOpen: boolean }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: allTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<PackageTemplate[]>('/packages'),
    enabled: addOpen,
  });

  const [otherOpen, setOtherOpen] = useState(false);

  // Provenance is severed (ADR-0046): booking-owned Packages carry no FK back to the
  // template, so we can't filter already-applied templates. All enabled templates are shown.
  const enabledTemplates = allTemplates.filter((t) => t.enabled);
  const matchingTemplates = enabledTemplates.filter((t) => t.category === booking.eventType);
  const otherTemplates = enabledTemplates.filter((t) => t.category !== booking.eventType);
  const availableTemplates = enabledTemplates;

  useEffect(() => {
    if (isOpen) setAddOpen(false);
  }, [isOpen]);

  const applyTemplate = useMutation({
    mutationFn: (packageTemplateId: string) =>
      apiPost(`/bookings/${booking.id}/packages`, { packageTemplateId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      setAddOpen(false);
    },
    onError: () => {
      toast({ title: 'Failed to add package. Please try again.', variant: 'destructive' });
    },
  });

  const updatePackage = useMutation({
    mutationFn: ({ packageId, ...dto }: { packageId: string; label?: string; icon?: string }) =>
      apiPatch(`/bookings/${booking.id}/packages/${packageId}`, dto),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
    onError: () => {
      toast({ title: 'Failed to update package. Please try again.', variant: 'destructive' });
    },
  });

  // Removing a package is non-destructive — its sets orphan to ungrouped (#500),
  // so no confirmation is needed.
  const removePackage = useMutation({
    mutationFn: (packageId: string) =>
      apiDelete(`/bookings/${booking.id}/packages/${packageId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
    onError: () => {
      toast({ title: 'Failed to remove package. Please try again.', variant: 'destructive' });
    },
  });

  const addSet = useMutation({
    mutationFn: (payload: { packageId?: string; order: number }) =>
      apiPost(`/bookings/${booking.id}/sets`, {
        ...(payload.packageId ? { packageId: payload.packageId } : {}),
        order: payload.order,
        duration: 30,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
    onError: () => {
      toast({ title: 'Failed to add set. Please try again.', variant: 'destructive' });
    },
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => apiDelete(`/bookings/${booking.id}/sets/${setId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
    onError: () => {
      toast({ title: 'Failed to delete set. Please try again.', variant: 'destructive' });
    },
  });

  function nextSetOrder() {
    return Math.max(0, ...(booking.sets ?? []).map((s) => s.order)) + 1;
  }

  function handleAddSet(bpf: BookingPackageSummary) {
    addSet.mutate({ packageId: bpf.id, order: nextSetOrder() });
  }

  function handleAddUngroupedSet() {
    addSet.mutate({ order: nextSetOrder() });
  }

  const setsByPackageId = new Map<string | null, PerformanceSet[]>();
  for (const set of booking.sets ?? []) {
    const key = set.packageId ?? null;
    if (!setsByPackageId.has(key)) setsByPackageId.set(key, []);
    setsByPackageId.get(key)!.push(set);
  }
  const unassigned = setsByPackageId.get(null) ?? [];

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">Packages</p>

      {(booking.packages ?? []).length === 0 && unassigned.length === 0 && (
        <p className="text-sm text-muted mb-3">No packages added yet.</p>
      )}

      {(booking.packages ?? []).map((bpf) => {
        const sets = setsByPackageId.get(bpf.id) ?? [];
        return (
          <div key={bpf.id} className="mb-5">
            <PackageHeader
              pkg={bpf}
              onUpdate={(dto) => updatePackage.mutate({ packageId: bpf.id, ...dto })}
              onRemove={() => removePackage.mutate(bpf.id)}
              isRemoving={removePackage.isPending && removePackage.variables === bpf.id}
            />

            {sets.length > 0 && (
              <div className="text-xs text-muted grid grid-cols-[1fr_5rem_5rem_1.25rem] gap-2 pb-1 mb-1 border-b border-border">
                <span className="pl-2">Label</span>
                <span className="pl-2">Min</span>
                <span className="pl-2">Start</span>
                <span />
              </div>
            )}

            {sets.map((set) => (
              <SetEditRow
                key={set.id}
                set={set}
                bookingId={booking.id}
                onDelete={(id) => deleteSet.mutate(id)}
                isDeleting={deleteSet.isPending && deleteSet.variables === set.id}
              />
            ))}

            <GhostButton
              onClick={() => handleAddSet(bpf)}
              disabled={addSet.isPending}
              variant="primary"
              size="xs"
              icon={<Plus size={12} aria-hidden="true" />}
              className="mt-1"
            >
              Add set
            </GhostButton>
          </div>
        );
      })}

      {/* Ungrouped sets (packageId null) render flat with no heading — #500.
          A top border separates them from package sections above. */}
      {unassigned.length > 0 && (
        <div className={`mb-5 ${(booking.packages ?? []).length > 0 ? 'pt-3 border-t border-border' : ''}`}>
          <div className="text-xs text-muted grid grid-cols-[1fr_5rem_5rem_1.25rem] gap-2 pb-1 mb-1 border-b border-border">
            <span className="pl-2">Label</span>
            <span className="pl-2">Min</span>
            <span className="pl-2">Start</span>
            <span />
          </div>
          {unassigned.map((set) => (
            <SetEditRow
              key={set.id}
              set={set}
              bookingId={booking.id}
              onDelete={(id) => deleteSet.mutate(id)}
              isDeleting={deleteSet.isPending && deleteSet.variables === set.id}
            />
          ))}
        </div>
      )}

      {!addOpen ? (
        <div className="flex flex-wrap items-center gap-4">
          <GhostButton
            onClick={() => setAddOpen(true)}
            variant="primary"
            icon={<Plus size={14} aria-hidden="true" />}
          >
            Add packages
          </GhostButton>
          <GhostButton
            onClick={handleAddUngroupedSet}
            disabled={addSet.isPending}
            icon={<Plus size={14} aria-hidden="true" />}
          >
            Add set
          </GhostButton>
        </div>
      ) : (
        <div className="space-y-2">
          <SubLabel>Select a package</SubLabel>
          {templatesLoading && <p className="text-sm text-muted">Loading…</p>}
          {!templatesLoading && availableTemplates.length === 0 && (
            <p className="text-sm text-muted">No package templates available.</p>
          )}
          {!templatesLoading && availableTemplates.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(matchingTemplates.length > 0 ? matchingTemplates : otherTemplates).map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    disabled={applyTemplate.isPending}
                    onClick={() => applyTemplate.mutate(tmpl.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary transition-colors disabled:opacity-50"
                  >
                    <PackageIcon icon={tmpl.icon} />
                    {tmpl.label}
                  </button>
                ))}
              </div>
              {matchingTemplates.length > 0 && otherTemplates.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setOtherOpen((o) => !o)}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {otherOpen ? '▾' : '▸'} Other packages ({otherTemplates.length})
                  </button>
                  {otherOpen && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {otherTemplates.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          disabled={applyTemplate.isPending}
                          onClick={() => applyTemplate.mutate(tmpl.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary transition-colors disabled:opacity-50"
                        >
                          <PackageIcon icon={tmpl.icon} />
                          {tmpl.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(false)}
            className="text-sm text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
