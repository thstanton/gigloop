import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Mail, Music, FileText, DollarSign, FolderOpen, ChevronDown, Check, Pencil, Plus, Send, Download, Heart, GlassWater, Utensils, Moon, Briefcase, Music2, Trash2, ClipboardList } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import InvoiceStatusPill from '@/components/InvoiceStatusPill';
import { useBooking } from '@/lib/hooks/useBooking';
import { useBookingActions } from '@/lib/hooks/useBookingActions';
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import { buildChecklist } from '@/lib/buildChecklist';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { ALL_GENRES, EVENT_TYPE_LABELS, GENRE_LABELS, STATUS_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  BookingDetail,
  BookingPerformanceFormatSummary,
  BookingStatus,
  Contact,
  Document,
  KeyMoment,
  MusicFormConfig,
  MusicFormResponse,
  PerformanceFormat,
  PerformanceSet,
  Invoice,
  Communication,
  UserProfile,
} from '@/types/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`;
}

function invoiceLineTotal(invoice: Invoice): number {
  return invoice.lineItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
}

// ─── Status dropdown ──────────────────────────────────────────────────────────

const STATUS_PILL_CLASSES: Record<BookingStatus, string> = {
  ENQUIRY:   'bg-status-enquiry/12 text-status-enquiry',
  CONFIRMED: 'bg-status-confirmed/12 text-status-confirmed',
  INVOICED:  'bg-status-invoiced/12 text-status-invoiced',
  SETTLED:   'bg-status-settled/12 text-status-settled',
  COMPLETED: 'bg-status-completed/12 text-status-completed',
  CANCELLED: 'bg-status-cancelled/12 text-status-cancelled',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:   'Enquiry',
  CONFIRMED: 'Confirmed',
  INVOICED:  'Invoiced',
  SETTLED:   'Settled',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

function StatusDropdown({ booking }: { booking: BookingDetail }) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (status: BookingStatus) =>
      apiPatch<BookingDetail>(`/bookings/${booking.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer',
            STATUS_PILL_CLASSES[booking.status],
          )}
        >
          {STATUS_LABELS[booking.status]}
          <ChevronDown size={10} className="opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {STATUS_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => { if (s !== booking.status) mutation.mutate(s); }}
            className="gap-2"
          >
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_PILL_CLASSES[s])}>
              {STATUS_LABELS[s]}
            </span>
            {s === booking.status && <Check size={12} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground mb-3">{label}</h2>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      {title && (
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">{title}</p>
      )}
      {children}
    </div>
  );
}

// ─── PersonCard ───────────────────────────────────────────────────────────────

function PersonCard({
  role,
  contact,
  commissionArrangement,
  linkState,
}: {
  role: string;
  contact: Contact;
  commissionArrangement?: string | null;
  linkState?: Record<string, string>;
}) {
  const contactLine = [contact.email, contact.phone].filter(Boolean).join(' · ');
  return (
    <Link
      to={`/admin/contacts/${contact.id}`}
      state={linkState}
      className="block py-4 border-b border-border last:border-0 group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1.5">{role}</p>
          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
            {contact.name}
          </p>
          {contactLine && <p className="text-sm text-muted mt-0.5">{contactLine}</p>}
          {commissionArrangement && (
            <p className="text-sm text-muted mt-0.5">
              <span className="text-foreground">Commission</span>
              {' · '}{commissionArrangement}
            </p>
          )}
        </div>
        <ChevronRight size={16} className="text-muted flex-shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
      </div>
    </Link>
  );
}

// ─── Running order ────────────────────────────────────────────────────────────

// ─── Performance section ──────────────────────────────────────────────────────

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

function SetRow({
  set,
  onUpdate,
}: {
  set: PerformanceSet;
  onUpdate: (setId: string, startTime: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted w-4 flex-shrink-0 text-right">{set.order}</span>
      <span className="flex-1 text-sm text-foreground">
        {[set.label, formatDuration(set.duration)].filter(Boolean).join(' · ')}
      </span>
      <input
        type="time"
        defaultValue={set.startTime ?? ''}
        onBlur={(e) => {
          const val = e.target.value || null;
          if (val !== set.startTime) onUpdate(set.id, val);
        }}
        className="text-sm text-muted border border-border rounded px-2 py-0.5 w-24 bg-background"
        aria-label={`Start time for ${set.label ?? 'set'}`}
      />
    </div>
  );
}

function PerformanceSection({ booking }: { booking: BookingDetail }) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);

  const { data: allFormats = [] } = useQuery({
    queryKey: ['performance-formats'],
    queryFn: () => apiGet<PerformanceFormat[]>('/performance-formats'),
    enabled: addOpen,
  });

  const appliedFormatIds = new Set(booking.performanceFormats.map((bpf) => bpf.performanceFormatId));
  const availableFormats = allFormats.filter((f) => !appliedFormatIds.has(f.id));

  const updateSet = useMutation({
    mutationFn: ({ setId, startTime }: { setId: string; startTime: string | null }) =>
      apiPatch(`/bookings/${booking.id}/sets/${setId}`, { startTime }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', booking.id] }),
  });

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

  function handleRemove(bpf: BookingPerformanceFormatSummary) {
    const sets = booking.sets.filter((s) => s.performanceFormatId === bpf.performanceFormatId);
    const hasStartTimes = sets.some((s) => s.startTime);
    if (hasStartTimes && !window.confirm(`Remove "${bpf.performanceFormat.label}" and its ${sets.length} set(s)?`)) return;
    removeFormat.mutate(bpf.id);
  }

  const setsByFormatId = new Map<string | null, PerformanceSet[]>();
  for (const set of booking.sets) {
    const key = set.performanceFormatId ?? null;
    if (!setsByFormatId.has(key)) setsByFormatId.set(key, []);
    setsByFormatId.get(key)!.push(set);
  }

  const unassigned = setsByFormatId.get(null) ?? [];

  return (
    <Card title="Performance">
      {booking.performanceFormats.length === 0 && unassigned.length === 0 && (
        <div className="flex items-center gap-2 text-muted py-1 mb-3">
          <Music size={14} />
          <span className="text-sm">No formats applied</span>
        </div>
      )}

      {booking.performanceFormats.map((bpf) => {
        const sets = setsByFormatId.get(bpf.performanceFormatId) ?? [];
        return (
          <div key={bpf.id} className="mb-4 last:mb-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <FormatIcon icon={bpf.performanceFormat.icon} />
                {bpf.performanceFormat.label}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(bpf)}
                disabled={removeFormat.isPending}
                className="text-muted hover:text-status-cancelled transition-colors disabled:opacity-50"
                aria-label={`Remove ${bpf.performanceFormat.label}`}
              >
                <Trash2 size={13} />
              </button>
            </div>
            {sets.map((set) => (
              <SetRow
                key={set.id}
                set={set}

                onUpdate={(setId, startTime) => updateSet.mutate({ setId, startTime })}
              />
            ))}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted mb-1">Other sets</p>
          {unassigned.map((set) => (
            <SetRow
              key={set.id}
              set={set}
              onUpdate={(setId, startTime) => updateSet.mutate({ setId, startTime })}
            />
          ))}
        </div>
      )}

      {!addOpen ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors mt-2"
        >
          <Plus size={14} />
          Add format
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-muted font-medium uppercase tracking-wide">Select a format</p>
          {availableFormats.length === 0 ? (
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
    </Card>
  );
}

// ─── Music form config section ────────────────────────────────────────────────

function MusicFormSection({ booking, documents }: { booking: BookingDetail; documents: Document[] }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [viewingResponse, setViewingResponse] = useState(false);

  const { isLoaded } = useAuth();

  const { data: config, isLoading } = useQuery({
    queryKey: ['booking-music-form-config', booking.id],
    queryFn: () => apiGet<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`),
    enabled: isLoaded && booking.hasMusicFormConfig,
  });

  const { data: response } = useQuery({
    queryKey: ['booking-music-form-response', booking.id],
    queryFn: () => apiGet<MusicFormResponse>(`/bookings/${booking.id}/music-form-response`),
    enabled: isLoaded && booking.hasMusicFormResponse && viewingResponse,
  });

  const songListDoc = documents.find((d) => d.type === 'SONG_LIST');

  const [localKeyMoments, setLocalKeyMoments] = useState<KeyMoment[]>([]);
  const [localGenres, setLocalGenres] = useState<string[]>([]);

  function openEditor() {
    setLocalKeyMoments(config?.keyMoments ?? []);
    setLocalGenres(config?.enabledGenres ?? []);
    setEditing(true);
  }

  const save = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`, {
        keyMoments: localKeyMoments,
        enabledGenres: localGenres,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      setEditing(false);
    },
  });

  function toggleGenre(genre: string) {
    setLocalGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }

  if (!booking.hasMusicFormConfig) {
    return (
      <Card title="Music form">
        <div className="flex items-center gap-2 text-muted py-1">
          <ClipboardList size={14} />
          <span className="text-sm">No song request form configured</span>
        </div>
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

  if (editing) {
    const sectionMap = new Map<string, KeyMoment[]>();
    for (const km of localKeyMoments) {
      if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
      sectionMap.get(km.section)!.push(km);
    }

    return (
      <Card title="Music form">
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
                            onClick={() => setLocalKeyMoments((prev) => prev.filter((m) => m !== km))}
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
            <Button
              size="sm"
              onClick={() => save.mutate()}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Card>
    );
  }

  const sectionMap = new Map<string, KeyMoment[]>();
  for (const km of config.keyMoments) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

  return (
    <>
      <Card title="Music form">
        <div className="space-y-3">
          {booking.hasMusicFormResponse && (
            <button
              type="button"
              onClick={() => setViewingResponse(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-status-confirmed bg-status-confirmed/10 rounded-full px-2.5 py-0.5 hover:bg-status-confirmed/20 transition-colors"
            >
              <CheckCircle2 size={11} />
              Response received · View
            </button>
          )}
          {Array.from(sectionMap.entries()).map(([section, moments]) => (
            <div key={section}>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">{section}</p>
              <div className="space-y-0.5">
                {moments.map((km, i) => (
                  <p key={i} className="text-sm text-foreground">{km.label}</p>
                ))}
              </div>
            </div>
          ))}
          {config.enabledGenres.length > 0 && (
            <div>
              <p className="text-xs text-muted uppercase tracking-wide mb-1">Genres</p>
              <p className="text-sm text-foreground">
                {config.enabledGenres
                  .map((g) => GENRE_LABELS[g as keyof typeof GENRE_LABELS] ?? g)
                  .join(', ')}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={openEditor}
            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors pt-1"
          >
            <Pencil size={13} />
            Edit
          </button>
        </div>
      </Card>

      {/* Song list response sheet */}
      <Sheet open={viewingResponse} onOpenChange={setViewingResponse}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle>Song requests</SheetTitle>
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
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {!response ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-4 bg-border rounded w-3/4" />)}
              </div>
            ) : (
              <div className="space-y-6">
                {response.specialRequests.some((r) => r.song || r.freeText) && (
                  <section>
                    <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Key moments</p>
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
                {response.selectedSongs.length > 0 && (() => {
                  const genreMap = new Map<string, typeof response.selectedSongs>();
                  for (const song of response.selectedSongs) {
                    if (!genreMap.has(song.genre)) genreMap.set(song.genre, []);
                    genreMap.get(song.genre)!.push(song);
                  }
                  return (
                    <section>
                      <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">General requests</p>
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
                  );
                })()}
                {response.notes && (
                  <section>
                    <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{response.notes}</p>
                  </section>
                )}
                {response.selectedSongs.length === 0 && !response.specialRequests.some((r) => r.song || r.freeText) && !response.notes && (
                  <p className="text-sm text-muted">No selections made.</p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({ venue, linkState }: { venue: Contact; linkState?: Record<string, string> }) {
  const contactLine = [venue.email, venue.phone].filter(Boolean).join(' · ');
  return (
    <Card title="Venue">
      <Link
        to={`/admin/contacts/${venue.id}`}
        state={linkState}
        className="inline-flex items-center gap-1 group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {venue.name}
        </span>
        <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
      </Link>
      {contactLine && <p className="text-sm text-muted mt-0.5">{contactLine}</p>}
      {venue.address && (
        <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{venue.address}</p>
      )}
      {(venue.parkingInfo || venue.accessInfo || venue.equipmentAvailable) && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5">
          {venue.parkingInfo && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Parking</span>
              {' · '}{venue.parkingInfo}
            </p>
          )}
          {venue.accessInfo && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Access</span>
              {' · '}{venue.accessInfo}
            </p>
          )}
          {venue.equipmentAvailable && (
            <p className="text-sm text-muted">
              <span className="text-foreground">Equipment</span>
              {' · '}{venue.equipmentAvailable}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  onEdit,
  onDelete,
  onSend,
  onMarkSent,
}: {
  invoice: Invoice;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
}) {
  const overdue =
    invoice.status === 'SENT' &&
    !!invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();
  const total = invoiceLineTotal(invoice);
  const isDraft = invoice.status === 'DRAFT';

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-foreground">{invoice.isDeposit ? 'Deposit' : 'Balance'}</p>
        <p className="text-xs text-muted mt-0.5">
          {invoice.issueDate ? formatDate(invoice.issueDate) : '—'}
          {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm font-medium text-foreground">
          {formatCurrency(total)}
        </span>
        <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
        {isDraft && (
          <>
            <button
              onClick={() => onSend(invoice)}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Send invoice"
            >
              <Send size={13} />
            </button>
            <button
              onClick={() => onEdit(invoice)}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Edit invoice"
            >
              <Pencil size={13} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-muted hover:text-foreground transition-colors"
                  aria-label="More actions"
                >
                  <ChevronDown size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onMarkSent(invoice)}>
                  Mark as sent
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(invoice)}
                  className="text-status-cancelled focus:text-status-cancelled"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Communications ───────────────────────────────────────────────────────────

function CommunicationRow({ comm }: { comm: Communication }) {
  const meta = [comm.template?.name, `To ${comm.contact.name}`].filter(Boolean).join(' · ');
  const isFailed = comm.status === 'FAILED';
  const isPending = comm.status === 'PENDING';
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="min-w-0 flex items-start gap-2">
        {isFailed && <AlertTriangle size={14} className="text-status-cancelled flex-shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className={`text-sm truncate ${isFailed ? 'text-status-cancelled' : 'text-foreground'}`}>
            {comm.subject}
          </p>
          <p className="text-xs text-muted mt-0.5">
            {isFailed ? 'Send failed · ' : isPending ? 'Sending · ' : ''}{meta}
          </p>
        </div>
      </div>
      <span className="text-xs text-muted flex-shrink-0">
        {comm.sentAt ? formatDate(comm.sentAt) : '—'}
      </span>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl animate-pulse space-y-6">
      <div className="h-4 w-24 bg-border rounded" />
      <div className="space-y-2">
        <div className="h-7 w-56 bg-border rounded" />
        <div className="h-4 w-32 bg-border rounded" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => <div key={i} className="h-4 w-48 bg-border rounded" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-32 bg-border rounded-lg" />
        <div className="h-32 bg-border rounded-lg" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setSearchParams] = useSearchParams();

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTemplateType, setComposeTemplateType] = useState<string | undefined>();
  const [invoiceSheetOpen, setInvoiceSheetOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();
  const [invoiceSheetPrefill, setInvoiceSheetPrefill] = useState<{ isDeposit: boolean; amount?: number } | undefined>();
  const [markSentInvoice, setMarkSentInvoice] = useState<Invoice | undefined>();

  const { isLoaded } = useAuth();
  const { data: booking, isLoading, isError } = useBooking(id!);
  const { data: invoices = [], isPending: invoicesPending } = useBookingInvoices(id!);
  const { data: communications = [] } = useBookingCommunications(id!);
  const { data: documents = [] } = useBookingDocuments(id!);
  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const actions = useBookingActions(id!);

  function openCompose(templateType?: string) {
    setComposeTemplateType(templateType);
    setComposeOpen(true);
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    setEditingInvoice(undefined);
    setInvoiceSheetPrefill(prefill);
    setInvoiceSheetOpen(true);
  }

  function openEditInvoice(invoice: Invoice) {
    setEditingInvoice(invoice);
    setInvoiceSheetPrefill(undefined);
    setInvoiceSheetOpen(true);
  }

  function openSendInvoice(invoice: Invoice) {
    const templateType = invoice.isDeposit ? 'deposit_invoice_cover' : 'balance_invoice_cover';
    openCompose(templateType);
  }

  function handleInvoiceAction(action: 'create_deposit_invoice' | 'create_balance_invoice') {
    const isDeposit = action === 'create_deposit_invoice';
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;

    if (fee && pct) {
      const amount = isDeposit ? (fee * pct) / 100 : fee * (1 - pct / 100);
      actions.autoCreateInvoice({ isDeposit, amount: Math.round(amount * 100) / 100 });
    } else {
      openCreateInvoice({ isDeposit });
    }
  }

  if (isLoading) return <PageSkeleton />;

  if (isError || !booking) {
    return (
      <div className="px-4 md:px-6 py-6">
        <p className="text-sm text-muted">Booking not found.</p>
        <Link
          to="/admin/bookings"
          className="text-sm text-primary underline underline-offset-2 mt-2 block"
        >
          Back to bookings
        </Link>
      </div>
    );
  }

  const title = booking.title ?? EVENT_TYPE_LABELS[booking.eventType];
  const fee = formatFee(booking.fee);
  const checklist =
    booking.status !== 'CANCELLED'
      ? buildChecklist(booking, communications, invoices)
      : [];
  const backState = { from: `/admin/bookings/${id}`, label: title };

  return (
    <div className="px-4 md:px-6 py-6 max-w-2xl space-y-8">

      {/* Back */}
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        Bookings
      </Link>

      {/* 1. Header */}
      <section>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/booking/${booking.portalToken}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded-md px-3 py-1.5"
            >
              Client portal
            </a>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchParams({ edit: 'true' })}
            >
              Edit
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <StatusDropdown booking={booking} />
          <span className="text-sm text-muted">
            {formatDate(booking.date)}
          </span>
          {fee && <span className="text-sm text-muted">{fee}</span>}
        </div>

      </section>

      {/* 2. People */}
      <section>
        <SectionHeader label="People" />
        <div className="border-t border-border">
          <PersonCard role="Customer" contact={booking.customer} linkState={backState} />
          {booking.referrer && (
            <PersonCard
              role="Referrer"
              contact={booking.referrer}
              commissionArrangement={booking.referrer.commissionArrangement}
              linkState={backState}
            />
          )}
        </div>
      </section>

      {/* 3. Notes & Checklist */}
      {(booking.notes || (booking.status !== 'CANCELLED' && checklist.length > 0)) && (
        <div className={
          booking.notes && booking.status !== 'CANCELLED' && checklist.length > 0
            ? 'grid grid-cols-1 md:grid-cols-2 gap-6'
            : undefined
        }>
          {booking.notes && (
            <section>
              <SectionHeader label="Notes" />
              <p className="text-sm text-muted whitespace-pre-wrap">{booking.notes}</p>
            </section>
          )}
          {booking.status !== 'CANCELLED' && checklist.length > 0 && (
            <section>
              <SectionHeader label="Checklist" />
              <div className="space-y-2.5">
                {checklist.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.state === 'done' ? (
                        <CheckCircle2 size={16} className="text-status-confirmed flex-shrink-0" />
                      ) : item.state === 'failed' ? (
                        <AlertTriangle size={16} className="text-status-cancelled flex-shrink-0" />
                      ) : (
                        <Circle size={16} className="text-muted flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span
                          className={
                            item.state === 'done'
                              ? 'text-sm text-muted line-through'
                              : item.state === 'failed'
                              ? 'text-sm text-status-cancelled'
                              : 'text-sm text-foreground'
                          }
                        >
                          {item.label}
                        </span>
                        {item.state === 'failed' && (
                          <p className="text-xs text-status-cancelled">Last send failed</p>
                        )}
                      </div>
                    </div>
                    {item.shortcutTemplateType && item.state === 'failed' && (
                      <button
                        onClick={() => openCompose(item.shortcutTemplateType)}
                        className="text-xs text-primary hover:underline flex-shrink-0"
                      >
                        Retry
                      </button>
                    )}
                    {item.shortcutTemplateType && item.state === 'outstanding' && (
                      <button
                        onClick={() => openCompose(item.shortcutTemplateType)}
                        className="text-xs text-primary hover:underline flex-shrink-0"
                      >
                        Send
                      </button>
                    )}
                    {item.shortcutAction && item.state !== 'done' && (
                      <button
                        onClick={() => handleInvoiceAction(item.shortcutAction!)}
                        className="text-xs text-primary hover:underline flex-shrink-0"
                      >
                        Create
                      </button>
                    )}
                    {item.shortcutMarkDone && item.state === 'outstanding' && (
                      <button
                        onClick={() => {
                          if (item.shortcutMarkDone === 'mark_contract_signed') actions.markContractSigned();
                          else actions.markDepositReceived();
                        }}
                        disabled={actions.isPending}
                        className="text-xs text-primary hover:underline flex-shrink-0 disabled:opacity-50"
                      >
                        Mark done
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 4. For the day */}
      <section>
        <SectionHeader label="For the day" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PerformanceSection booking={booking} />
          {booking.venue && <VenueCard venue={booking.venue} linkState={backState} />}
          <MusicFormSection booking={booking} documents={documents} />
        </div>
      </section>

      {/* 5. Finance */}
      <section>
        <SectionHeader label="Finance" />
        <div className="space-y-4">
          {/* Invoices */}
          <div className="bg-background border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Invoices</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus size={14} className="mr-1.5" />
                    Add invoice
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      const fee = booking.fee ? parseFloat(booking.fee) : null;
                      const pct = userProfile?.depositPercentage;
                      openCreateInvoice({
                        isDeposit: true,
                        amount: fee && pct ? Math.round((fee * pct / 100) * 100) / 100 : undefined,
                      });
                    }}
                  >
                    Deposit invoice
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      const fee = booking.fee ? parseFloat(booking.fee) : null;
                      const pct = userProfile?.depositPercentage;
                      openCreateInvoice({
                        isDeposit: false,
                        amount: fee && pct ? Math.round((fee * (1 - pct / 100)) * 100) / 100 : undefined,
                      });
                    }}
                  >
                    Balance invoice
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {invoicesPending ? (
              <div className="space-y-2 animate-pulse">
                {[1, 2].map((i) => <div key={i} className="h-9 bg-border rounded" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="flex items-center gap-2 text-muted py-1">
                <DollarSign size={14} />
                <span className="text-sm">No invoices yet</span>
              </div>
            ) : (
              <div>
                {invoices.map((inv) => (
                  <InvoiceRow
                    key={inv.id}
                    invoice={inv}
                    onEdit={openEditInvoice}
                    onDelete={(inv) => actions.deleteInvoice(inv.id)}
                    onSend={openSendInvoice}
                    onMarkSent={setMarkSentInvoice}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Documents */}
          <Card title="Documents">
            {documents.length === 0 ? (
              <div className="flex items-center gap-2 text-muted py-1">
                <FolderOpen size={14} />
                <span className="text-sm">No documents yet</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc: Document) => {
                  const invoice = invoices.find((i) => i.id === doc.invoiceId);
                  const label = doc.type === 'CONTRACT'
                    ? 'Contract'
                    : invoice?.isDeposit
                      ? 'Deposit invoice'
                      : 'Balance invoice';
                  const filename = `${label.toLowerCase().replace(' ', '-')}.pdf`;
                  const handleDownload = async () => {
                    const res = await fetch(doc.url);
                    const blob = await res.blob();
                    const a = window.document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  };
                  return (
                    <div key={doc.id} className="flex items-center gap-2 py-2">
                      <FileText size={14} className="flex-shrink-0 text-muted mt-0.5 self-start" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-foreground">{label}</span>
                        {invoice?.invoiceNumber && (
                          <span className="text-xs text-muted">{invoice.invoiceNumber}</span>
                        )}
                      </div>
                      <span className="text-muted ml-auto text-xs shrink-0">
                        {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        onClick={handleDownload}
                        title="Download"
                        className="text-muted hover:text-foreground shrink-0"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </section>

      {/* 6. Communications */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">Communications</h2>
          <Button variant="outline" size="sm" onClick={() => openCompose()}>
            <Mail size={14} className="mr-1.5" />
            Send email
          </Button>
        </div>
        {communications.length === 0 ? (
          <div className="flex items-center gap-2 text-muted py-1">
            <FileText size={14} />
            <span className="text-sm">No emails sent yet</span>
          </div>
        ) : (
          <div className="border-t border-border">
            {communications.map((comm) => (
              <CommunicationRow key={comm.id} comm={comm} />
            ))}
          </div>
        )}
      </section>

      <BookingEditDrawer booking={booking} />
      <InvoiceSheet
        bookingId={id!}
        invoice={editingInvoice}
        hasDepositInvoice={invoices.some((inv) => inv.isDeposit)}
        prefill={invoiceSheetPrefill}
        open={invoiceSheetOpen}
        onOpenChange={setInvoiceSheetOpen}
      />
      <ComposeEmailSheet
        bookingId={id!}
        booking={booking}
        invoices={invoices}
        defaultPaymentTermsDays={userProfile?.defaultPaymentTermsDays}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        initialTemplateType={composeTemplateType}
      />
      {markSentInvoice && (
        <MarkSentDialog
          bookingId={id!}
          invoice={markSentInvoice}
          userProfile={userProfile}
          open={!!markSentInvoice}
          onOpenChange={(open) => { if (!open) setMarkSentInvoice(undefined); }}
        />
      )}
    </div>
  );
}
