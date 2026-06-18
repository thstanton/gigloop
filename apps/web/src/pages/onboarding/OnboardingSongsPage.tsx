import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { apiGet, apiPost } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { toast } from '@/lib/hooks/use-toast';
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
    onError: () => {
      toast({ title: 'Failed to add songs. Please try again.', variant: 'destructive' });
    },
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
      <PageHeader
        title="Add songs to your repertoire"
        subheading="Select songs to add to your library. You can add more later in Settings."
        className="mb-0"
      />

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
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => toggleGenre(group)}
                  className="w-full flex items-center justify-between px-4 py-3 h-auto rounded-none bg-muted/20 hover:bg-muted/40"
                >
                  <span className="font-medium">{group.label}</span>
                  <span className="text-muted text-sm font-normal">
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </span>
                </Button>
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
        <Button variant="outline" onClick={() => navigate('/onboarding/profile')}>
          Back
        </Button>
        <Button onClick={handleNext} disabled={isPending}>
          {isPending ? 'Saving…' : 'Next'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/onboarding/packages')}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
