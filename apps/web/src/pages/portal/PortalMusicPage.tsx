import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Check, Music } from 'lucide-react';
import { getMusicFormData, getPortalData, submitMusicForm } from '../../lib/portalApi';
import { PortalLayout } from '../../layouts/PortalLayout';
import type { PortalSong, PortalSpecialRequest } from '../../types/api';

// ─── Song picker for key moments ──────────────────────────────────────────────

function SongAutocomplete({
  allSongs,
  value,
  onChange,
  isBold,
}: {
  allSongs: PortalSong[];
  value: PortalSpecialRequest;
  onChange: (val: PortalSpecialRequest) => void;
  isBold: boolean;
}) {
  const [query, setQuery] = useState(() => {
    if (value.songId) {
      const song = allSongs.find((s) => s.id === value.songId);
      return song ? `${song.title}${song.artist ? ` — ${song.artist}` : ''}` : '';
    }
    return value.freeText ?? '';
  });
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSongs.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.artist ?? '').toLowerCase().includes(q),
    ).slice(0, 8);
  }, [query, allSongs]);

  function select(song: PortalSong) {
    const label = `${song.title}${song.artist ? ` — ${song.artist}` : ''}`;
    setQuery(label);
    setOpen(false);
    onChange({ key: value.key, songId: song.id, freeText: undefined });
  }

  function handleBlur() {
    setTimeout(() => setOpen(false), 150);
    if (!value.songId) {
      onChange({ key: value.key, songId: undefined, freeText: query || undefined });
    }
  }

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm ${
    isBold
      ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/60'
      : 'bg-white border-[#e5e5e5] text-[#1a1a1a] placeholder-[#9ca3af] focus:border-[#1a1a1a]'
  } outline-none`;

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onChange({ key: value.key, songId: undefined, freeText: e.target.value || undefined });
        }}
        onFocus={() => { if (query) setOpen(true); }}
        onBlur={handleBlur}
        placeholder="Search songs or type a request…"
        className={inputClass}
      />
      {open && filtered.length > 0 && (
        <div
          className={`absolute z-10 mt-1 w-full rounded-lg border shadow-lg overflow-hidden ${
            isBold ? 'bg-[#2a2a2a] border-white/20' : 'bg-white border-[#e5e5e5]'
          }`}
        >
          {filtered.map((song) => (
            <button
              key={song.id}
              type="button"
              onMouseDown={() => select(song)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                isBold
                  ? 'hover:bg-white/10 text-white'
                  : 'hover:bg-[#f9fafb] text-[#1a1a1a]'
              }`}
            >
              <span className="min-w-0 truncate">
                {song.title}
                {song.artist && (
                  <span className={isBold ? 'text-white/50' : 'text-[#9ca3af]'}> — {song.artist}</span>
                )}
              </span>
              <span className={`text-xs flex-shrink-0 ${isBold ? 'text-white/40' : 'text-[#9ca3af]'}`}>
                {song.genre}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalMusicPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const { data: portalData } = useQuery({
    queryKey: ['portal', token],
    queryFn: () => getPortalData(token!),
    retry: false,
  });

  const { data, isLoading, isError } = useQuery({
    queryKey: ['portal-music', token],
    queryFn: () => getMusicFormData(token!),
    retry: false,
  });

  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set();
  });
  const [specialRequests, setSpecialRequests] = useState<PortalSpecialRequest[]>([]);
  const [notes, setNotes] = useState('');
  const [initialised, setInitialised] = useState(false);

  // Initialise from existing response once data loads
  if (data && !initialised) {
    if (data.existingResponse) {
      setSelected(new Set(data.existingResponse.selectedSongIds));
      setSpecialRequests(
        data.config.keyMoments.map((km) => {
          const existing = data.existingResponse!.specialRequests.find(
            (r: PortalSpecialRequest) => r.key === km.label,
          );
          return existing ?? { key: km.label };
        }),
      );
      setNotes(data.existingResponse.notes ?? '');
    } else {
      setSpecialRequests(data.config.keyMoments.map((km) => ({ key: km.label })));
    }
    setInitialised(true);
  }

  const submit = useMutation({
    mutationFn: () =>
      submitMusicForm(token!, {
        selectedSongIds: Array.from(selected),
        specialRequests,
        notes: notes || undefined,
      }),
    onSuccess: () => navigate(`/booking/${token}?music=1`),
  });

  const profile = portalData?.publicProfile;
  const bold = profile?.portalTheme === 'BOLD_MODERN' || profile?.portalTheme === 'BOLD_ROMANTIC';

  if (isLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-pulse text-[#9ca3af] text-sm">Loading…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-6">
        <div className="text-center max-w-sm">
          <Music className="mx-auto mb-4 h-10 w-10 text-[#9ca3af]" />
          <h1 className="text-lg font-semibold text-[#1a1a1a] mb-2">Song request form unavailable</h1>
          <p className="text-sm text-[#6b7280]">Please contact the musician directly.</p>
        </div>
      </div>
    );
  }

  const { config, songs, allSongs } = data;
  const genres = config.enabledGenres;

  const currentGenre = activeGenre ?? (genres[0] ?? null);

  const displaySongs = search.trim()
    ? songs.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) ||
          (s.artist ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : songs.filter((s) => s.genre === currentGenre);

  function toggleSong(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateSpecialRequest(idx: number, val: PortalSpecialRequest) {
    setSpecialRequests((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  }

  const sectionMap = new Map<string, Array<{ km: { label: string; section: string }; idx: number }>>();
  config.keyMoments.forEach((km, idx) => {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push({ km, idx });
  });

  const labelClass = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
      active
        ? bold
          ? 'bg-white text-[#1a1a1a]'
          : 'bg-[#1a1a1a] text-white'
        : bold
        ? 'bg-white/10 text-white/70 hover:bg-white/20'
        : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
    }`;

  const sectionHeadingClass = `text-xs font-medium uppercase tracking-wide mb-3 ${bold ? 'text-white/50' : 'text-[#9ca3af]'}`;
  const inputClass = `w-full rounded-lg border px-3 py-2.5 text-sm ${
    bold
      ? 'bg-white/10 border-white/20 text-white placeholder-white/40 focus:border-white/60'
      : 'bg-white border-[#e5e5e5] text-[#1a1a1a] placeholder-[#9ca3af] focus:border-[#1a1a1a]'
  } outline-none`;

  return (
    <PortalLayout profile={profile}>
      <div className="space-y-8">
        <div>
          <h1 className={`text-2xl font-semibold mb-1 ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            Song requests
          </h1>
          <p className={`text-sm ${bold ? 'text-white/60' : 'text-[#6b7280]'}`}>
            Choose songs you'd like to hear and pick something special for key moments.
          </p>
        </div>

        {/* 1. General song list */}
        <section className="space-y-4">
          <h2 className={`text-base font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            General requests
          </h2>

          {/* Search */}
          <div className="relative">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${bold ? 'text-white/40' : 'text-[#9ca3af]'}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all songs…"
              className={`${inputClass} pl-9`}
            />
          </div>

          {/* Genre tabs */}
          {!search.trim() && genres.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGenre(g)}
                  className={labelClass(g === currentGenre)}
                >
                  {g.charAt(0) + g.slice(1).toLowerCase().replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Song list */}
          <div className={`rounded-lg divide-y overflow-hidden ${bold ? 'divide-white/10 bg-white/5' : 'divide-[#e5e5e5] border border-[#e5e5e5]'}`}>
            {displaySongs.length === 0 ? (
              <p className={`px-4 py-6 text-sm text-center ${bold ? 'text-white/40' : 'text-[#9ca3af]'}`}>
                No songs found.
              </p>
            ) : (
              displaySongs.map((song) => {
                const isSelected = selected.has(song.id);
                return (
                  <button
                    key={song.id}
                    type="button"
                    onClick={() => toggleSong(song.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      bold ? 'hover:bg-white/10' : 'hover:bg-[#f9fafb]'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                        isSelected
                          ? bold
                            ? 'bg-white border-white'
                            : 'bg-[#1a1a1a] border-[#1a1a1a]'
                          : bold
                          ? 'border-white/30 bg-transparent'
                          : 'border-[#d1d5db] bg-transparent'
                      }`}
                    >
                      {isSelected && (
                        <Check className={`h-3 w-3 ${bold ? 'text-[#1a1a1a]' : 'text-white'}`} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`text-sm ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
                        {song.title}
                      </span>
                      {song.artist && (
                        <span className={`text-sm ${bold ? 'text-white/50' : 'text-[#9ca3af]'}`}>
                          {' '}— {song.artist}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {selected.size > 0 && (
            <p className={`text-sm ${bold ? 'text-white/60' : 'text-[#6b7280]'}`}>
              {selected.size} song{selected.size !== 1 ? 's' : ''} selected
            </p>
          )}
        </section>

        {/* 2. Key moments */}
        {config.keyMoments.length > 0 && (
          <section className="space-y-4">
            <h2 className={`text-base font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
              Key moments
            </h2>
            <div className="space-y-5">
              {Array.from(sectionMap.entries()).map(([section, items]) => (
                <div key={section}>
                  <p className={sectionHeadingClass}>{section}</p>
                  <div className="space-y-3">
                    {items.map(({ km, idx }) => (
                      <div key={km.label}>
                        <label className={`block text-sm mb-1.5 ${bold ? 'text-white/80' : 'text-[#374151]'}`}>
                          {km.label}
                        </label>
                        <SongAutocomplete
                          allSongs={allSongs}
                          value={specialRequests[idx] ?? { key: km.label }}
                          onChange={(val) => updateSpecialRequest(idx, val)}
                          isBold={bold}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 3. Notes */}
        <section className="space-y-2">
          <h2 className={`text-base font-semibold ${bold ? 'text-white' : 'text-[#1a1a1a]'}`}>
            Notes
          </h2>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any other requests or special instructions…"
            rows={3}
            className={inputClass}
          />
        </section>

        {/* Submit */}
        {submit.isError && (
          <p className={`text-sm ${bold ? 'text-red-400' : 'text-red-600'}`}>
            Something went wrong. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={submit.isPending}
          className="w-full rounded-lg px-5 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: profile.brandColour ?? '#1a1a1a' }}
        >
          {submit.isPending ? 'Submitting…' : data.existingResponse ? 'Update requests' : 'Submit requests'}
        </button>
      </div>
    </PortalLayout>
  );
}
