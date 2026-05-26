import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Mail, Music, FileText, DollarSign, FolderOpen, ChevronDown, Check, Pencil, Plus, Send, Download, Eye, Lock, Heart, GlassWater, Utensils, Moon, Briefcase, Music2, Car, KeyRound, Speaker } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import ContractSheet from '@/features/bookings/ContractSheet';
import ContactEditSheet from '@/features/contacts/ContactEditSheet';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import { buildChecklist } from '@/lib/buildChecklist';
import { toast } from '@/lib/hooks/use-toast';
import { apiGet, apiPatch, apiPost, apiPut } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { EVENT_TYPE_LABELS, GENRE_LABELS, STATUS_ORDER } from '@/lib/constants';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  BookingDetail,
  BookingStatus,
  Contact,
  Document,
  KeyMoment,
  MusicFormConfig,
  MusicFormResponse,
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
  ENQUIRY:   'bg-status-enquiry/12 text-status-enquiry border-l-status-enquiry',
  CONFIRMED: 'bg-status-confirmed/12 text-status-confirmed border-l-status-confirmed',
  INVOICED:  'bg-status-invoiced/12 text-status-invoiced border-l-status-invoiced',
  SETTLED:   'bg-status-settled/12 text-status-settled border-l-status-settled',
  COMPLETED: 'bg-status-completed/12 text-status-completed border-l-status-completed',
  CANCELLED: 'bg-status-cancelled/12 text-status-cancelled border-l-status-cancelled',
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
            'inline-flex items-center gap-1 border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium cursor-pointer',
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
            <span className={cn('inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium', STATUS_PILL_CLASSES[s])}>
              {STATUS_LABELS[s]}
            </span>
            {s === booking.status && <Check size={12} className="ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── InlineNotes ─────────────────────────────────────────────────────────────

function InlineNotes({ bookingId, initialNotes }: { bookingId: string; initialNotes: string | null }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(initialNotes ?? '');
  const [savedVisible, setSavedVisible] = useState(false);
  const lastSavedRef = useRef(initialNotes ?? '');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: (notes: string) => apiPatch(`/bookings/${bookingId}`, { notes: notes || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setSavedVisible(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedVisible(false), 2000);
    },
  });

  // Sync from server when nothing is pending (e.g. after drawer save)
  useEffect(() => {
    if (!mutation.isPending && value === lastSavedRef.current) {
      setValue(initialNotes ?? '');
    }
    lastSavedRef.current = initialNotes ?? '';
  }, [initialNotes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced auto-save
  useEffect(() => {
    if (value === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      lastSavedRef.current = value;
      mutation.mutate(value);
    }, 1000);
    return () => clearTimeout(timer);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const statusText = mutation.isPending ? 'Saving…' : savedVisible ? 'Saved' : null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Notes</h2>
        <span className={`text-xs transition-opacity duration-300 ${statusText ? 'opacity-100' : 'opacity-0'} ${savedVisible && !mutation.isPending ? 'text-status-confirmed' : 'text-muted'}`}>
          {statusText ?? 'Saved'}
        </span>
      </div>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add notes about this booking…"
        rows={5}
        className="resize-none text-sm"
      />
    </section>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-sm font-semibold text-foreground mb-3">{label}</h2>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({ title, action, children }: { title?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-background border border-border rounded-lg p-4">
      {title && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">{title}</p>
          {action}
        </div>
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
  onEdit,
}: {
  role: string;
  contact: Contact;
  commissionArrangement?: string | null;
  linkState?: Record<string, string>;
  onEdit: () => void;
}) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">{role}</p>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Edit
        </button>
      </div>
      <Link
        to={`/admin/contacts/${contact.id}`}
        state={linkState}
        className="inline-flex items-center gap-1 group"
      >
        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
          {contact.name}
        </span>
        <ChevronRight size={14} className="text-muted group-hover:text-primary transition-colors" />
      </Link>
      {(contact.email || contact.phone) && (
        <p className="text-sm text-muted mt-0.5">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="hover:text-primary transition-colors">{contact.email}</a>
          )}
          {contact.email && contact.phone && ' · '}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="hover:text-primary transition-colors">{contact.phone}</a>
          )}
        </p>
      )}
      {commissionArrangement && (
        <p className="text-sm text-muted mt-0.5">
          <span className="text-foreground">Commission</span>
          {' · '}{commissionArrangement}
        </p>
      )}
    </div>
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

