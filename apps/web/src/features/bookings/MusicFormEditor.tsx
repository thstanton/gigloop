import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GhostButton } from '@/components/common/GhostButton';
import { apiGet, apiPut, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { ALL_GENRES, GENRE_LABELS } from '@/lib/constants';
import type { BookingDetail, KeyMoment, MusicFormConfig } from '@/types/api';

export default function MusicFormEditor({
  booking,
  isOpen,
}: {
  booking: BookingDetail;
  isOpen: boolean;
}) {
  const queryClient = useQueryClient();
  const { isLoaded } = useAuth();

  const [localKeyMoments, setLocalKeyMoments] = useState<KeyMoment[]>([]);
  const [localGenres, setLocalGenres] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['booking-music-form-config', booking.id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`),
    enabled: isLoaded && booking.hasMusicFormConfig,
  });

  // Initialize local state from fetched config (or seed from packages for first-time setup)
  useEffect(() => {
    if (initialized) return;

    // First-time setup starts empty (ADR-0046 / #502): provenance is severed, so
    // booking Packages carry no key moments to seed from. The musician adds moments
    // here, or applies a Package Template which *suggests* its moments (PerformanceEditor).
    if (!booking.hasMusicFormConfig) {
      setLocalKeyMoments([]);
      setLocalGenres([]);
      setInitialized(true);
      return;
    }

    if (!config) return;

    setLocalKeyMoments(config.keyMoments ?? []);
    setLocalGenres(config.enabledGenres ?? []);
    setInitialized(true);
  }, [config, initialized, booking.packages, booking.hasMusicFormConfig]);

  const save = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`, {
        // Drop blank rows; a moment with no label is meaningless.
        keyMoments: localKeyMoments
          .filter((km) => km.label.trim())
          .map((km) => ({ label: km.label.trim(), section: km.section })),
        enabledGenres: localGenres,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
    },
    onError: () => toast({ title: 'Failed to save. Please try again.', variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: () => apiDelete(`/bookings/${booking.id}/music-form-config`),
    onSuccess: () => {
      setConfirmRemove(false);
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
    },
    onError: () => toast({ title: 'Failed to remove music form. Please try again.', variant: 'destructive' }),
  });

  const { reset: saveReset } = save;
  const { reset: removeReset } = remove;

  // Reset when drawer re-opens
  useEffect(() => {
    if (isOpen) {
      setInitialized(false);
      setConfirmRemove(false);
      saveReset();
      removeReset();
    }
  }, [isOpen, saveReset, removeReset]);

  if (booking.hasMusicFormConfig && (isLoading || !initialized)) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Music form</p>
        <div className="h-16 bg-border rounded animate-pulse" />
      </div>
    );
  }

  // Section is constrained to the booking's Packages or "Other" — no free-text
  // (ADR-0046 / #502). Packages can share a label, so de-dupe.
  const sectionOptions = Array.from(
    new Set([...(booking.packages ?? []).map((p) => p.label), 'Other']),
  );

  function toggleGenre(genre: string) {
    setLocalGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-3">Music form</p>

      <div className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted mb-2">Key moments</p>
          {localKeyMoments.length === 0 ? (
            <p className="text-sm text-muted mb-2">No key moments yet.</p>
          ) : (
            <div className="space-y-1 mb-2">
              {localKeyMoments.map((km, i) => {
                // Keep the moment's own section selectable even if it's stale
                // (e.g. the package was renamed after the moment was created).
                const opts = sectionOptions.includes(km.section)
                  ? sectionOptions
                  : [...sectionOptions, km.section];
                return (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={km.label}
                      placeholder="Key moment"
                      onChange={(e) =>
                        setLocalKeyMoments((prev) =>
                          prev.map((m, j) => (j === i ? { ...m, label: e.target.value } : m)),
                        )
                      }
                      className="flex-1 min-w-0 text-sm bg-background border border-border rounded px-2 py-1"
                      aria-label="Key moment label"
                    />
                    <select
                      value={km.section}
                      onChange={(e) =>
                        setLocalKeyMoments((prev) =>
                          prev.map((m, j) => (j === i ? { ...m, section: e.target.value } : m)),
                        )
                      }
                      className="text-sm bg-background border border-border rounded px-2 py-1"
                      aria-label="Key moment section"
                    >
                      {opts.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setLocalKeyMoments((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted hover:text-status-cancelled transition-colors flex-shrink-0"
                      aria-label="Remove key moment"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <GhostButton
            onClick={() =>
              setLocalKeyMoments((prev) => [...prev, { label: '', section: 'Other' }])
            }
            variant="primary"
            size="xs"
            icon={<Plus size={12} aria-hidden="true" />}
          >
            Add key moment
          </GhostButton>
        </div>

        <div>
          <p className="text-xs font-medium text-muted mb-2">Enabled genres</p>
          <div className="flex flex-wrap gap-2">
            {ALL_GENRES.map((genre) => {
              const active = localGenres.includes(genre);
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className={`inline-flex items-center px-3 py-1 rounded-full border text-sm transition-colors ${
                    active
                      ? 'border-primary text-primary bg-primary/8'
                      : 'border-border text-muted hover:border-primary'
                  }`}
                >
                  {GENRE_LABELS[genre as keyof typeof GENRE_LABELS] ?? genre}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || remove.isPending}>
            {save.isPending ? 'Saving…' : 'Save music form'}
          </Button>
          {save.isSuccess && !confirmRemove && (
            <span className="text-xs text-muted">Saved</span>
          )}
          {booking.hasMusicFormConfig && (!confirmRemove ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmRemove(true)}
              disabled={save.isPending || remove.isPending}
              className="text-status-cancelled hover:text-status-cancelled/80"
            >
              <Trash2 size={14} className="mr-1" />
              Remove music form
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
              >
                {remove.isPending ? 'Removing…' : 'Yes, remove'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
            </>
          ))}
        </div>
      </div>
    </div>
  );
}
