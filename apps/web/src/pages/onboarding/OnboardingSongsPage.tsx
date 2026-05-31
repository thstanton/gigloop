import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import type { CatalogueGroup } from '@/types/api';

export default function OnboardingSongsPage() {
  const navigate = useNavigate();
  const { isLoaded } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: catalogue = [], isLoading } = useQuery({
    queryKey: ['songs-catalogue'],
    queryFn: () => apiGet<CatalogueGroup[]>('/songs/catalogue'),
    enabled: isLoaded,
  });

  const { mutate: seed, isPending } = useMutation({
    mutationFn: (ids: string[]) => apiPost('/songs/seed', { ids }),
    onSuccess: () => navigate('/onboarding/packages'),
  });

  function toggleGenre(group: CatalogueGroup) {
    const ids = group.songs.map((s) => s.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) { ids.forEach((id) => next.delete(id)); }
      else { ids.forEach((id) => next.add(id)); }
      return next;
    });
  }

  function toggleSong(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleNext() {
    if (selected.size > 0) seed(Array.from(selected));
    else navigate('/onboarding/packages');
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-foreground">Add songs to your repertoire</h1>
        <p className="text-base text-muted mt-1">
          Select songs to add to your library. You can add more later in Settings.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-border/40 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {catalogue.map((group) => {
            const groupIds = group.songs.map((s) => s.id);
            const allSelected = groupIds.every((id) => selected.has(id));

            return (
              <div key={group.genre} className="rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGenre(group)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
                >
                  <span className="text-base font-medium text-foreground">{group.label}</span>
                  <span className="text-sm text-muted">
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </span>
                </button>
                <div className="divide-y divide-border">
                  {group.songs.map((song) => (
                    <label
                      key={song.id}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/10 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(song.id)}
                        onChange={() => toggleSong(song.id)}
                        className="accent-primary"
                      />
                      <span className="text-base text-foreground">{song.title}</span>
                      {song.artist && (
                        <span className="text-sm text-muted">{song.artist}</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate('/onboarding/profile')}
          className="rounded-lg border border-border text-foreground text-base font-medium px-6 py-2.5 transition-colors hover:bg-muted/30"
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={isPending}
          className="rounded-lg bg-primary text-primary-foreground text-base font-medium px-6 py-2.5 transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {isPending ? 'Saving…' : 'Next'}
        </button>
        <button
          type="button"
          onClick={() => navigate('/onboarding/packages')}
          className="rounded-lg text-foreground text-base font-medium px-6 py-2.5 transition-colors hover:bg-muted/30"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
