import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import type { BookingSearchResult, ContactSearchResult, SearchResult } from '@/types/api';
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { SearchResultRow } from '@/components/common/SearchResultRow';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Controlled query text — the caller owns it so it can drive the (debounced) search (SLICE4). */
  query: string;
  onQueryChange: (query: string) => void;
  /** Already server-ranked results (bookings then contacts). Grouped for display here; no fetching. */
  results: SearchResult[];
  isLoading?: boolean;
  /** Fired when a result is chosen. The palette does not navigate or close itself — the caller does. */
  onSelectResult: (result: SearchResult) => void;
  className?: string;
}

const isBooking = (r: SearchResult): r is BookingSearchResult => r.type === 'booking';
const isContact = (r: SearchResult): r is ContactSearchResult => r.type === 'contact';

function ResultItem({
  result,
  onSelectResult,
}: {
  result: SearchResult;
  onSelectResult: (result: SearchResult) => void;
}) {
  return (
    <Command.Item
      value={`${result.type}:${result.id}`}
      onSelect={() => onSelectResult(result)}
      className="min-h-[44px] cursor-pointer rounded-md data-[selected=true]:bg-accent"
    >
      <SearchResultRow result={result} />
    </Command.Item>
  );
}

/**
 * The command-palette shell (ADR-0067 §7). One `@radix-ui/react-dialog` instance with `cmdk`'s
 * `Command` inside, switched purely by CSS at `md`: a **full-height, top-anchored sheet on mobile**
 * (input pinned at the top, results scrolling below — never a bottom sheet the keyboard would bury)
 * and a **floated panel near the top on desktop**. Radix supplies the focus trap, scroll lock and
 * Escape-to-close; cmdk supplies combobox a11y and arrow/Enter navigation. Server results are fed in
 * with `shouldFilter={false}` (already ranked upstream). Purely presentational — no data fetching.
 */
export function CommandPalette({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  isLoading = false,
  onSelectResult,
  className,
}: CommandPaletteProps) {
  const bookings = results.filter(isBooking);
  const contacts = results.filter(isContact);
  const hasQuery = query.trim().length > 0;

  function renderBody() {
    if (isLoading) {
      return <p className="px-3 py-6 text-center text-sm text-muted">Searching…</p>;
    }
    if (!hasQuery) {
      // Recent-viewed lands here in a later slice; for now, a plain prompt.
      return (
        <p className="px-3 py-6 text-center text-sm text-muted">
          Type to search bookings and contacts.
        </p>
      );
    }
    if (results.length === 0) {
      return (
        <p className="px-3 py-6 text-center text-sm text-muted">
          No results for “{query.trim()}”.
        </p>
      );
    }
    return (
      <>
        {bookings.length > 0 && (
          <Command.Group heading="Bookings">
            {bookings.map((result) => (
              <ResultItem key={result.id} result={result} onSelectResult={onSelectResult} />
            ))}
          </Command.Group>
        )}
        {contacts.length > 0 && (
          <Command.Group heading="Contacts">
            {contacts.map((result) => (
              <ResultItem key={result.id} result={result} onSelectResult={onSelectResult} />
            ))}
          </Command.Group>
        )}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          aria-label="Search"
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-background',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'motion-reduce:animate-none motion-reduce:transition-none',
            // Mobile (base): full-height, top-anchored sheet.
            'inset-0 data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top',
            // Desktop (md+): a floated panel near the top, overriding the full-screen position.
            'md:inset-x-0 md:bottom-auto md:top-[10vh] md:mx-auto md:h-auto md:max-h-[70vh] md:w-full md:max-w-xl md:rounded-lg md:border md:border-border md:shadow-lg',
            className,
          )}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search your bookings and contacts.
          </DialogPrimitive.Description>

          <Command
            label="Search bookings and contacts"
            shouldFilter={false}
            loop
            className={cn(
              'flex min-h-0 flex-1 flex-col',
              '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3',
              '[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium',
              '[&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted',
            )}
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-border px-3">
              <Search size={18} className="shrink-0 text-muted" aria-hidden />
              <Command.Input
                value={query}
                onValueChange={onQueryChange}
                autoFocus
                placeholder="Search bookings and contacts…"
                className="h-12 w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="shrink-0 rounded-md px-2 py-1 text-sm text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              >
                Cancel
              </button>
            </div>

            <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
              {renderBody()}
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
