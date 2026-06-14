import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Music } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { PACKAGE_ICON_MAP } from '@/lib/constants';
import type {
  BookingDetail,
  BookingPackageSummary,
  Package,
  PerformanceSet,
} from '@/types/api';

function FormatIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = PACKAGE_ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}

// ─── Set edit row ─────────────────────────────────────────────────────────────

function SetEditRow({
  set,
  bookingId,
  onDelete,
}: {
  set: PerformanceSet;
  bookingId: string;
  onDelete: (setId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(set.label ?? '');
  const [duration, setDuration] = useState(set.duration.toString());
  const [startTime, setStartTime] = useState(set.startTime ?? '');
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Sync from server after query invalidation
  useEffect(() => {
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

  function handleBlur() {
    const dirty =
      (label.trim() || null) !== (set.label ?? null) ||
      (parseInt(duration, 10) || 0) !== set.duration ||
      (startTime || null) !== (set.startTime ?? null);
    if (!dirty || saveMutation.isPending) return;
    saveMutation.mutate({ label, duration, startTime });
  }

  const isPending = saveMutation.isPending;

  return (
    <div className="border-b border-border last:border-0">
      <div className="grid grid-cols-[1fr_5rem_5rem_1.25rem] items-center gap-2 py-2">
        <input
          type="text"
          value={label}
          placeholder="Label"
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleBlur}
          disabled={isPending}
          className="text-sm text-foreground border border-border rounded px-2 py-0.5 bg-background min-w-0 disabled:opacity-50"
          aria-label="Set label"
        />
        <input
          type="number"
          value={duration}
          min={1}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={handleBlur}
          disabled={isPending}
          className="text-sm text-foreground border border-border rounded px-2 py-0.5 bg-background w-full disabled:opacity-50"
          aria-label="Duration in minutes"
        />
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          onBlur={handleBlur}
          disabled={isPending}
          className="text-sm text-muted border border-border rounded px-2 py-0.5 bg-background disabled:opacity-50"
          aria-label="Start time"
        />
        <button
          type="button"
          onClick={() => onDelete(set.id)}
          disabled={isPending}
          className="text-muted hover:text-status-cancelled transition-colors disabled:opacity-50"
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function PerformanceEditor({ booking, isOpen }: { booking: BookingDetail; isOpen: boolean }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmRemoveFormatId, setConfirmRemoveFormatId] = useState<string | null>(null);

  const { data: allFormats = [], isLoading: formatsLoading } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<Package[]>('/packages'),
    enabled: addOpen,
  });

  const [otherOpen, setOtherOpen] = useState(false);

  const appliedFormatIds = new Set(
    (booking.packages ?? []).map((bpf) => bpf.packageId),
  );
  const enabledUnapplied = allFormats.filter((f) => f.enabled && !appliedFormatIds.has(f.id));
  const matchingFormats = enabledUnapplied.filter((f) => f.category === booking.eventType);
  const otherFormats = enabledUnapplied.filter((f) => f.category !== booking.eventType);
  const availableFormats = enabledUnapplied;

  useEffect(() => {
    if (isOpen) {
      setConfirmRemoveFormatId(null);
    }
  }, [isOpen]);

  const applyFormat = useMutation({
    mutationFn: (formatId: string) =>
      apiPost(`/bookings/${booking.id}/formats`, { formatId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      setAddOpen(false);
    },
    onError: () => {
      toast({ title: 'Failed to add package. Please try again.', variant: 'destructive' });
    },
  });

  const removeFormat = useMutation({
    mutationFn: (bookingFormatId: string) =>
      apiDelete(`/bookings/${booking.id}/formats/${bookingFormatId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
    onError: () => {
      toast({ title: 'Failed to remove package. Please try again.', variant: 'destructive' });
    },
  });

  const addSet = useMutation({
    mutationFn: (payload: { packageId: string; order: number }) =>
      apiPost(`/bookings/${booking.id}/sets`, {
        packageId: payload.packageId,
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

  function handleRemoveFormat(bpf: BookingPackageSummary) {
    const sets = (booking.sets ?? []).filter((s) => s.packageId === bpf.packageId);
    const hasStartTimes = sets.some((s) => s.startTime);
    if (hasStartTimes) {
      setConfirmRemoveFormatId(bpf.id);
      return;
    }
    removeFormat.mutate(bpf.id);
  }

  function handleAddSet(bpf: BookingPackageSummary) {
    const nextOrder = Math.max(0, ...(booking.sets ?? []).map((s) => s.order)) + 1;
    addSet.mutate({ packageId: bpf.packageId, order: nextOrder });
  }

  const setsByFormatId = new Map<string | null, PerformanceSet[]>();
  for (const set of booking.sets ?? []) {
    const key = set.packageId ?? null;
    if (!setsByFormatId.has(key)) setsByFormatId.set(key, []);
    setsByFormatId.get(key)!.push(set);
  }
  const unassigned = setsByFormatId.get(null) ?? [];

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">Packages</p>

      {(booking.packages ?? []).length === 0 && unassigned.length === 0 && (
        <p className="text-sm text-muted mb-3">No packages added yet.</p>
      )}

      {(booking.packages ?? []).map((bpf) => {
        const sets = setsByFormatId.get(bpf.packageId) ?? [];
        return (
          <div key={bpf.id} className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <FormatIcon icon={bpf.package.icon} />
                {bpf.package.label}
              </span>
              {confirmRemoveFormatId === bpf.id ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { removeFormat.mutate(bpf.id); setConfirmRemoveFormatId(null); }}
                    disabled={removeFormat.isPending}
                    className="text-xs text-status-cancelled hover:text-status-cancelled/80 transition-colors disabled:opacity-50"
                  >
                    {removeFormat.isPending ? 'Removing…' : 'Confirm remove'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveFormatId(null)}
                    className="text-xs text-muted hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleRemoveFormat(bpf)}
                  disabled={removeFormat.isPending}
                  className="text-muted hover:text-status-cancelled transition-colors disabled:opacity-50"
                  aria-label={`Remove ${bpf.package.label}`}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </div>

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

      {unassigned.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium text-foreground mb-1">Other sets</p>
          {unassigned.map((set) => (
            <SetEditRow
              key={set.id}
              set={set}
              bookingId={booking.id}
              onDelete={(id) => deleteSet.mutate(id)}
            />
          ))}
        </div>
      )}

      {!addOpen ? (
        <GhostButton
          onClick={() => setAddOpen(true)}
          variant="primary"
          icon={<Plus size={14} aria-hidden="true" />}
        >
          Add packages
        </GhostButton>
      ) : (
        <div className="space-y-2">
          <SubLabel>Select a format</SubLabel>
          {formatsLoading && <p className="text-sm text-muted">Loading…</p>}
          {!formatsLoading && availableFormats.length === 0 && (
            <p className="text-sm text-muted">All formats already applied.</p>
          )}
          {!formatsLoading && availableFormats.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {(matchingFormats.length > 0 ? matchingFormats : otherFormats).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    disabled={applyFormat.isPending}
                    onClick={() => applyFormat.mutate(fmt.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary transition-colors disabled:opacity-50"
                  >
                    <FormatIcon icon={fmt.icon} />
                    {fmt.label}
                  </button>
                ))}
              </div>
              {matchingFormats.length > 0 && otherFormats.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setOtherOpen((o) => !o)}
                    className="text-sm text-muted hover:text-foreground transition-colors"
                  >
                    {otherOpen ? '▾' : '▸'} Other packages ({otherFormats.length})
                  </button>
                  {otherOpen && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {otherFormats.map((fmt) => (
                        <button
                          key={fmt.id}
                          type="button"
                          disabled={applyFormat.isPending}
                          onClick={() => applyFormat.mutate(fmt.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:border-primary transition-colors disabled:opacity-50"
                        >
                          <FormatIcon icon={fmt.icon} />
                          {fmt.label}
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
