import { useState } from 'react';
import { CheckCircle2, Download, Music2, Plus } from 'lucide-react';
import { Card } from '@/components/common/Card';
import { SubLabel } from '@/components/common/SubLabel';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { GENRE_LABELS } from '@/lib/constants';
import FormatIcon from './FormatIcon';
import type { BookingDetail, Document, MusicFormConfig, MusicFormResponse, MusicFormResponseSong } from '@/types/api';

export interface MusicFormSectionProps {
  booking: BookingDetail;
  documents: Document[];
  config: MusicFormConfig | null;
  isLoading: boolean;
  response: MusicFormResponse | null;
  onUpdateConfig: () => void;
  onSendInvite: () => void;
  onViewResponse: () => void;
  onEdit: () => void;
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

function SongRequestsSheetBody({ response, songListDoc }: SongRequestsSheetBodyProps) {
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
            {response.specialRequests.map((req, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="text-sm text-muted w-36 flex-shrink-0">{req.key}</span>
                <span className="text-sm text-foreground">
                  {req.song
                    ? `${req.song.title}${req.song.artist ? ` — ${req.song.artist}` : ''}`
                    : req.freeText ?? <span className="text-muted italic">No selection</span>}
                </span>
              </div>
            ))}
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
  response,
  onUpdateConfig,
  onViewResponse,
  onEdit,
}: MusicFormSectionProps) {
  const [viewingResponse, setViewingResponse] = useState(false);
  const songListDoc = documents.find((d) => d.type === 'SONG_LIST');

  if (!booking.hasMusicFormConfig) {
    return (
      <Card title="Music form">
        <button
          type="button"
          onClick={onUpdateConfig}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          Configure song request form
        </button>
      </Card>
    );
  }

  if (isLoading || !config) {
    return (
      <Card title="Music form">
        <div className="h-16 bg-border rounded animate-pulse" />
      </Card>
    );
  }

  const sectionIconMap = new Map<string, string>(
    (booking.packages ?? []).map((bpf) => [bpf.package.label, bpf.package.icon]),
  );

  const sectionMap = new Map<string, { label: string; section: string }[]>();
  for (const km of config.keyMoments) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

  return (
    <>
      <Card
        title="Music form"
        action={
          <button type="button" onClick={onEdit} className="text-xs text-primary hover:text-primary/80 transition-colors">
            Edit
          </button>
        }
      >
        <div className="space-y-4">
          {booking.hasMusicFormResponse && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { onViewResponse(); setViewingResponse(true); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-status-confirmed bg-status-confirmed/10 rounded-full px-2.5 py-0.5 hover:bg-status-confirmed/20 transition-colors"
              >
                <CheckCircle2 size={11} />
                Response received · View
              </button>
              {songListDoc && (
                <a
                  href={songListDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  aria-label="Download song list PDF"
                >
                  <Download size={12} />
                  Song list
                </a>
              )}
            </div>
          )}
          {Array.from(sectionMap.entries()).map(([section, moments]) => (
            <div key={section}>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
                <FormatIcon icon={sectionIconMap.get(section) ?? 'music'} />
                {section}
              </div>
              <div className="space-y-0.5">
                {moments.map((km, i) => (
                  <p key={i} className="text-sm text-foreground">{km.label}</p>
                ))}
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
