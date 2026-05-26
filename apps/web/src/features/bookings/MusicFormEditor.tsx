import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiGet, apiPut } from '@/lib/api';
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

  const { data: config, isLoading } = useQuery({
    queryKey: ['booking-music-form-config', booking.id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`),
    enabled: isLoaded && booking.hasMusicFormConfig,
  });

  // Reset when drawer re-opens
  useEffect(() => {
    if (isOpen) setInitialized(false);
  }, [isOpen]);

  // Initialize local state from fetched config
  useEffect(() => {
    if (!config || initialized) return;

    const existing = config.keyMoments ?? [];
    const existingKeys = new Set(existing.map((km) => `${km.section}::${km.label}`));
    const fromFormats: KeyMoment[] = (booking.performanceFormats ?? []).flatMap((bpf) =>
      bpf.performanceFormat.keyMoments.map((km) => ({
        label: km,
        section: bpf.performanceFormat.label,
      })),
    );
    const merged = [
      ...existing,
      ...fromFormats.filter((km) => !existingKeys.has(`${km.section}::${km.label}`)),
    ];
    const seedGenres = [
      ...new Set(
        (booking.performanceFormats ?? []).flatMap((bpf) => bpf.performanceFormat.defaultGenreSelection),
      ),
    ];
    setLocalKeyMoments(merged);
    setLocalGenres(config.enabledGenres?.length ? config.enabledGenres : seedGenres);
    setInitialized(true);
  }, [config, initialized, booking.performanceFormats]);

  const save = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`, {
        keyMoments: localKeyMoments,
        enabledGenres: localGenres,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
    },
  });

  if (!booking.hasMusicFormConfig) return null;

  if (isLoading || !initialized) {
    return (
      <div>
        <p className="text-sm font-medium text-foreground mb-3">Music form</p>
        <div className="h-16 bg-border rounded animate-pulse" />
      </div>
    );
  }

  const sectionMap = new Map<string, KeyMoment[]>();
  for (const km of localKeyMoments) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

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
          {sectionMap.size === 0 ? (
            <p className="text-sm text-muted">No key moments configured.</p>
          ) : (
            <div className="space-y-3">
              {Array.from(sectionMap.entries()).map(([section, moments]) => (
                <div key={section}>
                  <p className="text-xs text-muted uppercase tracking-wide mb-1">{section}</p>
                  <div className="space-y-1">
                    {moments.map((km, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <input
                          value={km.label}
                          onChange={(e) => {
                            const updated = localKeyMoments.map((m) =>
                              m === km ? { ...m, label: e.target.value } : m,
                            );
                            setLocalKeyMoments(updated);
                          }}
                          className="flex-1 text-sm bg-background border border-border rounded px-2 py-1"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setLocalKeyMoments((prev) => prev.filter((m) => m !== km))
                          }
                          className="text-muted hover:text-status-cancelled transition-colors"
                          aria-label="Remove key moment"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
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

        <div className="flex items-center gap-3 pt-1">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save music form'}
          </Button>
          {save.isSuccess && (
            <span className="text-xs text-muted">Saved</span>
          )}
        </div>
      </div>
    </div>
  );
}
