import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Heart, GlassWater, Utensils, Moon, Briefcase, Music, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import type {
  BookingDetail,
  BookingPerformanceFormatSummary,
  PerformanceFormat,
  PerformanceSet,
} from '@/types/api';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const FORMAT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  heart: Heart,
  'glass-water': GlassWater,
  utensils: Utensils,
  moon: Moon,
  briefcase: Briefcase,
  music: Music,
  'music-2': Music2,
};

function FormatIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const Icon = FORMAT_ICON_MAP[icon] ?? Music;
  return <Icon size={size} />;
}

// ─── Set edit row ─────────────────────────────────────────────────────────────

type SetValues = { label: string; duration: string; startTime: string };

function SetEditRow({
  set,
  onChange,
  onDelete,
}: {
  set: PerformanceSet;
  onChange: (setId: string, values: SetValues) => void;
  onDelete: (setId: string) => void;
}) {
  const [label, setLabel] = useState(set.label ?? '');
  const [duration, setDuration] = useState(set.duration.toString());
  const [startTime, setStartTime] = useState(set.startTime ?? '');

  return (
    <div className="grid grid-cols-[1fr_5rem_5rem_1.25rem] items-center gap-2 py-2 border-b border-border last:border-0">
      <input
        type="text"
        value={label}
        placeholder="Label"
        onChange={(e) => {
          setLabel(e.target.value);
          onChange(set.id, { label: e.target.value, duration, startTime });
        }}
        className="text-sm text-foreground border border-border rounded px-2 py-0.5 bg-background min-w-0"
        aria-label="Set label"
      />
      <input
        type="number"
        value={duration}
        min={1}
        onChange={(e) => {
          setDuration(e.target.value);
          onChange(set.id, { label, duration: e.target.value, startTime });
        }}
        className="text-sm text-foreground border border-border rounded px-2 py-0.5 bg-background w-full"
        aria-label="Duration in minutes"
      />
      <input
        type="time"
        value={startTime}
        onChange={(e) => {
          setStartTime(e.target.value);
          onChange(set.id, { label, duration, startTime: e.target.value });
        }}
        className="text-sm text-muted border border-border rounded px-2 py-0.5 bg-background"
        aria-label="Start time"
      />
      <button
        type="button"
        onClick={() => onDelete(set.id)}
        className="text-muted hover:text-status-cancelled transition-colors"
        aria-label="Remove set"
      >
        <Trash2 size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PerformanceEditor({ booking }: { booking: BookingDetail }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, SetValues>>(new Map());
  const [discardKey, setDiscardKey] = useState(0);
  const [confirmRemoveFormatId, setConfirmRemoveFormatId] = useState<string | null>(null);

  const { data: allFormats = [], isLoading: formatsLoading } = useQuery({
    queryKey: ['performance-formats'],
    queryFn: () => apiGet<PerformanceFormat[]>('/performance-formats'),
    enabled: addOpen,
  });

  const appliedFormatIds = new Set(
    (booking.performanceFormats ?? []).map((bpf) => bpf.performanceFormatId),
  );
  const availableFormats = allFormats.filter((f) => !appliedFormatIds.has(f.id));

  function handleSetChange(setId: string, values: SetValues) {
    const original = (booking.sets ?? []).find((s) => s.id === setId);
    if (!original) return;
    const dirty =
      (values.label.trim() || null) !== (original.label ?? null) ||
      (parseInt(values.duration, 10) || 0) !== original.duration ||
      (values.startTime || null) !== (original.startTime ?? null);
    setPendingEdits((prev) => {
      const next = new Map(prev);
      if (dirty) next.set(setId, values);
      else next.delete(setId);
      return next;
    });
  }

  const saveEdits = useMutation({
    mutationFn: () =>
      Promise.all(
        Array.from(pendingEdits.entries()).map(([setId, values]) =>
          apiPatch(`/bookings/${booking.id}/sets/${setId}`, {
            label: values.label.trim() || null,
            duration: parseInt(values.duration, 10) || 1,
            startTime: values.startTime || null,
          }),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      setPendingEdits(new Map());
    },
  });

  function handleDiscard() {
    setPendingEdits(new Map());
    setDiscardKey((k) => k + 1);
  }

  const applyFormat = useMutation({
    mutationFn: (formatId: string) =>
      apiPost(`/bookings/${booking.id}/formats`, { formatId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      setAddOpen(false);
    },
  });

  const removeFormat = useMutation({
    mutationFn: (bookingFormatId: string) =>
      apiDelete(`/bookings/${booking.id}/formats/${bookingFormatId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
  });

  const addSet = useMutation({
    mutationFn: (payload: { performanceFormatId: string; order: number }) =>
      apiPost(`/bookings/${booking.id}/sets`, {
        performanceFormatId: payload.performanceFormatId,
        order: payload.order,
        duration: 30,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
  });

  const deleteSet = useMutation({
    mutationFn: (setId: string) => apiDelete(`/bookings/${booking.id}/sets/${setId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
  });

  function handleRemoveFormat(bpf: BookingPerformanceFormatSummary) {
    const sets = (booking.sets ?? []).filter((s) => s.performanceFormatId === bpf.performanceFormatId);
    const hasStartTimes = sets.some((s) => s.startTime);
    if (hasStartTimes) {
      setConfirmRemoveFormatId(bpf.id);
      return;
    }
    removeFormat.mutate(bpf.id);
  }

  function handleAddSet(bpf: BookingPerformanceFormatSummary) {
    const nextOrder = Math.max(0, ...(booking.sets ?? []).map((s) => s.order)) + 1;
    addSet.mutate({ performanceFormatId: bpf.performanceFormatId, order: nextOrder });
  }

  const setsByFormatId = new Map<string | null, PerformanceSet[]>();
  for (const set of booking.sets ?? []) {
    const key = set.performanceFormatId ?? null;
    if (!setsByFormatId.has(key)) setsByFormatId.set(key, []);
    setsByFormatId.get(key)!.push(set);
  }
  const unassigned = setsByFormatId.get(null) ?? [];

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">Performance</p>

      {(booking.performanceFormats ?? []).length === 0 && unassigned.length === 0 && (
        <p className="text-sm text-muted mb-3">No formats applied yet.</p>
      )}

      {(booking.performanceFormats ?? []).map((bpf) => {
        const sets = setsByFormatId.get(bpf.performanceFormatId) ?? [];
        return (
          <div key={bpf.id} className="mb-5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <FormatIcon icon={bpf.performanceFormat.icon} />
                {bpf.performanceFormat.label}
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
                  aria-label={`Remove ${bpf.performanceFormat.label}`}
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
                key={`${set.id}-${discardKey}`}
                set={set}
                onChange={handleSetChange}
                onDelete={(id) => deleteSet.mutate(id)}
              />
            ))}

            <button
              type="button"
              onClick={() => handleAddSet(bpf)}
              disabled={addSet.isPending}
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
            >
              <Plus size={12} aria-hidden="true" />
              Add set
            </button>
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="mb-5">
          <p className="text-sm font-medium text-foreground mb-1">Other sets</p>
          {unassigned.map((set) => (
            <SetEditRow
              key={`${set.id}-${discardKey}`}
              set={set}
              onChange={handleSetChange}
              onDelete={(id) => deleteSet.mutate(id)}
            />
          ))}
        </div>
      )}

      {/* Section-level save bar */}
      {pendingEdits.size > 0 && (
        <div className="mb-4 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted">
            {pendingEdits.size === 1 ? '1 unsaved change' : `${pendingEdits.size} unsaved changes`}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleDiscard}
              disabled={saveEdits.isPending}
            >
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => saveEdits.mutate()}
              disabled={saveEdits.isPending}
            >
              {saveEdits.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}

      {saveEdits.isError && (
        <p className="text-xs text-status-cancelled mb-3">Failed to save. Please try again.</p>
      )}

      {!addOpen ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          <Plus size={14} aria-hidden="true" />
          Add format
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">Select a format</p>
          {formatsLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : availableFormats.length === 0 ? (
            <p className="text-sm text-muted">All formats already applied.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableFormats.map((fmt) => (
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
