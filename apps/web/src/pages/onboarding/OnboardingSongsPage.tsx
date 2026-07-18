import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  FileSignature,
  FileText,
  Heart,
  Music,
  Receipt,
  X,
  type LucideIcon,
} from 'lucide-react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { useMe } from '@/lib/hooks/useMe';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { IconButton } from '@/components/common/IconButton';
import { AddSongField, type NewSong } from '@/features/repertoire/AddSongField';
import { stepNav } from '@/features/onboarding/steps';
import { GENRE_LABELS } from '@/lib/constants';
import type { CatalogueGroup, PublicProfile, Song, SongGenre, UserProfile } from '@/types/api';

const PATH = '/onboarding/songs';

// Sample business name shown until the musician's own (entered in step 1) loads.
const SAMPLE_BUSINESS_NAME = 'Jane Smith Music';

// Orientation copy: the email templates GigLoop ships with. These are templates the
// musician sends deliberately (customisable in Templates and per-send) — never
// sent automatically. The quote subject carries the musician's business name so it
// doesn't read as a stray sample two steps after they entered it (#695).
function buildEmails(businessName: string): { key: string; icon: LucideIcon; subject: string; purpose: string }[] {
  return [
    {
      key: 'quote',
      icon: FileText,
      subject: `Your quote from ${businessName}`,
      purpose: 'For replying to a new enquiry with your quote',
    },
    {
      key: 'contract',
      icon: FileSignature,
      subject: 'Your contract is ready to sign',
      purpose: 'Goes with the contract, carrying its secure signing link',
    },
    {
      key: 'invoice',
      icon: Receipt,
      subject: 'Deposit invoice — The Anderson Wedding',
      purpose: 'For the deposit and balance invoices',
    },
    {
      key: 'thank-you',
      icon: Heart,
      subject: 'Thank you for having us!',
      purpose: 'For after the event — a good final impression',
    },
  ];
}

