import { useState } from 'react';
import { AlertTriangle, FileText, Mail } from 'lucide-react';
import { GhostButton } from '@/components/common/GhostButton';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { formatDate } from '@/lib/formatters';
import type { Communication } from '@/types/api';

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

function EmailPreviewSheet({ comm, open, onClose }: Readonly<{ comm: Communication; open: boolean; onClose: () => void }>) {
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

function CommunicationRow({ comm }: Readonly<{ comm: Communication }>) {
  const [open, setOpen] = useState(false);
  const isFailed = comm.status === 'FAILED';
  const isPending = comm.status === 'PENDING';
  const isSent = comm.status === 'SENT';
  const meta = [comm.template?.name, `To ${comm.contact.name}`].filter(Boolean).join(' · ');
  const statusPrefix = getStatusPrefix(isFailed, isPending);
  const rowContent = (
    <>
      <div className="min-w-0 flex items-start gap-2">
        {isFailed && <AlertTriangle size={14} className="text-status-cancelled flex-shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className={`text-sm truncate ${isFailed ? 'text-status-cancelled' : 'text-foreground'}`}>
            {comm.subject}
          </p>
          <p className="text-xs text-muted mt-0.5">{statusPrefix}{meta}</p>
        </div>
      </div>
      <span className="text-xs text-muted flex-shrink-0">
        {comm.sentAt ? formatDate(comm.sentAt) : '—'}
      </span>
    </>
  );

  if (isSent) {
    return (
      <>
        <button
          type="button"
          className="w-full text-left flex items-start justify-between gap-3 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 -mx-4 px-4 rounded transition-colors"
          onClick={() => setOpen(true)}
          aria-label={`View email: ${comm.subject}`}
        >
          {rowContent}
        </button>
        <EmailPreviewSheet comm={comm} open={open} onClose={() => setOpen(false)} />
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
  onCompose: () => void;
}

export default function CommunicationsSection({ communications, onCompose }: Readonly<CommunicationsSectionProps>) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Communications</h2>
        <GhostButton onClick={onCompose} variant="primary" size="xs" icon={<Mail size={12} />}>
          Send email
        </GhostButton>
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
  );
}
