import { useState, useRef, useId, useMemo, type ReactNode } from 'react';
import { Search, X, ChevronDown, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ContactForm, { toContactPayload } from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import { useContacts } from '@/lib/hooks/useContacts';
import { useRoleVocabulary } from '@/lib/hooks/useRoleVocabulary';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';
import type { ContactPrimaryRole } from '@/lib/constants';
import { cn } from '@/lib/utils';

// The combobox machinery shared by the two contact pickers: the trigger, the searchable listbox with
// keyboard navigation, and the inline "create new" sheet. It knows nothing about *which* contacts
// belong in the list or how an option reads — `ContactPicker` (any contact, types deliberately
// blurred: a customer can also be an agent or a venue) and `PlayerPicker` (filling a part, players
// only) each supply that through `arrange` and `renderOption`.

/** What the create sheet opens with. `title` replaces the default "New {label}". */
export interface CreateRequest {
  title?: string;
  name?: string;
  greetingName?: string;
  email?: string;
  /** Merged into the POST body — how the player picker marks the account-owner contact. */
  extraPayload?: Record<string, unknown>;
  /** Called with a failed create's error; the picker's recovery hook (e.g. the self 409). */
  onError?: (err: unknown, ctx: ComboboxContext) => void;
}

/** Handed to `topSlot` and `onError` so a picker can act on the list without owning its state. */
export interface ComboboxContext {
  contacts: Contact[];
  select: (contact: Contact) => void;
  startCreate: (request?: CreateRequest) => void;
}

interface ContactComboboxProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  disableCreate?: boolean;
  /** The contact type preselected when creating inline. */
  createRole?: ContactPrimaryRole;
  /** Placeholder of the search box. Default: "Search or create new {label}". */
  searchPlaceholder?: string;
  /** Title of the create sheet when created from the search term. Default: "New {label}". */
  createTitle?: string;
  /**
   * Narrows and orders the name-matched contacts. MUST be referentially stable (`useCallback`):
   * every vacant part on a booking mounts its own picker, and the result is memoised on it so
   * unrelated re-renders don't re-sort the whole contact list (#886).
   */
  arrange: (contacts: Contact[]) => Contact[];
  /** The body of one option. Default: the name, then "email · phone". */
  renderOption?: (contact: Contact, selected: boolean) => ReactNode;
  /** A row above the list (e.g. "Add yourself"). */
  topSlot?: (ctx: ComboboxContext) => ReactNode;
}

function DefaultOption({ contact, selected }: { contact: Contact; selected: boolean }) {
  return (
    <>
      <p className={cn('text-sm truncate', selected ? 'font-medium text-primary' : 'text-foreground')}>
        {contact.name}
      </p>
      {(contact.email || contact.phone) && (
        <p className="text-xs text-muted truncate mt-0.5">
          {[contact.email, contact.phone].filter(Boolean).join(' · ')}
        </p>
      )}
    </>
  );
}