function AddedSongsList({
  songs,
  onRemove,
  removingId,
}: {
  songs: Song[];
  onRemove: (id: string) => void;
  removingId: string | null;
}) {
  if (songs.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/20 px-4 py-6 flex flex-col items-center gap-1.5 text-center">
        <Music size={18} className="text-muted" />
        <p className="text-base text-foreground">Add a song to begin</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-border divide-y divide-border">
      {songs.map((song) => (
        <div key={song.id} className="flex items-center gap-3 pl-4 pr-1 py-1">
          <Check size={16} className="text-primary flex-shrink-0" />
          <span className="min-w-0 flex-1 truncate text-base text-foreground py-1.5">
            {song.title}
            {song.artist && <span className="text-sm text-muted"> — {song.artist}</span>}
          </span>
          <span className="flex-shrink-0 text-xs text-muted">
            {GENRE_LABELS[song.genre as SongGenre] ?? song.genre}
          </span>
          <IconButton
            label={`Remove ${song.title}`}
            onClick={() => onRemove(song.id)}
            disabled={removingId !== null}
          >
            <X size={16} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}

function RequestsOffNote({ onTurnOn }: { onTurnOn: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-1">
      <p className="text-base text-foreground">Song requests are off.</p>
      <p className="text-sm text-muted">
        Clients won't see a song-request form on their portal. You can{' '}
        <button type="button" className="underline text-foreground" onClick={onTurnOn}>
          turn it back on
        </button>{' '}
        any time, here or in Settings.
      </p>
    </div>
  );
}

export default function OnboardingSongsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isLoaded, isSignedIn } = useAuth();
  const { prev } = stepNav(PATH);
  const { data: profile } = useMe();

  // Same query key as the rest of the app (AppShell, Settings, PortalPreviewPage) so the
  // business name entered in step 1 is already fresh by the time this step mounts.
  const { data: publicProfile } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded && !!isSignedIn,
  });
  const emails = buildEmails(publicProfile?.businessName?.trim() || SAMPLE_BUSINESS_NAME);

  // Songs created on this step (adds persist immediately; this is the session's list)
  const [added, setAdded] = useState<Song[]>([]);

  const { data: catalogue = [] } = useQuery({
    queryKey: ['songs-catalogue'],
    queryFn: () => apiGet<CatalogueGroup[]>('/songs/catalogue'),
    enabled: isLoaded && !!isSignedIn,
  });
  const catalogueEntries = catalogue.flatMap((g) => g.songs);

  const addMutation = useMutation({
    mutationFn: (song: NewSong) =>
      apiPost<Song>('/songs', {
        title: song.title,
        artist: song.artist || undefined,
        genre: song.genre,
      }),
    onSuccess: (song) => {
      setAdded((prev) => [...prev, song]);
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    },
    onError: () => toast({ title: 'Failed to add song. Please try again.', variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/songs/${id}`),
    onSuccess: (_data, id) => {
      setAdded((prev) => prev.filter((s) => s.id !== id));
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    },
    onError: () => toast({ title: 'Failed to remove song. Please try again.', variant: 'destructive' }),
  });

  // Low-stakes toggle (Tier 3): optimistic flip with rollback on error
  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiPatch<UserProfile>('/me', { songRequestFormEnabled: enabled }),
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey: ['me'] });
      const previous = queryClient.getQueryData<UserProfile>(['me']);
      queryClient.setQueryData<UserProfile>(['me'], (old) =>
        old ? { ...old, songRequestFormEnabled: enabled } : old,
      );
      return { previous };
    },
    onError: (_err, _enabled, context) => {
      if (context?.previous) queryClient.setQueryData(['me'], context.previous);
      toast({ title: 'Failed to update song requests. Please try again.', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  // Songs is the final onboarding step, so it owns completion (Finish and Skip both
  // complete — songs already persisted as they were added).
  const finishMutation = useMutation({
    mutationFn: () => apiPost('/me/onboarding/complete', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
      navigate('/admin', { replace: true });
    },
    onError: () => {
      toast({ title: 'Failed to finish setup. Please try again.', variant: 'destructive' });
    },
  });

  if (!profile) return null;

  const requestsOn = profile.songRequestFormEnabled;

  return (
    <div>
      <PageHeader
        title="Communicating with your clients"
        subheading="Ready-made emails for every stage of a booking — and a song-request form for your clients."
      />

      <div className="flex flex-col gap-6">
        <div className="space-y-3">
          <div>
            <p className="text-base font-medium text-foreground">Emails, ready when you are</p>
            <p className="text-sm text-muted">
              GigLoop includes templates for the emails a booking needs. Customise them in
              Templates, tweak any message before it goes — nothing is ever sent without your
              say-so.
            </p>
          </div>
          <div className="rounded-lg border border-border divide-y divide-border">
            {emails.map((e) => (
              <div key={e.key} className="flex items-start gap-3 px-4 py-3">
                <e.icon size={18} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-base text-foreground">{e.subject}</p>
                  <p className="text-sm text-muted">{e.purpose}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-base font-medium text-foreground">Song requests</p>
            <p className="text-sm text-muted">
              The music form on the client portal makes it easy to collect song requests from the
              client. Start building your repertoire so they can see what you can perform.
            </p>
          </div>
          {requestsOn ? (
            <>
              <AddSongField
                catalogue={catalogueEntries}
                onAdd={(song) => addMutation.mutate(song)}
                adding={addMutation.isPending}
              />
              <div className="pt-1">
                <p className="text-base font-medium text-foreground">Repertoire</p>
                <p className="text-sm text-muted">
                  Your clients choose from these songs. You can add more any time in Repertoire.
                </p>
              </div>
              <AddedSongsList
                songs={added}
                onRemove={(id) => removeMutation.mutate(id)}
                removingId={removeMutation.isPending ? (removeMutation.variables ?? null) : null}
              />
              <button
                type="button"
                className="text-sm text-muted underline disabled:opacity-50"
                onClick={() => toggleMutation.mutate(false)}
                disabled={toggleMutation.isPending}
              >
                Not for you? Turn off song requests
              </button>
            </>
          ) : (
            <RequestsOffNote onTurnOn={() => toggleMutation.mutate(true)} />
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
          {prev && (
            <Button
              variant="outline"
              onClick={() => navigate(prev)}
              disabled={finishMutation.isPending}
            >
              Back
            </Button>
          )}
          <Button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
            {finishMutation.isPending ? 'Finishing…' : 'Finish'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => finishMutation.mutate()}
            disabled={finishMutation.isPending}
          >
            Skip for now — customise in Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
