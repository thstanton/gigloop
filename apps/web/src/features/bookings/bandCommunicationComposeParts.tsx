import type { ReactNode, RefObject } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmailSendReadiness {
  recipientReady: boolean;
  templateReady: boolean;
  contentValid: boolean;
  rendered: boolean;
  templatesIdle: boolean;
  renderIdle: boolean;
  emailIdle: boolean;
  manualActionIdle: boolean;
}

interface MessageCopyReadiness {
  templateReady: boolean;
  rendered: boolean;
  templatesIdle: boolean;
  copyIdle: boolean;
  markSentIdle: boolean;
  emailIdle: boolean;
}

export function canSendBandEmail(readiness: EmailSendReadiness): boolean {
  return Object.values(readiness).every(Boolean);
}

export function canCopyBandMessage(readiness: MessageCopyReadiness): boolean {
  return Object.values(readiness).every(Boolean);
}

export function composeTemplateLabel(isLoading: boolean, name: string | undefined, unavailable: string): string {
  if (isLoading) return 'Loading…';
  return name ?? unavailable;
}

interface MessagePreviewOptions {
  isFetching: boolean;
  body?: string;
  isError: boolean;
  errorMessage: string;
  unavailableMessage: string;
}

export function bandMessagePreview(options: MessagePreviewOptions): ReactNode {
  if (options.isFetching) return <div className="min-h-16 animate-pulse rounded bg-accent" />;
  if (options.body !== undefined) {
    return (
      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-background px-3 py-2 text-base font-sans">
        {options.body}
      </pre>
    );
  }
  if (options.isError) {
    return <p className="text-base text-status-cancelled" role="alert">{options.errorMessage}</p>;
  }
  return <p className="text-base text-muted">{options.unavailableMessage}</p>;
}

export function missingBandDetailsNotice(message: string): ReactNode {
  return (
    <div className="flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-base text-amber-800">
      <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}

export function bandEditorContent(isLoading: boolean, content: ReactNode): ReactNode {
  if (isLoading) return <div className="min-h-40 animate-pulse rounded bg-accent" />;
  return content;
}

interface ClipboardFallbackOptions {
  text: string;
  id: string;
  ariaLabel: string;
  ref: RefObject<HTMLTextAreaElement | null>;
  isSaving: boolean;
  onSelect: () => void;
  onMarkSent: () => void;
}

export function bandClipboardFallback(options: ClipboardFallbackOptions): ReactNode {
  return (
    <div className="space-y-2" role="alert">
      <label htmlFor={options.id} className="text-base text-status-cancelled">
        Select and copy this message manually:
      </label>
      <textarea
        ref={options.ref}
        id={options.id}
        aria-label={options.ariaLabel}
        readOnly
        rows={4}
        value={options.text}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-base"
      />
      <div className="flex gap-3">
        <Button variant="outline" onClick={options.onSelect}>Select message</Button>
        <Button variant="outline" onClick={options.onMarkSent} disabled={options.isSaving}>
          {options.isSaving ? 'Saving…' : 'Mark as sent'}
        </Button>
      </div>
    </div>
  );
}
