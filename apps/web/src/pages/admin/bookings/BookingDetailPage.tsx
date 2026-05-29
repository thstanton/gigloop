import { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '@clerk/react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Mail, Music, FileText, DollarSign, FolderOpen, ChevronDown, Check, Pencil, Plus, Send, Download, Eye, Lock, Heart, GlassWater, Utensils, Moon, Briefcase, Music2, Car, KeyRound, Speaker, Sparkles } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { toast } from '@/lib/hooks/use-toast';
import { apiGet, apiPatch, apiPost, apiPostVoid, apiPut, apiDelete } from '@/lib/api';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type {
  BookingDetail,
  BookingStatus,
  ChecklistItem,
  Contact,
  Contract,
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

function dueDateDisplay(dueDate: string | null | undefined): { text: string; className: string } | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    const n = Math.abs(diffDays);
    return { text: n === 1 ? '1 day overdue' : `${n} days overdue`, className: 'text-status-cancelled' };
  }
  if (diffDays === 0) return { text: 'Due today', className: 'text-amber-600' };
  if (diffDays === 1) return { text: 'Due tomorrow', className: 'text-amber-600' };
  if (diffDays <= 7) return { text: `Due in ${diffDays} days`, className: 'text-amber-600' };
  return {
    text: `Due ${due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    className: 'text-muted',
  };
}

const STAGE_LABELS: Record<string, string> = {
  ENQUIRY: 'Enquiry',
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COMPLETE: 'Complete',
};

// ─── Status dropdown ──────────────────────────────────────────────────────────

const STATUS_PILL_CLASSES: Record<BookingStatus, string> = {
  ENQUIRY:      'bg-status-enquiry/12 text-status-enquiry border-l-status-enquiry',
  PROVISIONAL:  'bg-status-provisional/12 text-status-provisional border-l-status-provisional',
  CONFIRMED:    'bg-status-confirmed/12 text-status-confirmed border-l-status-confirmed',
  READY:        'bg-status-ready/12 text-status-ready border-l-status-ready',
  COMPLETE:     'bg-status-complete/12 text-status-complete border-l-status-complete',
  CANCELLED:    'bg-status-cancelled/12 text-status-cancelled border-l-status-cancelled',
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  ENQUIRY:      'Enquiry',
  PROVISIONAL:  'Provisional',
  CONFIRMED:    'Confirmed',
  READY:        'Ready',
  COMPLETE:     'Complete',
  CANCELLED:    'Cancelled',
};

function StatusDropdown({ booking, checklist }: { booking: BookingDetail; checklist: ChecklistItem[] }) {
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<BookingStatus | null>(null);

  const mutation = useMutation({
    mutationFn: (status: BookingStatus) =>
      apiPatch<BookingDetail>(`/bookings/${booking.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', booking.id] });
    },
  });

  const outstandingFor = (status: BookingStatus) =>
    checklist.filter(
      (item) => item.requiredForStatus === status && (item.state === 'PENDING' || item.state === 'FAILED'),
    );

  const handleSelect = (s: BookingStatus) => {
    if (s === booking.status) return;
    const outstanding = outstandingFor(s);
    if (outstanding.length > 0) {
      setPendingStatus(s);
    } else {
      mutation.mutate(s);
    }
  };

  return (
    <>
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
              onSelect={() => handleSelect(s)}
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

      {pendingStatus && (
        <Dialog open onOpenChange={() => setPendingStatus(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Outstanding checklist items</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted">
              {outstandingFor(pendingStatus).length} item{outstandingFor(pendingStatus).length !== 1 ? 's' : ''} still outstanding for{' '}
              <span className="font-medium text-foreground">{STATUS_LABELS[pendingStatus]}</span>:
            </p>
            <ul className="text-sm space-y-1 list-disc list-inside text-foreground">
              {outstandingFor(pendingStatus).map((item) => (
                <li key={item.id}>{item.label}</li>
              ))}
            </ul>
            <p className="text-sm text-muted">Mark as {STATUS_LABELS[pendingStatus]} anyway?</p>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setPendingStatus(null)}>Cancel</Button>
              <Button
                onClick={() => {
                  mutation.mutate(pendingStatus);
                  setPendingStatus(null);
                }}
              >
                Mark as {STATUS_LABELS[pendingStatus]}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
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

const CONTRACT_PILL_CLASSES: Record<string, string> = {
  DRAFT:  'bg-status-enquiry/12 text-status-enquiry border-l-status-enquiry',
  SENT:   'bg-status-confirmed/12 text-status-confirmed border-l-status-confirmed',
  SIGNED: 'bg-status-ready/12 text-status-ready border-l-status-ready',
  VOID:   'bg-muted/20 text-muted border-l-muted',
};

const CONTRACT_PILL_LABELS: Record<string, string> = {
  DRAFT:  'Draft',
  SENT:   'Sent',
  SIGNED: 'Signed',
  VOID:   'Void',
};

function ContractCard({
  booking,
  documents,
  isCreating,
  onCreateContract,
  onEdit,
  onPreview,
  onSend,
  onVoid,
  onDelete,
}: {
  booking: BookingDetail;
  documents: Document[];
  isCreating: boolean;
  onCreateContract: () => void;
  onEdit: () => void;
  onPreview: () => void;
  onSend: () => void;
  onVoid: (confirmSignedVoid: boolean) => void;
  onDelete: () => void;
}) {
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
  const contract = booking.activeContract;
  const status = contract?.status ?? null;
  const isVoid = status === 'VOID';
  const isEmpty = !contract;
  const contractDoc = documents.find((d) => d.type === 'CONTRACT' && d.contractStatus !== 'VOID');

  const headerAction = (isEmpty || isVoid) ? (
    <button
      type="button"
      onClick={onCreateContract}
      disabled={isCreating}
      className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
    >
      <Plus size={12} />
      {isCreating ? 'Creating…' : 'Create contract'}
    </button>
  ) : null;

  const contractDate = contract
    ? status === 'SIGNED' && contract.signedAt
      ? formatDate(contract.signedAt)
      : status === 'SENT' && contract.updatedAt
        ? formatDate(contract.updatedAt)
        : contract.createdAt
          ? formatDate(contract.createdAt)
          : null
    : null;

  return (
    <>
      <Card title="Contract" action={headerAction}>
        {isEmpty ? (
          <p className="text-sm text-muted">None created</p>
        ) : (
          <div className="flex items-start justify-between gap-3 py-0.5">
            <div className="min-w-0">
              <p className={cn('text-sm', isVoid ? 'text-muted line-through' : 'text-foreground')}>Contract</p>
              {contractDate && (
                <p className="text-xs text-muted mt-0.5">{contractDate}</p>
              )}
              <div className="mt-1">
                <span className={cn('inline-flex items-center border-l-[3px] pl-2 pr-2.5 py-0.5 text-xs font-medium', CONTRACT_PILL_CLASSES[status ?? ''] ?? '')}>
                  {CONTRACT_PILL_LABELS[status ?? ''] ?? status}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {status === 'DRAFT' && (
                <>
                  <button
                    type="button"
                    onClick={onSend}
                    className="text-muted hover:text-foreground transition-colors"
                    aria-label="Send contract"
                  >
                    <Send size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="text-muted hover:text-foreground transition-colors"
                    aria-label="Edit contract"
                  >
                    <Pencil size={14} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted hover:text-foreground transition-colors" aria-label="More actions">
                        <ChevronDown size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-status-cancelled focus:text-status-cancelled"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              {status === 'SENT' && (
                <>
                  <button
                    type="button"
                    onClick={onPreview}
                    className="text-muted hover:text-foreground transition-colors"
                    aria-label="Preview contract"
                  >
                    <Eye size={14} />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted hover:text-foreground transition-colors" aria-label="More actions">
                        <ChevronDown size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onVoid(false)}
                        className="text-status-cancelled focus:text-status-cancelled"
                      >
                        Void contract
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
              {status === 'SIGNED' && (
                <>
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
                      aria-label="Download signed contract PDF"
                    >
                      <Download size={14} />
                    </a>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-muted hover:text-foreground transition-colors" aria-label="More actions">
                        <ChevronDown size={14} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setConfirmVoidOpen(true)}
                        className="text-status-cancelled focus:text-status-cancelled"
                      >
                        Void contract
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
      {confirmVoidOpen && (
        <Dialog open onOpenChange={() => setConfirmVoidOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Void signed contract?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted">
              This contract has been signed by the client. Voiding it will require them to sign a new contract.
            </p>
            <div className="flex gap-2 justify-end mt-2">
              <Button variant="outline" onClick={() => setConfirmVoidOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => { onVoid(true); setConfirmVoidOpen(false); }}
              >
                Void contract
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
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
  onVoid,
}: {
  invoice: Invoice;
  pdfUrl: string | null;
  onEdit: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
  onSend: (invoice: Invoice) => void;
  onMarkSent: (invoice: Invoice) => void;
  onMarkPaid: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}) {
  const overdue =
    invoice.status === 'SENT' &&
    !!invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();
  const total = invoiceLineTotal(invoice);
  const isDraft = invoice.status === 'DRAFT';
  const isSent = invoice.status === 'SENT';
  const isPaid = invoice.status === 'PAID';
  const isVoid = invoice.status === 'VOID';

  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border last:border-0">
      <div className="min-w-0">
        <p className={cn('text-sm', isVoid ? 'text-muted line-through' : 'text-foreground')}>
          {invoice.isDeposit ? 'Deposit' : 'Balance'}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {invoice.issueDate ? formatDate(invoice.issueDate) : '—'}
          {invoice.dueDate && ` · due ${formatDate(invoice.dueDate)}`}
          {isPaid && invoice.paidAt && ` · paid ${formatDate(invoice.paidAt)}`}
        </p>
        <div className="mt-1">
          <InvoiceStatusPill status={invoice.status} isOverdue={overdue} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={cn('text-sm font-medium tabular-nums', isVoid ? 'text-muted' : 'text-foreground')}>
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
        {(isSent || isPaid) && (
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
              <DropdownMenuItem
                onClick={() => onVoid(invoice)}
                className="text-status-cancelled focus:text-status-cancelled"
              >
                Void invoice
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
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

// ─── Add checklist item form ──────────────────────────────────────────────────

function AddChecklistItemForm({ bookingId, onDone }: { bookingId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState('');
  const [stage, setStage] = useState('NONE');
  const [dueDate, setDueDate] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiPost(`/bookings/${bookingId}/checklist`, {
        label: label.trim(),
        requiredForStatus: stage === 'NONE' ? null : stage,
        dueDate: dueDate || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      onDone();
    },
    onError: () => toast({ title: 'Failed to add item', variant: 'destructive' }),
  });

  return (
    <div className="mb-4 p-3 bg-surface border border-border rounded-md space-y-2.5">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Item label"
        className="text-sm"
        autoFocus
      />
      <div className="space-y-1">
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="text-sm h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">No stage requirement</SelectItem>
            <SelectItem value="PROVISIONAL">Required for Provisional</SelectItem>
            <SelectItem value="CONFIRMED">Required for Confirmed</SelectItem>
            <SelectItem value="READY">Required for Ready</SelectItem>
            <SelectItem value="COMPLETE">Required for Complete</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted">Must be complete before advancing to this stage</p>
      </div>
      <Input
        type="date"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
        className="text-sm h-8"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => mutation.mutate()}
          disabled={!label.trim() || mutation.isPending}
        >
          {mutation.isPending ? 'Adding…' : 'Add'}
        </Button>
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
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
  const location = useLocation();
  const backNav = (location.state as { from?: string; label?: string } | null);
  const [, setSearchParams] = useSearchParams();

  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTemplateType, setComposeTemplateType] = useState<string | undefined>();
  const [invoiceSheetOpen, setInvoiceSheetOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | undefined>();
  const [invoiceSheetPrefill, setInvoiceSheetPrefill] = useState<{ isDeposit: boolean; amount?: number; description?: string } | undefined>();
  const [markSentInvoice, setMarkSentInvoice] = useState<Invoice | undefined>();
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contractSheetOpen, setContractSheetOpen] = useState(false);
  const [contractSheetReadOnly, setContractSheetReadOnly] = useState(false);
  const [pendingContract, setPendingContract] = useState<Contract | null>(null);
  const [showAllChecklist, setShowAllChecklist] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

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

  const { data: checklist = [], isPending: checklistLoading } = useQuery({
    queryKey: ['bookingChecklist', id],
    queryFn: () => apiGet<ChecklistItem[]>(`/bookings/${id}/checklist`),
    enabled: isLoaded && !!booking && booking.status !== 'CANCELLED',
  });

  const createContract = useMutation({
    mutationFn: () => apiPost<Contract>(`/bookings/${id}/contracts`, {}),
    onSuccess: (data) => {
      setPendingContract(data);
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setContractSheetReadOnly(false);
      setContractSheetOpen(true);
    },
    onError: () => toast({ title: 'Failed to create contract', variant: 'destructive' }),
  });

  const sendContractMutation = useMutation({
    mutationFn: (contractId: string) => apiPostVoid(`/bookings/${id}/contracts/${contractId}/send`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
    onError: () => toast({ title: 'Failed to mark contract as sent', variant: 'destructive' }),
  });

  const voidContractMutation = useMutation({
    mutationFn: ({ contractId, confirmSignedVoid }: { contractId: string; confirmSignedVoid: boolean }) =>
      apiPostVoid(`/bookings/${id}/contracts/${contractId}/void`, { confirmSignedVoid }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
    onError: () => toast({ title: 'Failed to void contract', variant: 'destructive' }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (contractId: string) => apiDelete(`/bookings/${id}/contracts/${contractId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
    onError: () => toast({ title: 'Failed to delete contract', variant: 'destructive' }),
  });

  const voidInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => apiPostVoid(`/bookings/${id}/invoices/${invoiceId}/void`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
    },
    onError: () => toast({ title: 'Failed to void invoice', variant: 'destructive' }),
  });

  const markPaid = useMutation({
    mutationFn: (invoiceId: string) => apiPost(`/bookings/${id}/invoices/${invoiceId}/mark-paid`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
    onError: () => toast({ title: 'Failed to mark invoice as paid', variant: 'destructive' }),
  });

  const toggleChecklistItem = useMutation({
    mutationFn: ({ itemId, state }: { itemId: string; state: 'COMPLETE' | 'PENDING' }) =>
      apiPatch(`/bookings/${id}/checklist/${itemId}`, { state }),
    onMutate: async ({ itemId, state }) => {
      await queryClient.cancelQueries({ queryKey: ['bookingChecklist', id] });
      const previous = queryClient.getQueryData<ChecklistItem[]>(['bookingChecklist', id]);
      queryClient.setQueryData<ChecklistItem[]>(['bookingChecklist', id], (old) =>
        old?.map((item) => item.id === itemId ? { ...item, state } : item) ?? [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['bookingChecklist', id], context.previous);
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', id] });
    },
  });

  function openCompose(templateType?: string) {
    setComposeTemplateType(templateType);
    setComposeOpen(true);
  }

  function buildSetsDescription(): string {
    if (!booking?.sets?.length) return '';
    const formatById = new Map(
      (booking.performanceFormats ?? []).map((f) => [f.performanceFormatId, f.performanceFormat.label]),
    );
    return booking.sets
      .map((s) => {
        const label = s.label ?? (s.performanceFormatId ? formatById.get(s.performanceFormatId) : null) ?? null;
        return label ? `${label} (${s.duration} min)` : `${s.duration} min`;
      })
      .join(', ');
  }

  function openCreateInvoice(prefill?: { isDeposit: boolean; amount?: number }) {
    setEditingInvoice(undefined);
    setInvoiceSheetPrefill(prefill ? { ...prefill, description: buildSetsDescription() } : undefined);
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

  function handleChecklistAction(action: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract') {
    if (action === 'create_contract') {
      createContract.mutate();
      return;
    }
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
  const feeWithVat = userProfile?.vatNumber && booking.fee
    ? `${fee} (${formatCurrency(parseFloat(booking.fee) * (1 + (userProfile.vatRate ?? 20) / 100))} inc. VAT)`
    : fee;
  // Use combined contract+deposit template when the deposit_received checklist item exists
  const hasDepositItem = checklist.some((item) => item.key === 'deposit_received');
  const contractShortcutType = hasDepositItem ? 'contract_and_deposit_cover' : 'contract_cover';

  const CHECKLIST_SHORTCUTS: Record<string, {
    shortcutTemplateType?: string;
    shortcutAction?: 'create_deposit_invoice' | 'create_balance_invoice' | 'create_contract';
    shortcutMarkDone?: 'mark_contract_signed' | 'mark_deposit_received';
  }> = {
    send_quote: { shortcutTemplateType: 'quote' },
    create_contract: { shortcutAction: 'create_contract' },
    create_deposit_invoice: { shortcutAction: 'create_deposit_invoice' },
    send_contract: { shortcutTemplateType: contractShortcutType },
    contract_signed: { shortcutMarkDone: 'mark_contract_signed' },
    deposit_received: { shortcutMarkDone: 'mark_deposit_received' },
    create_balance_invoice: { shortcutAction: 'create_balance_invoice' },
    music_form_invite: { shortcutTemplateType: 'music_form_invite' },
    send_thank_you: { shortcutTemplateType: 'thank_you' },
  };

  const backState = { from: `/admin/bookings/${id}`, label: title };

  function renderChecklistItem(item: ChecklistItem) {
    const isDone = item.state === 'COMPLETE';
    const isFailed = item.state === 'FAILED';
    const isBlocked = item.state === 'BLOCKED';
    const isPlayTheGig = item.key === 'play_the_gig';
    const shortcuts = item.key ? (CHECKLIST_SHORTCUTS[item.key] ?? {}) : {};
    const due = dueDateDisplay(item.dueDate);
    return (
      <div key={item.id} className={cn('flex items-center justify-between gap-2.5 py-1.5', isBlocked && 'opacity-40')}>
        <div className="flex items-center gap-2.5 min-w-0">
          {isDone ? (
            <button
              onClick={() => toggleChecklistItem.mutate({ itemId: item.id, state: 'PENDING' })}
              className={cn('flex-shrink-0 transition-colors', isPlayTheGig ? 'text-status-ready hover:text-status-ready/70' : 'text-status-confirmed hover:text-status-confirmed/70')}
              aria-label="Mark as incomplete"
            >
              {isPlayTheGig ? <Sparkles size={16} /> : <CheckCircle2 size={16} />}
            </button>
          ) : isFailed ? (
            <button
              onClick={() => toggleChecklistItem.mutate({ itemId: item.id, state: 'PENDING' })}
              className="flex-shrink-0 text-status-cancelled hover:text-status-cancelled/70 transition-colors"
              aria-label="Retry"
            >
              <AlertTriangle size={16} />
            </button>
          ) : isBlocked ? (
            <Lock size={16} className="flex-shrink-0 text-muted" />
          ) : (
            <button
              onClick={() => {
                if (isPlayTheGig) {
                  confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
                }
                toggleChecklistItem.mutate({ itemId: item.id, state: 'COMPLETE' });
              }}
              className={cn('flex-shrink-0 transition-colors', isPlayTheGig ? 'text-muted hover:text-status-ready' : 'text-muted hover:text-status-confirmed')}
              aria-label="Mark as complete"
            >
              {isPlayTheGig ? <Sparkles size={16} /> : <Circle size={16} />}
            </button>
          )}
          <div className="min-w-0">
            <span className={cn('text-sm', isDone ? 'text-muted line-through' : isFailed ? 'text-status-cancelled' : 'text-foreground')}>
              {item.label}
            </span>
            {due && !isDone && !isBlocked && (
              <p className={cn('text-xs', due.className)}>{due.text}</p>
            )}
          </div>
        </div>
        {!isDone && !isBlocked && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {shortcuts.shortcutTemplateType && (
              <button onClick={() => openCompose(shortcuts.shortcutTemplateType)} className="text-xs text-primary hover:underline">
                {isFailed ? 'Retry' : 'Send'}
              </button>
            )}
            {shortcuts.shortcutAction && (
              <button onClick={() => handleChecklistAction(shortcuts.shortcutAction!)} className="text-xs text-primary hover:underline">
                {isFailed ? 'Retry' : 'Create'}
              </button>
            )}
            {shortcuts.shortcutMarkDone && (
              <button
                onClick={() => {
                  if (shortcuts.shortcutMarkDone === 'mark_contract_signed') {
                    if (booking?.activeContract) actions.markContractSigned(booking.activeContract.id);
                  } else {
                    const sentDeposit = invoices.find((inv) => inv.isDeposit && inv.status === 'SENT');
                    if (sentDeposit) markPaid.mutate(sentDeposit.id);
                    else actions.markDepositReceived();
                  }
                }}
                disabled={actions.isPending || markPaid.isPending}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {isFailed ? 'Retry' : 'Mark done'}
              </button>
            )}
            {!shortcuts.shortcutTemplateType && !shortcuts.shortcutAction && !shortcuts.shortcutMarkDone && !isPlayTheGig && (
              <button
                onClick={() => toggleChecklistItem.mutate({ itemId: item.id, state: 'COMPLETE' })}
                className="text-xs text-primary hover:underline"
              >
                Mark done
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-6 max-w-7xl mx-auto">

      {/* Back */}
      <Link
        to={backNav?.from ?? '/admin/bookings'}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} />
        {backNav?.label ?? 'Bookings'}
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
                  href={`/booking/${booking.portalToken}?preview=admin&from=${encodeURIComponent(`/admin/bookings/${booking.id}`)}`}
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
              <StatusDropdown booking={booking} checklist={checklist} />
              <span className="text-sm text-muted">{formatDate(booking.date)}</span>
              {feeWithVat && <span className="text-sm text-muted">{feeWithVat}</span>}
            </div>
          </section>

          {/* 2. People */}
          <section>
            <SectionHeader label="People" />
            <div className="border-t border-border">
              <PersonCard role="Customer" contact={booking.customer} linkState={backState} onEdit={() => setEditingContact(booking.customer)} />
              {booking.bookingAgent && (
                <PersonCard
                  role="Booking agent"
                  contact={booking.bookingAgent}
                  commissionArrangement={booking.bookingAgent.commissionArrangement}
                  linkState={backState}
                  onEdit={() => setEditingContact(booking.bookingAgent!)}
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
        <div className="mt-8 md:mt-0 space-y-6">

          {/* Checklist */}
          {booking.status !== 'CANCELLED' && checklistLoading && (
            <section>
              <div className="h-4 w-20 bg-border rounded animate-pulse mb-3" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2.5 animate-pulse">
                    <div className="w-4 h-4 bg-border rounded-full flex-shrink-0" />
                    <div className="h-3 bg-border rounded flex-1" />
                  </div>
                ))}
              </div>
            </section>
          )}
          {booking.status !== 'CANCELLED' && !checklistLoading && (() => {
            // Expanded view includes BLOCKED items; default view hides them
            const baseList = showAllChecklist ? checklist : checklist.filter((i) => i.state !== 'BLOCKED');
            if (baseList.length === 0 && !showAddItem) return null;

            const STAGE_LIST = ['ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const;
            const bookingIdx = STAGE_LIST.indexOf(booking.status as typeof STAGE_LIST[number]);
            const defaultStageSet = new Set<string | null>([null]);
            if (bookingIdx >= 0) defaultStageSet.add(STAGE_LIST[bookingIdx]!);
            if (bookingIdx >= 0 && bookingIdx + 1 < STAGE_LIST.length) defaultStageSet.add(STAGE_LIST[bookingIdx + 1]!);

            const filtered = showAllChecklist
              ? baseList
              : baseList.filter((i) => defaultStageSet.has(i.requiredForStatus));
            const hiddenCount = baseList.length - filtered.length;

            const STAGE_DISPLAY_ORDER = ['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'];
            const itemsByStage = new Map<string | null, ChecklistItem[]>();
            for (const item of filtered) {
              const k = item.requiredForStatus ?? null;
              if (!itemsByStage.has(k)) itemsByStage.set(k, []);
              itemsByStage.get(k)!.push(item);
            }

            return (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Checklist</h2>
                  <button
                    type="button"
                    onClick={() => setShowAddItem((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus size={12} />
                    Add item
                  </button>
                </div>

                {showAddItem && (
                  <AddChecklistItemForm bookingId={booking.id} onDone={() => setShowAddItem(false)} />
                )}

                {/* Null-stage items (no divider) */}
                {(itemsByStage.get(null) ?? []).map((item) => renderChecklistItem(item))}

                {/* Stage-grouped items: items first, then the stage divider below */}
                {STAGE_DISPLAY_ORDER.map((stage) => {
                  const stageItems = itemsByStage.get(stage) ?? [];
                  if (!stageItems.length) return null;
                  return (
                    <div key={stage}>
                      {stageItems.map((item) => renderChecklistItem(item))}
                      <div className="flex items-center gap-2 my-2">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>
                    </div>
                  );
                })}

                <div className="mt-1 space-y-1.5">
                  {hiddenCount > 0 && !showAllChecklist && (
                    <button
                      onClick={() => setShowAllChecklist(true)}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Show all
                    </button>
                  )}
                  {showAllChecklist && checklist.length > 0 && (
                    <button
                      onClick={() => setShowAllChecklist(false)}
                      className="text-xs text-muted hover:text-foreground transition-colors"
                    >
                      Show fewer
                    </button>
                  )}

                  {(['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const)
                    .filter((targetStatus) => {
                      const targetIdx = STATUS_ORDER.indexOf(targetStatus);
                      const currentIdx = STATUS_ORDER.indexOf(booking.status);
                      if (targetIdx <= currentIdx) return false;
                      const forStatus = checklist.filter((i) => i.requiredForStatus === targetStatus);
                      return forStatus.length > 0 && forStatus.every((i) => i.state === 'COMPLETE');
                    })
                    .map((targetStatus) => (
                      <div key={targetStatus} className="flex items-center gap-2 text-xs text-status-confirmed">
                        <CheckCircle2 size={13} />
                        <span>Ready to mark as <span className="font-medium">{STATUS_LABELS[targetStatus]}</span>?</span>
                      </div>
                    ))}
                </div>
              </section>
            );
          })()}

          {/* Contract */}
          {booking.status !== 'CANCELLED' && (
            <ContractCard
              booking={booking}
              documents={documents}
              isCreating={createContract.isPending}
              onCreateContract={() => createContract.mutate()}
              onEdit={() => { setContractSheetReadOnly(false); setContractSheetOpen(true); }}
              onPreview={() => { setContractSheetReadOnly(true); setContractSheetOpen(true); }}
              onSend={() => openCompose(contractShortcutType)}
              onVoid={(confirmSignedVoid) => {
                const contractId = booking.activeContract?.id;
                if (contractId) voidContractMutation.mutate({ contractId, confirmSignedVoid });
              }}
              onDelete={() => {
                const contractId = booking.activeContract?.id;
                if (contractId) deleteContractMutation.mutate(contractId);
              }}
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
                    onVoid={(inv) => voidInvoiceMutation.mutate(inv.id)}
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
                  const isVoidContract = doc.type === 'CONTRACT' && doc.contractStatus === 'VOID';
                  const label = doc.type === 'CONTRACT'
                    ? isVoidContract ? 'Contract [VOID]' : 'Contract'
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
        contract={pendingContract ?? booking.activeContract}
        readOnly={contractSheetReadOnly}
        open={contractSheetOpen}
        onClose={() => { setContractSheetOpen(false); setPendingContract(null); }}
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
        onAfterSend={(templateType) => {
          const isContractEmail = templateType === 'contract_cover' || templateType === 'contract_and_deposit_cover';
          const contractId = booking.activeContract?.id;
          if (isContractEmail && contractId && booking.activeContract?.status === 'DRAFT') {
            sendContractMutation.mutate(contractId);
          }
        }}
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