function PerformanceSection({ booking }: { booking: BookingDetail }) {
  const [, setSearchParams] = useSearchParams();

  const setsByFormatId = new Map<string | null, PerformanceSet[]>();
  for (const set of booking.sets ?? []) {
    const key = set.performanceFormatId ?? null;
    if (!setsByFormatId.has(key)) setsByFormatId.set(key, []);
    setsByFormatId.get(key)!.push(set);
  }
  const unassigned = setsByFormatId.get(null) ?? [];

  function openDrawer() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('edit', 'true');
      return next;
    });
  }

  return (
    <Card
      title="Performance"
      action={
        <button
          type="button"
          onClick={openDrawer}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Edit
        </button>
      }
    >
      {(booking.performanceFormats ?? []).length === 0 && unassigned.length === 0 && (
        <div className="flex items-center gap-2 text-muted py-1">
          <Music size={14} />
          <span className="text-sm">No formats applied</span>
        </div>
      )}

      {(booking.performanceFormats ?? []).map((bpf) => {
        const sets = setsByFormatId.get(bpf.performanceFormatId) ?? [];
        return (
          <div key={bpf.id} className="mb-4 last:mb-0">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1">
              <FormatIcon icon={bpf.performanceFormat.icon} />
              {bpf.performanceFormat.label}
            </div>
            {sets.map((set) => (
              <div key={set.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <span className="flex-1 text-sm text-foreground">
                  {[set.label, formatDuration(set.duration)].filter(Boolean).join(' · ')}
                </span>
                {set.startTime && (
                  <span className="text-sm text-muted flex-shrink-0">{set.startTime}</span>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {unassigned.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted mb-1">Other sets</p>
          {unassigned.map((set) => (
            <div key={set.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
              <span className="flex-1 text-sm text-foreground">
                {[set.label, formatDuration(set.duration)].filter(Boolean).join(' · ')}
              </span>
              {set.startTime && (
                <span className="text-sm text-muted flex-shrink-0">{set.startTime}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Music form config section ────────────────────────────────────────────────

function MusicFormSection({ booking, documents }: { booking: BookingDetail; documents: Document[] }) {
  const queryClient = useQueryClient();
  const [viewingResponse, setViewingResponse] = useState(false);
  const [, setSearchParams] = useSearchParams();

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

  const seedKeyMoments: KeyMoment[] = (booking.performanceFormats ?? []).flatMap((bpf) =>
    bpf.performanceFormat.keyMoments.map((km) => ({ label: km, section: bpf.performanceFormat.label })),
  );
  const seedGenres = [...new Set((booking.performanceFormats ?? []).flatMap((bpf) => bpf.performanceFormat.defaultGenreSelection))];

  const configure = useMutation({
    mutationFn: () =>
      apiPut<MusicFormConfig>(`/bookings/${booking.id}/music-form-config`, {
        keyMoments: seedKeyMoments,
        enabledGenres: seedGenres,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-music-form-config', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('edit', 'true'); return next; });
    },
  });

  function openDrawer() {
    setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('edit', 'true'); return next; });
  }

  if (!booking.hasMusicFormConfig) {
    return (
      <Card title="Music form">
        <button
          type="button"
          onClick={() => configure.mutate()}
          disabled={configure.isPending}
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
    (booking.performanceFormats ?? []).map((bpf) => [
      bpf.performanceFormat.label,
      bpf.performanceFormat.icon,
    ]),
  );

  const sectionMap = new Map<string, KeyMoment[]>();
  for (const km of config.keyMoments) {
    if (!sectionMap.has(km.section)) sectionMap.set(km.section, []);
    sectionMap.get(km.section)!.push(km);
  }

  return (
    <>
      <Card
        title="Music form"
        action={
          <button
            type="button"
            onClick={openDrawer}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Edit
          </button>
        }
      >
        <div className="space-y-4">
          {booking.hasMusicFormResponse && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewingResponse(true)}
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
                {config.enabledGenres
                  .map((g) => GENRE_LABELS[g as keyof typeof GENRE_LABELS] ?? g)
                  .join(', ')}
              </p>
            </div>
          )}
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

function VenueCard({ venue, linkState, onEdit }: { venue: Contact; linkState?: Record<string, string>; onEdit: () => void }) {
  return (
    <Card
      title="Venue"
      action={
        <button
          type="button"
          onClick={onEdit}
          className="text-xs text-primary hover:text-primary/80 transition-colors"
        >
          Edit
        </button>
      }
    >
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
      {(venue.email || venue.phone) && (
        <p className="text-sm text-muted mt-0.5">
          {venue.email && (
            <a href={`mailto:${venue.email}`} className="hover:text-primary transition-colors">{venue.email}</a>
          )}
          {venue.email && venue.phone && ' · '}
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="hover:text-primary transition-colors">{venue.phone}</a>
          )}
        </p>
      )}
      {venue.address && (
        <p className="text-sm text-muted mt-0.5 whitespace-pre-wrap">{venue.address}</p>
      )}
      {(venue.parkingInfo || venue.accessInfo || venue.equipmentAvailable) && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {venue.parkingInfo && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                <Car size={14} />
                Parking
              </div>
              <p className="text-sm text-foreground">{venue.parkingInfo}</p>
            </div>
          )}
          {venue.accessInfo && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                <KeyRound size={14} />
                Access
              </div>
              <p className="text-sm text-foreground">{venue.accessInfo}</p>
            </div>
          )}
          {venue.equipmentAvailable && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-0.5">
                <Speaker size={14} />
                Equipment
              </div>
              <p className="text-sm text-foreground">{venue.equipmentAvailable}</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Contract ─────────────────────────────────────────────────────────────────

type ContractState = 'not_started' | 'draft' | 'sent' | 'signed';

function deriveContractState(booking: BookingDetail, communications: Communication[]): ContractState {
  if (booking.contractSignedAt) return 'signed';
  const contractSent = communications.some(
    (c) =>
      c.status === 'SENT' &&
      (c.template?.builtInType === 'contract_cover' || c.template?.builtInType === 'contract_and_deposit_cover'),
  );
  if (contractSent) return 'sent';
  if (booking.contractContent !== null) return 'draft';
  return 'not_started';
}

const CONTRACT_PILL_CLASSES: Record<Exclude<ContractState, 'not_started'>, string> = {
  draft:  'bg-status-invoiced/12 text-status-invoiced border-l-status-invoiced',
  sent:   'bg-status-confirmed/12 text-status-confirmed border-l-status-confirmed',
  signed: 'bg-status-settled/12 text-status-settled border-l-status-settled',
};

const CONTRACT_PILL_LABELS: Record<Exclude<ContractState, 'not_started'>, string> = {
  draft:  'Draft',
  sent:   'Sent',
  signed: 'Signed',
};

function ContractCard({
  booking,
  communications,
  documents,
  isCreating,
  onCreateContract,
  onEdit,
  onPreview,
}: {
  booking: BookingDetail;
  communications: Communication[];
  documents: Document[];
  isCreating: boolean;
  onCreateContract: () => void;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const state = deriveContractState(booking, communications);
  const contractDoc = documents.find((d) => d.type === 'CONTRACT');

  return (
    <Card title="Contract">
      {state === 'not_started' ? (
        <button
          type="button"
          onClick={onCreateContract}
          disabled={isCreating}
          className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          <Plus size={14} />
          {isCreating ? 'Creating…' : 'Create contract'}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          {state === 'draft' && (
            <button
              type="button"
              onClick={onEdit}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Edit contract"
            >
              <Pencil size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={onPreview}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Preview contract"
          >
            <Eye size={14} />
          </button>
          {contractDoc && (
            <a
              href={contractDoc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Download contract PDF"
            >
              <Download size={14} />
            </a>
          )}
          <span className={cn('inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium', CONTRACT_PILL_CLASSES[state as Exclude<ContractState, 'not_started'>])}>
            {CONTRACT_PILL_LABELS[state as Exclude<ContractState, 'not_started'>]}
          </span>
        </div>
      )}
    </Card>
  );
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

function InvoiceRow({
  invoice,
  pdfUrl,
  onEdit,
  onDelete,
  onSend,
  onMarkSent,
  onMarkPaid,
}: {
  invoice: Invoice;
  pdfUrl: string | null;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
}) {
  const overdue =
    invoice.status === 'SENT' &&
    !!invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();
  const total = invoiceLineTotal(invoice);
  const isDraft = invoice.status === 'DRAFT';
  const isSent = invoice.status === 'SENT';
  const isPaid = invoice.status === 'PAID';

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
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatCurrency(total)}
        </span>
        {isDraft && (
          <>
            <button
              onClick={() => onSend(invoice)}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Send invoice"
            >
              <Send size={14} />
            </button>
            <button
              onClick={() => onEdit(invoice)}
              className="text-muted hover:text-foreground transition-colors"
              aria-label="Edit invoice"
            >
              <Pencil size={14} />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="text-muted hover:text-foreground transition-colors"
                  aria-label="More actions"
                >
                  <ChevronDown size={14} />
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
        {isSent && (
          <button
            onClick={() => onMarkPaid(invoice)}
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Mark invoice as paid"
          >
            <CheckCircle2 size={14} />
          </button>
        )}
        {(isSent || isPaid) && pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground transition-colors"
            aria-label="Download invoice PDF"
          >
            <Download size={14} />
          </a>
        )}
        <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
      </div>
    </div>
  );
}

// ─── Communications ───────────────────────────────────────────────────────────

function emailDoc(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',system-ui,sans-serif;font-size:14px;line-height:1.6;color:hsl(222 47% 11%);background:#fff;padding:24px;-webkit-font-smoothing:antialiased}
    p{margin-bottom:.75em}p:last-child{margin-bottom:0}
    ul{list-style:disc;padding-left:1.5em;margin-bottom:.75em}
    ol{list-style:decimal;padding-left:1.5em;margin-bottom:.75em}
    li{margin-bottom:.25em}
    strong{font-weight:600}
    a{color:hsl(222 89% 55%)}
  </style></head><body>${body}</body></html>`;
}

function CommunicationRow({ comm }: { comm: Communication }) {
  const [open, setOpen] = useState(false);
  const meta = [comm.template?.name, `To ${comm.contact.name}`].filter(Boolean).join(' · ');
  const isFailed = comm.status === 'FAILED';
  const isPending = comm.status === 'PENDING';
  const isSent = comm.status === 'SENT';

  return (
    <>
      <div
        className={`flex items-start justify-between gap-3 py-3 border-b border-border last:border-0 ${isSent ? 'cursor-pointer hover:bg-muted/30 -mx-4 px-4 rounded transition-colors' : ''}`}
        onClick={() => { if (isSent) setOpen(true); }}
        role={isSent ? 'button' : undefined}
        aria-label={isSent ? `View email: ${comm.subject}` : undefined}
      >
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

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="truncate">{comm.subject}</SheetTitle>
            <div className="space-y-0.5 mt-1">
              <p className="text-xs text-muted">
                To: {comm.contact.name}
                {comm.contact.email && (
                  <> &lt;<a href={`mailto:${comm.contact.email}`} className="hover:text-primary transition-colors">{comm.contact.email}</a>&gt;</>
                )}
              </p>
              {comm.sentAt && <p className="text-xs text-muted">Sent: {formatDate(comm.sentAt)}</p>}
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            <iframe
              srcDoc={emailDoc(comm.body)}
              title={comm.subject}
              className="w-full h-full border-0"
              sandbox="allow-same-origin"
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
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
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contractSheetOpen, setContractSheetOpen] = useState(false);
  const [contractSheetReadOnly, setContractSheetReadOnly] = useState(false);
  const [pendingContractContent, setPendingContractContent] = useState<unknown | null>(null);

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
  const queryClient = useQueryClient();

  const createContract = useMutation({
    mutationFn: () => apiPost<{ contractContent: unknown }>(`/bookings/${id}/contract/create`, {}),
    onSuccess: (data) => {
      setPendingContractContent(data.contractContent);
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setContractSheetReadOnly(false);
      setContractSheetOpen(true);
    },
    onError: () => toast({ title: 'Failed to create contract', variant: 'destructive' }),
  });

  const markPaid = useMutation({
    mutationFn: (invoiceId: string) => apiPost(`/bookings/${id}/invoices/${invoiceId}/mark-paid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
    onError: () => toast({ title: 'Failed to mark invoice as paid', variant: 'destructive' }),
  });

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
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">

      {/* Back */}
      <Link
        to="/admin/bookings"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        Bookings
      </Link>

      <div className="mt-6 md:grid md:grid-cols-[3fr_2fr] md:gap-8 md:items-start">

        {/* ─── Left column ─── */}
        <div className="space-y-8">

          {/* 1. Header */}
          <section>
            <div className="flex items-start justify-between gap-4">
              <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/booking/${booking.portalToken}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors border border-border rounded px-3 py-1.5"
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
              <span className="text-sm text-muted">{formatDate(booking.date)}</span>
              {fee && <span className="text-sm text-muted">{fee}</span>}
            </div>
          </section>

          {/* 2. People */}
          <section>
            <SectionHeader label="People" />
            <div className="border-t border-border">
              <PersonCard role="Customer" contact={booking.customer} linkState={backState} onEdit={() => setEditingContact(booking.customer)} />
              {booking.referrer && (
                <PersonCard
                  role="Referrer"
                  contact={booking.referrer}
                  commissionArrangement={booking.referrer.commissionArrangement}
                  linkState={backState}
                  onEdit={() => setEditingContact(booking.referrer!)}
                />
              )}
            </div>
          </section>

          {/* 3. Notes */}
          <InlineNotes bookingId={booking.id} initialNotes={booking.notes} />

          {/* 4. For the day */}
          <section>
            <SectionHeader label="For the day" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PerformanceSection booking={booking} />
              {booking.venue && <VenueCard venue={booking.venue} linkState={backState} onEdit={() => setEditingContact(booking.venue!)} />}
              <div className={booking.venue ? 'sm:col-span-2' : undefined}>
                <MusicFormSection booking={booking} documents={documents} />
              </div>
            </div>
          </section>

        </div>

        {/* ─── Right column ─── */}
        <div className="mt-8 md:mt-0 space-y-6 md:sticky md:top-20 md:max-h-[calc(100vh-5rem)] md:overflow-y-auto md:overflow-x-hidden md:pb-6">

          {/* Checklist */}
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
                      ) : item.state === 'blocked' ? (
                        <Lock size={16} className="text-muted flex-shrink-0" />
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
                              : item.state === 'blocked'
                              ? 'text-sm text-muted'
                              : 'text-sm text-foreground'
                          }
                        >
                          {item.label}
                        </span>
                        {item.state === 'failed' && (
                          <p className="text-xs text-status-cancelled">Last send failed</p>
                        )}
                        {item.state === 'blocked' && item.hint && (
                          <p className="text-xs text-muted">{item.hint}</p>
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
                          if (item.shortcutMarkDone === 'mark_contract_signed') {
                            actions.markContractSigned();
                          } else {
                            const sentDepositInvoice = invoices.find(
                              (inv) => inv.isDeposit && inv.status === 'SENT',
                            );
                            if (sentDepositInvoice) {
                              markPaid.mutate(sentDepositInvoice.id);
                            } else {
                              actions.markDepositReceived();
                            }
                          }
                        }}
                        disabled={actions.isPending || markPaid.isPending}
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

          {/* Contract */}
          {booking.status !== 'CANCELLED' && (
            <ContractCard
              booking={booking}
              communications={communications}
              documents={documents}
              isCreating={createContract.isPending}
              onCreateContract={() => createContract.mutate()}
              onEdit={() => { setContractSheetReadOnly(false); setContractSheetOpen(true); }}
              onPreview={() => { setContractSheetReadOnly(true); setContractSheetOpen(true); }}
            />
          )}

          {/* Invoices */}
          <div className="bg-background border border-border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-muted uppercase tracking-wide">Invoices</p>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                    <Plus size={12} />
                    Add invoice
                  </button>
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
                    pdfUrl={documents.find((d) => d.type === 'INVOICE' && d.invoiceId === inv.id)?.url ?? null}
                    onEdit={openEditInvoice}
                    onDelete={(inv) => actions.deleteInvoice(inv.id)}
                    onSend={openSendInvoice}
                    onMarkSent={setMarkSentInvoice}
                    onMarkPaid={(inv) => markPaid.mutate(inv.id)}
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

          {/* Communications */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Communications</h2>
              <button type="button" onClick={() => openCompose()} className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                <Mail size={12} />
                Send email
              </button>
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

        </div>{/* end right column */}
      </div>{/* end two-column grid */}

      <ContractSheet
        bookingId={id!}
        content={pendingContractContent ?? booking.contractContent}
        readOnly={contractSheetReadOnly}
        open={contractSheetOpen}
        onClose={() => { setContractSheetOpen(false); setPendingContractContent(null); }}
      />
      <BookingEditDrawer booking={booking} />
      <ContactEditSheet contact={editingContact} onClose={() => setEditingContact(null)} />
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
