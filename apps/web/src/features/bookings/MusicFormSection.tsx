import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Download, Music2, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { SubLabel } from '@/components/common/SubLabel';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { GENRE_LABELS } from '@/lib/constants';
import { apiGet } from '@/lib/api';
import FormatIcon from './FormatIcon';
import type { BookingDetail, Document, MusicFormConfig, MusicFormResponse, MusicFormResponseSong } from '@/types/api';

export interface MusicFormSectionProps {
  booking: BookingDetail;
  documents: Document[];
  config: MusicFormConfig | null;
  isLoading: boolean;
  onUpdateConfig: () => void;
  onEdit: () => void;
  hideWhenEmpty?: boolean;
}

function groupByGenre(songs: MusicFormResponseSong[]): Map<string, MusicFormResponseSong[]> {
  const map = new Map<string, MusicFormResponseSong[]>();
  for (const song of songs) {
    if (!map.has(song.genre)) map.set(song.genre, []);
    map.get(song.genre)!.push(song);
  }
  return map;
}

interface SongRequestsSheetBodyProps {
  response: MusicFormResponse | null;
  songListDoc: Document | undefined;
}

function SongRequestsSheetBody({ response, songListDoc }: Readonly<SongRequestsSheetBodyProps>) {
  if (!response) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-border rounded w-3/4" />)}
      </div>
    );
  }

  const hasSpecialRequests = response.specialRequests.some((r) => r.song || r.freeText);
  const isEmpty = !hasSpecialRequests && response.selectedSongs.length === 0 && !response.notes;
  const genreMap = groupByGenre(response.selectedSongs);

  return (
    <div className="space-y-6">
      {hasSpecialRequests && (
        <section>
          <SubLabel className="mb-3">Key moments</SubLabel>
          <div className="space-y-2">
            {response.specialRequests.map((req) => {
              const artistSuffix = req.song?.artist ? ` — ${req.song.artist}` : '';
              const songText = req.song ? `${req.song.title}${artistSuffix}` : null;
              return (
                <div key={req.key} className="flex items-start gap-3">
                  <span className="text-sm text-muted w-36 flex-shrink-0">{req.key}</span>
                  <span className="text-sm text-foreground">
                    {songText ?? req.freeText ?? <span className="text-muted italic">No selection</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {response.selectedSongs.length > 0 && (
        <section>
          <SubLabel className="mb-3">General requests</SubLabel>
          <div className="space-y-4">
            {Array.from(genreMap.entries()).map(([genre, songs]) => (
              <div key={genre}>
                <p className="text-xs text-muted mb-1.5">{GENRE_LABELS[genre as keyof typeof GENRE_LABELS] ?? genre}</p>
                <div className="space-y-1">
                  {songs.map((song) => (
                    <div key={song.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-foreground">{song.title}</span>
                      {song.artist && <span className="text-sm text-muted flex-shrink-0">{song.artist}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {response.notes && (
        <section>
          <SubLabel className="mb-2">Notes</SubLabel>
          <p className="text-sm text-foreground whitespace-pre-wrap">{response.notes}</p>
        </section>
      )}
      {isEmpty && <p className="text-sm text-muted">No selections made.</p>}
      {songListDoc && (
        <a
          href={songListDoc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
        >
          <Download size={14} />
          Download PDF
        </a>
      )}
    </div>
  );
}

export default function MusicFormSection({
  booking,
  documents,
  config,
  isLoading,
  onUpdateConfig,
  onEdit,
  hideWhenEmpty = false,
}: Readonly<MusicFormSectionProps>) {
  const [viewingResponse, setViewingResponse] = useState(false);

  const { data: response = null } = useQuery({
    queryKey: ['booking-music-form-response', booking.id],
    queryFn: () => apiGet<MusicFormResponse>(`/bookings/${booking.id}/music-form-response`),
    enabled: booking.hasMusicFormResponse,
  });
  const songListDoc = documents.find((d) => d.type === 'SONG_LIST');

  if (!booking.hasMusicFormConfig && hideWhenEmpty) return null;

  if (!booking.hasMusicFormConfig) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-4 text-muted min-h-[5rem]">
        <ClipboardList size={20} />
        <span className="text-sm font-medium">Music form</span>
        <button
          type="button"
          onClick={onUpdateConfig}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          Configure song request form
        </button>
      </div>
    );
  }

  if (isLoading || !config) {
    return (
      <div className="flex flex-col items-center text-center gap-2 py-4 text-muted min-h-[5rem]">
        <ClipboardList size={20} />
        <span className="text-sm font-medium">Music form</span>
        <div className="h-2 w-24 bg-border rounded animate-pulse" />
      </div>
    );
  }

  const sectionIconMap = new Map<string, string>(
    (booking.packages ?? []).map((bpf) => [bpf.label, bpf.icon]),
  );

  const sectionMap = new Map<string, { label: string; section: string }[]>();
  for (const km of config.keyMoments) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

  const responseByKey = new Map(
    (response?.specialRequests ?? []).map((req) => [req.key, req]),
  );

  return (
    <>
      <Card
        title="Music form"
        action={
          booking.hasMusicFormResponse ? (
            <button type="button" onClick={() => setViewingResponse(true)} className="text-xs text-primary hover:text-primary/80 transition-colors">
              Preview
            </button>
          ) : (
            <button type="button" onClick={onEdit} className="text-xs text-primary hover:text-primary/80 transition-colors">
              Edit
            </button>
          )
        }
      >
        <div className="space-y-4">
          {Array.from(sectionMap.entries()).map(([section, moments]) => (
            <div key={section}>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
                <FormatIcon icon={sectionIconMap.get(section) ?? 'music'} />
                {section}
              </div>
              <div className="space-y-0.5">
                {moments.map((km) => {
                  const req = responseByKey.get(km.label);
                  if (req) {
                    const artistSuffix = req.song?.artist ? ` — ${req.song.artist}` : '';
                    const choice = req.song
                      ? `${req.song.title}${artistSuffix}`
                      : req.freeText ?? null;
                    return (
                      <p key={km.label} className="text-sm text-foreground">
                        {km.label}{' — '}
                        {choice ?? <span className="text-muted italic">No selection</span>}
                      </p>
                    );
                  }
                  return <p key={km.label} className="text-sm text-foreground">{km.label}</p>;
                })}
              </div>
            </div>
          ))}
          {config.enabledGenres.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
                <Music2 size={14} />
                Genres
              </div>
              <p className="text-sm text-foreground">
                {config.enabledGenres.map((g) => GENRE_LABELS[g as keyof typeof GENRE_LABELS] ?? g).join(', ')}
              </p>
            </div>
          )}
        </div>
      </Card>

      <Sheet open={viewingResponse} onOpenChange={setViewingResponse}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle>Song requests</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <SongRequestsSheetBody response={response} songListDoc={songListDoc} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
