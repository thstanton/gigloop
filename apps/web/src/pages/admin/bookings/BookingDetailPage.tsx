import { useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, AlertTriangle, Mail, Music, FileText, DollarSign, FolderOpen, ChevronDown, Check, Pencil, Plus, Send, Download } from 'lucide-react';
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
import { useBookingInvoices } from '@/lib/hooks/useBookingInvoices';
import { useBookingCommunications } from '@/lib/hooks/useBookingCommunications';
import { useBookingDocuments } from '@/lib/hooks/useBookingDocuments';
import BookingEditDrawer from '@/features/bookings/BookingEditDrawer';
import ComposeEmailSheet from '@/features/communications/ComposeEmailSheet';
import InvoiceSheet from '@/features/invoices/InvoiceSheet';
import MarkSentDialog from '@/features/invoices/MarkSentDialog';
import { buildChecklist } from '@/lib/buildChecklist';
import { apiGet, apiPatch, apiDelete, apiPost } from '@/lib/api';
import {
  formatDate,
  formatCurrency,
  formatFee,
} from '@/lib/formatters';
import { EVENT_TYPE_LABELS, STATUS_ORDER, statusGte } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type {
  BookingDetail,
  BookingStatus,
  Contact,
  PerformanceSet,
  Invoice,
  Communication,
  Document,
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

function SetRow({ set }: { set: PerformanceSet }) {
  const parts = [set.label, formatDuration(set.duration), set.startTime].filter(Boolean);
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted w-4 flex-shrink-0 text-right">{set.order}</span>
      <span className="text-sm text-foreground">{parts.join(' · ')}</span>
    </div>
  );
}

function RunningOrderCard({ sets }: { sets: PerformanceSet[] }) {
  return (
    <Card title="Running order">
      {sets.length === 0 ? (
        <div className="flex items-center gap-2 text-muted py-1">
          <Music size={14} />
          <span className="text-sm">No sets added</span>
        </div>
      ) : (
        <div>
          {sets.map((set) => <SetRow key={set.id} set={set} />)}
        </div>
      )}
    </Card>
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
  const queryClient = useQueryClient();

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

  const autoCreateInvoiceMutation = useMutation({
    mutationFn: ({ isDeposit, amount }: { isDeposit: boolean; amount: number }) =>
      apiPost<Invoice>(`/bookings/${id}/invoices`, {
        isDeposit,
        lineItems: [{ description: isDeposit ? 'Deposit' : 'Balance', amount }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
    },
  });

  function handleInvoiceAction(action: 'create_deposit_invoice' | 'create_balance_invoice') {
    const isDeposit = action === 'create_deposit_invoice';
    const fee = booking?.fee ? parseFloat(booking.fee) : null;
    const pct = userProfile?.depositPercentage;

    if (fee && pct) {
      const amount = isDeposit ? (fee * pct) / 100 : fee * (1 - pct / 100);
      autoCreateInvoiceMutation.mutate({ isDeposit, amount: Math.round(amount * 100) / 100 });
    } else {
      openCreateInvoice({ isDeposit });
    }
  }

  const deleteInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiDelete(`/bookings/${id}/invoices/${invoiceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', id] });
    },
  });

  const contractMutation = useMutation({
    mutationFn: () =>
      apiPatch<BookingDetail>(`/bookings/${id}`, { contractSignedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
  });

  const depositMutation = useMutation({
    mutationFn: () =>
      apiPatch<BookingDetail>(`/bookings/${id}`, { depositReceivedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
    },
  });

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
          <Button
            variant="outline"
            size="sm"
            className="flex-shrink-0"
            onClick={() => setSearchParams({ edit: 'true' })}
          >
            Edit
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
          <StatusDropdown booking={booking} />
          <span className="text-sm text-muted">
            {formatDate(booking.date)}
          </span>
          {fee && <span className="text-sm text-muted">{fee}</span>}
        </div>

        {/* Lifecycle actions */}
        {booking.status !== 'CANCELLED' && (() => {
          const showContract =
            !booking.contractSignedAt &&
            booking.status !== 'ENQUIRY' &&
            !statusGte(booking.status, 'SETTLED');
          const trackDeposit = booking.depositTrackingMode !== 'NONE';
          const showDeposit =
            trackDeposit && !booking.depositReceivedAt && booking.status !== 'ENQUIRY';

          if (!showContract && !showDeposit) return null;

          return (
            <div className="flex flex-wrap gap-2 mt-3">
              {showContract && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={contractMutation.isPending}
                  onClick={() => contractMutation.mutate()}
                >
                  {contractMutation.isPending ? 'Saving…' : 'Mark contract signed'}
                </Button>
              )}
              {showDeposit && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={depositMutation.isPending}
                  onClick={() => depositMutation.mutate()}
                >
                  {depositMutation.isPending ? 'Saving…' : 'Mark deposit received'}
                </Button>
              )}
            </div>
          );
        })()}
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
                    {item.shortcutTemplateType && item.state !== 'done' && (
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
          <RunningOrderCard sets={booking.sets} />
          {booking.venue && <VenueCard venue={booking.venue} linkState={backState} />}
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
                    onDelete={(inv) => deleteInvoiceMutation.mutate(inv.id)}
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
                  const label = doc.type === 'CONTRACT'
                    ? 'Contract'
                    : invoices.find((i) => i.id === doc.invoiceId)?.isDeposit
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
                      <FileText size={14} className="flex-shrink-0 text-muted" />
                      <span className="text-sm text-foreground">{label}</span>
                      <span className="text-muted ml-auto text-xs">
                        {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <button
                        onClick={handleDownload}
                        title="Download"
                        className="text-muted hover:text-foreground"
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
