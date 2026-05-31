import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import type { UseFormRegister, Control, FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Music2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSongs } from '@/lib/hooks/useSongs';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import { GENRE_LABELS, ALL_GENRES } from '@/lib/constants';
import type { Song } from '@/types/api';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/common/EmptyState';

// ─── Schema ───────────────────────────────────────────────────────────────────

const songSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  artist: z.string(),
  genre: z.enum(
    ['CONTEMPORARY', 'CLASSICAL', 'JAZZ', 'FILM_TV_MUSICALS', 'BOLLYWOOD', 'CHRISTMAS'] as const,
  ),
});

type SongFormValues = z.infer<typeof songSchema>;

// ─── Toggle switch ────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  'aria-label': ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        checked ? 'bg-primary' : 'bg-border',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

// ─── Shared form fields ───────────────────────────────────────────────────────

function SongFields({
  register,
  control,
  errors,
  autoFocus = false,
}: {
  register: UseFormRegister<SongFormValues>;
  control: Control<SongFormValues>;
  errors: FieldErrors<SongFormValues>;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Title</Label>
          <Input autoFocus={autoFocus} {...register('title')} placeholder="Song title" />
          {errors.title && (
            <p className="text-sm text-status-cancelled">{errors.title.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Artist (optional)</Label>
          <Input {...register('artist')} placeholder="Artist name" />
        </div>
      </div>
      <div className="space-y-1 sm:w-1/2">
        <Label>Genre</Label>
        <Controller
          name="genre"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENRE_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
    </div>
  );
}

// ─── Add song row ─────────────────────────────────────────────────────────────

function AddSongRow({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SongFormValues>({
    resolver: zodResolver(songSchema),
    defaultValues: { title: '', artist: '', genre: 'CONTEMPORARY' },
  });

  const mutation = useMutation({
    mutationFn: (values: SongFormValues) =>
      apiPost<Song>('/songs', {
        title: values.title,
        artist: values.artist || undefined,
        genre: values.genre,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      reset({ title: '', artist: '', genre: 'CONTEMPORARY' });
    },
  });

  return (
    <div className="border-b border-border py-4 bg-surface rounded-md px-3 mb-1">
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
      >
        <SongFields
          register={register}
          control={control}
          errors={errors}
          autoFocus
        />
        {mutation.isError && (
          <p className="text-sm text-status-cancelled">Failed to add. Please try again.</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={mutation.isPending}>
            {mutation.isPending ? 'Adding…' : 'Add song'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Done
          </Button>
        </div>
      </form>
    </div>
  );
}

// ─── Edit song form (rendered inside an expanded row) ─────────────────────────

function EditSongForm({ song, onClose }: { song: Song; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SongFormValues>({
    resolver: zodResolver(songSchema),
    defaultValues: {
      title: song.title,
      artist: song.artist ?? '',
      genre: song.genre,
    },
  });

  const saveMutation = useMutation({
    mutationFn: (values: SongFormValues) =>
      apiPatch<Song>(`/songs/${song.id}`, {
        title: values.title,
        artist: values.artist || null,
        genre: values.genre,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/songs/${song.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs'] });
    },
  });

  return (
    <div className="pb-4 pt-1" onClick={(e) => e.stopPropagation()}>
      <form
        onSubmit={handleSubmit((values) => saveMutation.mutate(values))}
        className="space-y-4"
      >
        <SongFields register={register} control={control} errors={errors} autoFocus />
        {saveMutation.isError && (
          <p className="text-sm text-status-cancelled">Failed to save. Please try again.</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>

      <div className="mt-4 pt-4 border-t border-border">
        {deleteConfirm ? (
          <Button
            size="sm"
            variant="outline"
            className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
            onClick={() => setDeleteConfirm(true)}
          >
            Delete song
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Song row ─────────────────────────────────────────────────────────────────

function SongRow({
  song,
  isExpanded,
  onToggle,
}: {
  song: Song;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: (active: boolean) => apiPatch<Song>(`/songs/${song.id}`, { active }),
    onMutate: async (active) => {
      await queryClient.cancelQueries({ queryKey: ['songs'] });
      const previous = queryClient.getQueryData<Song[]>(['songs']);
      queryClient.setQueryData<Song[]>(['songs'], (old = []) =>
        old.map((s) => (s.id === song.id ? { ...s, active } : s)),
      );
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) queryClient.setQueryData(['songs'], context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['songs'] }),
  });

  const secondaryLine = [song.artist, GENRE_LABELS[song.genre]].filter(Boolean).join(' · ');

  return (
    <div className={cn('border-b border-border', !song.active && 'opacity-60')}>
      <div className="flex items-center gap-3 py-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={onToggle}
          className="flex-1 min-w-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded"
        >
          <p className="text-sm font-medium text-foreground truncate">{song.title}</p>
          {secondaryLine && (
            <p className="text-xs text-muted mt-0.5 truncate">{secondaryLine}</p>
          )}
        </button>
        <ToggleSwitch
          checked={song.active}
          onChange={(active) => toggleMutation.mutate(active)}
          disabled={toggleMutation.isPending}
          aria-label={`${song.active ? 'Deactivate' : 'Activate'} ${song.title}`}
        />
      </div>

      {isExpanded && <EditSongForm song={song} onClose={onToggle} />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RepertoirePage() {
  const { data: songs = [], isLoading } = useSongs();
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('ALL');
  const [showInactive, setShowInactive] = useState(true);
  const [addingNew, setAddingNew] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = songs
    .filter((s) => showInactive || s.active)
    .filter((s) => genreFilter === 'ALL' || s.genre === genreFilter)
    .filter((s) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.artist?.toLowerCase().includes(q) ?? false)
      );
    });

  return (
    <div className="px-4 md:px-6 py-6 max-w-3xl mx-auto">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-6">Repertoire</h1>

      {/* Toolbar */}
      <div className="space-y-3 mb-4">
        <Input
          placeholder="Search by title or artist…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Select value={genreFilter} onValueChange={setGenreFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All genres" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All genres</SelectItem>
                {ALL_GENRES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GENRE_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            onClick={() => setShowInactive((v) => !v)}
            className="text-sm text-muted hover:text-foreground transition-colors whitespace-nowrap"
          >
            {showInactive ? 'Hide inactive' : 'Show inactive'}
          </button>
        </div>
      </div>

      {/* Add song */}
      {addingNew ? (
        <AddSongRow onDone={() => setAddingNew(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors mb-4"
        >
          <Plus size={14} />
          Add song
        </button>
      )}

      {/* List */}
      {isLoading && (
        <div className="animate-pulse border-t border-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="py-3 border-b border-border flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-40 bg-border rounded" />
                <div className="h-3 w-24 bg-border rounded" />
              </div>
              <div className="h-5 w-9 bg-border rounded-full" />
            </div>
          ))}
        </div>
      )}
      {!isLoading && songs.length === 0 && !addingNew && (
        <EmptyState
          icon={<Music2 size={40} strokeWidth={1.5} />}
          heading="No songs yet"
          description="Add your first song to start building your repertoire."
          action={<Button size="sm" onClick={() => setAddingNew(true)}>Add your first song</Button>}
        />
      )}
      {!isLoading && (songs.length > 0 || addingNew) && filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted">No songs match your search.</p>
        </div>
      )}
      {!isLoading && (songs.length > 0 || addingNew) && filtered.length > 0 && (
        <div className="border-t border-border">
          {filtered.map((song) => (
            <SongRow
              key={song.id}
              song={song}
              isExpanded={expandedId === song.id}
              onToggle={() =>
                setExpandedId((prev) => (prev === song.id ? null : song.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