export default function ContactCombobox({
  value,
  onChange,
  placeholder = 'Select contact...',
  label = 'contact',
  disabled = false,
  disableCreate = false,
  createRole,
  searchPlaceholder,
  createTitle,
  arrange,
  renderOption,
  topSlot,
}: ContactComboboxProps) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<CreateRequest | null>(null);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [] } = useContacts();
  const roleVocabulary = useRoleVocabulary();
  const queryClient = useQueryClient();

  const selected = contacts.find((c) => c.id === value) ?? null;

  const filtered = useMemo(() => {
    const searched = search
      ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : contacts;
    return arrange(searched);
  }, [contacts, search, arrange]);

  const hasExactMatch = contacts.some((c) => c.name.toLowerCase() === search.toLowerCase());

  // Options includes the create option when present (unless disabled)
  const totalOptions = filtered.length + (search && !hasExactMatch && !disableCreate ? 1 : 0);

  function closeCreateSheet() {
    setRequest(null);
  }

  function selectContact(contact: Contact) {
    onChange(contact.id);
    closeCreateSheet();
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }

  const ctx: ComboboxContext = {
    contacts,
    select: selectContact,
    startCreate: (next = {}) => {
      setOpen(false);
      setSearch('');
      setRequest(next);
    },
  };

  const createMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPost<Contact>('/contacts', { ...toContactPayload(values), ...request?.extraPayload }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      closeCreateSheet();
      setOpen(false);
      setSearch('');
    },
    onError: (err) => request?.onError?.(err, ctx),
  });

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  function handleCreateClick() {
    ctx.startCreate({ name: search, greetingName: search.trim().split(/\s+/)[0] ?? '' });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % totalOptions);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + totalOptions) % totalOptions);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        selectContact(filtered[activeIndex]);
      } else if (activeIndex === filtered.length && search && !hasExactMatch) {
        handleCreateClick();
      }
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      setOpen(false);
      setSearch('');
    }
  }

  return (
    <>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setSearch(''); setActiveIndex(-1); } }}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-label={selected ? `${placeholder}: ${selected.name}` : placeholder}
            disabled={disabled}
            className={cn(
              'w-full flex items-center justify-between rounded-md border border-border bg-background px-3 h-10 text-sm transition-colors',
              'hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <span className={cn('truncate', selected ? 'text-foreground' : 'text-muted')}>
              {selected ? selected.name : placeholder}
            </span>
            {selected ? (
              <X
                size={14}
                aria-hidden="true"
                className="text-muted flex-shrink-0 ml-2 hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            ) : (
              <ChevronDown size={14} aria-hidden="true" className="text-muted flex-shrink-0 ml-2" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          style={{ width: 'var(--radix-popover-trigger-width)' }}
          className="p-0"
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <Search size={14} aria-hidden="true" className="text-muted flex-shrink-0" />
            <input
              autoFocus
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1); }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder ?? `Search or create new ${label}`}
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted"
            />
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-label={placeholder}
            ref={listRef}
            className="max-h-52 overflow-y-auto"
          >
            {topSlot?.(ctx)}
            {filtered.length === 0 && !search && (
              <p className="text-sm text-muted px-3 py-4 text-center">No contacts yet</p>
            )}
            {filtered.length === 0 && search && !hasExactMatch && (
              <p className="text-sm text-muted px-3 py-3">No matches</p>
            )}
            {filtered.map((contact, idx) => {
              const isSelected = contact.id === value;
              return (
                <button
                  key={contact.id}
                  id={`${listboxId}-option-${idx}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => selectContact(contact)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors',
                    isSelected && 'bg-accent',
                    activeIndex === idx && 'bg-accent',
                  )}
                >
                  {renderOption ? renderOption(contact, isSelected) : <DefaultOption contact={contact} selected={isSelected} />}
                </button>
              );
            })}
            {search && !hasExactMatch && !disableCreate && (
              <button
                id={`${listboxId}-option-${filtered.length}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={handleCreateClick}
                className={cn(
                  'w-full text-left px-3 py-2.5 flex items-center gap-2 text-primary hover:bg-accent transition-colors border-t border-border',
                  activeIndex === filtered.length && 'bg-accent',
                )}
              >
                <Plus size={14} aria-hidden="true" className="flex-shrink-0" />
                <span className="text-sm">Create "{search}"</span>
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {!disableCreate && (
        <Sheet
          open={request !== null}
          onOpenChange={(next) => { if (!next) closeCreateSheet(); }}
        >
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{request?.title ?? createTitle ?? `New ${label}`}</SheetTitle>
            </SheetHeader>
            <ContactForm
              defaultValues={{
                name: request?.name ?? '',
                greetingName: request?.greetingName ?? '',
                email: request?.email ?? '',
                phone: '', website: '',
                addressLine1: '', addressLine2: '', city: '', county: '',
                postcode: '', country: 'GB', latitude: null, longitude: null, placeId: null,
                notes: '', parkingInfo: '',
                accessInfo: '', equipmentAvailable: '', commissionArrangement: '', primaryRole: createRole ?? '',
                primaryBandRole: '', instruments: [], travelNotes: '', equipmentNotes: '',
                outfitNotes: '', availabilityNotes: '',
              }}
              onSubmit={(values) => createMutation.mutate(values)}
              isPending={createMutation.isPending}
              isError={createMutation.isError}
              roleVocabulary={roleVocabulary}
              submitLabel="Create"
              onCancel={closeCreateSheet}
              autoSuggestGreetingName
            />
          </SheetContent>
        </Sheet>
      )}
    </>
  );
}
