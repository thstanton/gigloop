import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, FileText, Mail, Paperclip } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import { SubLabel } from '@/components/common/SubLabel';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { resolveApiBaseUrl } from '@/lib/apiBaseUrl';
import { openDocument } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { BookingBandMember, Communication } from '@/types/api';

const API_BASE_URL = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

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

function CommunicationPreviewSheet({ comm, open, onClose }: Readonly<{ comm: Communication; open: boolean; onClose: () => void }>) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
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
          <iframe srcDoc={emailDoc(comm.body)} title={comm.subject} className="w-full h-full border-0" sandbox="allow-same-origin" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function getStatusPrefix(isFailed: boolean, isPending: boolean): string {
  if (isFailed) return 'Send failed · ';
  if (isPending) return 'Sending · ';
  return '';
}

function formatCommunicationTimestamp(timestamp: string | null, includeTime: boolean): string {
  if (!timestamp) return '—';
  if (includeTime) return formatDateTime(timestamp);
  return formatDate(timestamp);
}

function AttachmentLink({ comm, bandAttachmentsEnabled }: Readonly<{ comm: Communication; bandAttachmentsEnabled: boolean }>) {
  if (comm.channel === 'MANUAL' || !comm.document) return null;

  const isInvoice = Boolean(comm.document.invoiceId);
  if (!isInvoice && !bandAttachmentsEnabled) return null;
  const path = isInvoice
    ? `/invoices/${comm.document.invoiceId}/preview.pdf`
    : `/documents/${comm.document.id}/download`;
  const label = isInvoice ? 'Invoice PDF' : 'Call sheet PDF';
  const ariaLabel = isInvoice ? 'Download attached invoice PDF' : 'Download attached call sheet PDF';

  return (
    <a
      href={`${API_BASE_URL}${path}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        if (!isInvoice) {
          e.preventDefault();
          openDocument(path, () => toast({ title: 'Failed to open attached call sheet', variant: 'destructive' }));
        }
      }}
      aria-label={ariaLabel}
    >
      <Paperclip size={11} />
      {label}
    </a>
  );
}

function CommunicationRow({
  comm,
  showBandMetadata = false,
  bandAttachmentsEnabled,
}: Readonly<{ comm: Communication; showBandMetadata?: boolean; bandAttachmentsEnabled: boolean }>) {
  const [open, setOpen] = useState(false);
  const isFailed = comm.status === 'FAILED';
  const isPending = comm.status === 'PENDING';
  const isSent = comm.status === 'SENT';
  const timestamp = comm.sentAt ?? (showBandMetadata ? comm.createdAt : null);
  const channel = comm.channel === 'EMAIL' ? 'Email' : 'Marked as sent';
  const meta = [showBandMetadata ? channel : null, comm.template?.name, `To ${comm.contact.name}`].filter(Boolean).join(' · ');
  const statusPrefix = getStatusPrefix(isFailed, isPending);
  const rowContent = (
    <>
      <div className="min-w-0 flex items-start gap-2">
        {isFailed && <AlertTriangle size={14} className="text-status-cancelled flex-shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm truncate ${isFailed ? 'text-status-cancelled' : 'text-foreground'}`}>
              {comm.subject}
            </p>
            {/* ADR-0080: a series communication is merged into every member booking's list —
                the badge is the only thing marking it as series-level rather than this booking's own. */}
            {comm.seriesId && (
              <Badge variant="secondary" className="shrink-0" data-testid="communication-series-badge">
                Series
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted mt-0.5">{statusPrefix}{meta}</p>
          <AttachmentLink comm={comm} bandAttachmentsEnabled={bandAttachmentsEnabled} />
        </div>
      </div>
      <time dateTime={timestamp ?? undefined} className="text-xs text-muted flex-shrink-0">
        {formatCommunicationTimestamp(timestamp, showBandMetadata)}
      </time>
    </>
  );

  if (isSent) {
    return (
      <>
        <button
          type="button"
          className="w-full text-left flex items-start justify-between gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 -mx-4 px-4 rounded transition-colors"
          onClick={() => setOpen(true)}
          aria-label={`View ${comm.channel === 'EMAIL' ? 'email' : 'message'}: ${comm.subject}`}
        >
          {rowContent}
        </button>
        <CommunicationPreviewSheet comm={comm} open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
      {rowContent}
    </div>
  );
}

export interface CommunicationsSectionProps {
  communications: Communication[];
  /** The booking's non-removed members, omitted when band communications are feature-flagged off. */
  bandMembers?: BookingBandMember[];
  /** Controls band-only tab and call-sheet attachment behavior. */
  bandCommunicationsEnabled?: boolean;
}

function isBandCommunication(comm: Communication, bandContactIds: ReadonlySet<string>): boolean {
  const templateType = comm.template?.builtInType;
  return templateType ? templateType.startsWith('band_') : bandContactIds.has(comm.contactId);
}

interface MemberCommunicationGroup {
  id: string;
  name: string;
  communications: Communication[];
}

export default function CommunicationsSection({
  communications,
  bandMembers = [],
  bandCommunicationsEnabled = false,
}: Readonly<CommunicationsSectionProps>) {
  const [, setSearchParams] = useSearchParams();
  const hasBandMembers = bandCommunicationsEnabled && bandMembers.length > 0;
  const bandContactIds = new Set(bandMembers.map((member) => member.contactId));
  let clientCommunications = communications;
  const bandCommunications: Communication[] = [];
  if (hasBandMembers) {
    clientCommunications = [];
    for (const comm of communications) {
      if (isBandCommunication(comm, bandContactIds)) bandCommunications.push(comm);
      else clientCommunications.push(comm);
    }
  }

  const communicationsByContact = new Map<string, Communication[]>();
  for (const comm of bandCommunications) {
    const contactCommunications = communicationsByContact.get(comm.contactId) ?? [];
    contactCommunications.push(comm);
    communicationsByContact.set(comm.contactId, contactCommunications);
  }

  const memberGroups: MemberCommunicationGroup[] = bandMembers.map((member) => ({
    id: member.id,
    name: member.contact.name,
    communications: communicationsByContact.get(member.contactId) ?? [],
  }));
  // Keep historical band messages in the trail if their recipient has since been removed from
  // the roster. Current members stay in roster order; former members follow in latest-comm order.
  const groupedContactIds = new Set(bandMembers.map((member) => member.contactId));
  for (const comm of bandCommunications) {
    if (!groupedContactIds.has(comm.contactId)) {
      memberGroups.push({
        id: comm.contactId,
        name: comm.contact.name,
        communications: communicationsByContact.get(comm.contactId) ?? [],
      });
      groupedContactIds.add(comm.contactId);
    }
  }

  const clientContent = clientCommunications.length === 0 ? (
    <div className="flex items-center gap-2 text-muted py-1">
      <FileText size={14} />
      <span className="text-sm">No emails sent yet</span>
    </div>
  ) : (
    <div className="border-t border-border">
      {clientCommunications.map((comm) => (
        <CommunicationRow key={comm.id} comm={comm} bandAttachmentsEnabled={bandCommunicationsEnabled} />
      ))}
    </div>
  );

  const bandContent = (
    <div className="space-y-4">
      {memberGroups.map((group) => (
        <section key={group.id} aria-label={`Communications with ${group.name}`}>
          <div className="flex items-center gap-2">
            <SubLabel>{group.name}</SubLabel>
            {group.communications.length === 0 && <Badge variant="outline">No messages recorded</Badge>}
          </div>
          {group.communications.length > 0 && (
            <div className="border-t border-border">
              {group.communications.map((comm) => (
                <CommunicationRow key={comm.id} comm={comm} showBandMetadata bandAttachmentsEnabled />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Communications</h2>
        <GhostButton onClick={() => setSearchParams({ sheet: 'compose' })} variant="primary" size="xs" icon={<Mail size={12} />}>
          Send email
        </GhostButton>
      </div>
      {hasBandMembers ? (
        <Tabs defaultValue="client">
          <TabsList size="sm" className="grid w-full grid-cols-2">
            <TabsTrigger value="client" size="sm">Client</TabsTrigger>
            <TabsTrigger value="band" size="sm">Band</TabsTrigger>
          </TabsList>
          <TabsContent value="client">{clientContent}</TabsContent>
          <TabsContent value="band">{bandContent}</TabsContent>
        </Tabs>
      ) : clientContent}
    </section>
  );
}
