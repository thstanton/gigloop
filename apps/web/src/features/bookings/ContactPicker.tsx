import { useState, useRef, useId, useMemo } from 'react';
import { Search, X, ChevronDown, Plus, UserRound } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import ContactForm, { toContactPayload } from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import { useContacts } from '@/lib/hooks/useContacts';
import { useRoleVocabulary } from '@/lib/hooks/useRoleVocabulary';
import { ApiError, apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';
import { cn } from '@/lib/utils';
import { rankContactsForChair, type GeoPoint } from '@/lib/bandMatch';

interface ContactPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  label?: string;
  preferredRole?: string;
  /**
   * Fill-a-chair mode (#886, ADR-0072 §4): ranks contacts by soft role/instrument match against
   * this chair's free-text role, then by haversine distance to `venue` when both have
   * coordinates. Takes over from `preferredRole`'s exact-match sort when set.
   */
  chairRole?: string;
  /** The booking's venue, for chair-fill proximity ranking. Missing coordinates degrade silently. */
  venue?: GeoPoint | null;
  disabled?: boolean;
  disableCreate?: boolean;
  /**
   * Offers an "Add yourself" row above the search list (#1036, ADR-0083) — the musician filling
   * their own vacant chair without hand-rolling CRM data entry. Reuses the existing
   * `isAccountOwner: true` Contact if one exists, otherwise opens the create sheet prefilled from
   * the signed-in Clerk identity. Default `false` — only the chair-filling picker opts in.
   */
  allowSelf?: boolean;
}

export default function ContactPicker({
  value,
  onChange,
  placeholder = 'Select contact...',
  label = 'contact',
  preferredRole,
  chairRole,
  venue,
  disabled = false,
  disableCreate = false,
  allowSelf = false,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creatingSelf, setCreatingSelf] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [] } = useContacts();
  const roleVocabulary = useRoleVocabulary();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const selected = contacts.find((c) => c.id === value) ?? null;
  const selfContact = contacts.find((c) => c.isAccountOwner) ?? null;

  // Every vacant chair on a booking mounts its own ContactPicker, each ranking the full contacts
  // list independently (haversine + soft-match in rankContactsForChair) — memoized so that
  // re-renders unrelated to search/contacts/ranking inputs don't redo the sort (#886).
  const filtered = useMemo(() => {
    const searched = search
      ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : contacts;
    if (chairRole !== undefined) return rankContactsForChair(searched, chairRole, venue);
    if (!preferredRole) return searched;
    return [...searched].sort((a, b) => {
      const aMatch = a.primaryRole === preferredRole ? 0 : 1;
      const bMatch = b.primaryRole === preferredRole ? 0 : 1;
      return aMatch - bMatch;
    });
  }, [contacts, search, chairRole, venue, preferredRole]);

  const hasExactMatch = contacts.some(
    (c) => c.name.toLowerCase() === search.toLowerCase()
  );

  // Options includes the create option when present (unless disabled)
  const totalOptions = filtered.length + (search && !hasExactMatch && !disableCreate ? 1 : 0);

  function closeCreateSheet() {
    setCreateOpen(false);
    setCreatingSelf(false);
  }

  const createMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPost<Contact>('/contacts', {
        ...toContactPayload(values),
        ...(creatingSelf ? { isAccountOwner: true } : {}),
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      closeCreateSheet();
      setOpen(false);
      setSearch('');
    },
    onError: (err) => {
      // #1036 409 recovery: another tab/double-tap won the race to create the account-owner
      // Contact first. Resolve to the now-existing self-contact rather than surfacing a bare
      // error toast — the musician wanted to be assigned as themselves either way.
      if (!creatingSelf || !(err instanceof ApiError) || err.status !== 409) return;
      void queryClient.refetchQueries({ queryKey: ['contacts'], exact: true }).then(() => {
        const refreshed = queryClient.getQueryData<Contact[]>(['contacts']) ?? [];
        const existing = refreshed.find((c) => c.isAccountOwner);
        if (!existing) return;
        onChange(existing.id);
        closeCreateSheet();
        setOpen(false);
        setSearch('');
      });
    },
  });

  function handleSelect(contact: Contact) {
    onChange(contact.id);
    setOpen(false);
    setSearch('');
    setActiveIndex(-1);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  function handleCreateClick() {
    setPendingName(search);
    setCreatingSelf(false);
    setOpen(false);
    setSearch('');
    setCreateOpen(true);
  }

  function handleAddSelfClick() {
    if (selfContact) {
      handleSelect(selfContact);
      return;
    }
    setCreatingSelf(true);
    setOpen(false);
    setSearch('');
    setCreateOpen(true);
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
        handleSelect(filtered[activeIndex]);
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
              placeholder={`Search or create new ${label}`}
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
            {allowSelf && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={handleAddSelfClick}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-primary hover:bg-accent transition-colors border-b border-border"
              >
                <UserRound size={14} aria-hidden="true" className="flex-shrink-0" />
                <span className="text-sm">Add yourself</span>
              </button>
            )}
            {filtered.length === 0 && !search && (
              <p className="text-sm text-muted px-3 py-4 text-center">No contacts yet</p>
            )}
            {filtered.length === 0 && search && !hasExactMatch && (
              <p className="text-sm text-muted px-3 py-3">No matches</p>
            )}
            {filtered.map((contact, idx) => (
              <button
                key={contact.id}
                id={`${listboxId}-option-${idx}`}
                type="button"
                role="option"
                aria-selected={contact.id === value}
                onClick={() => handleSelect(contact)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors',
                  contact.id === value && 'bg-accent',
                  activeIndex === idx && 'bg-accent',
                )}
              >
                <p className={cn('text-sm truncate', contact.id === value ? 'font-medium text-primary' : 'text-foreground')}>
                  {contact.name}
                </p>
                {(contact.email || contact.phone) && (
                  <p className="text-xs text-muted truncate mt-0.5">
                    {[contact.email, contact.phone].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>
            ))}
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
          open={createOpen}
          onOpenChange={(next) => (next ? setCreateOpen(true) : closeCreateSheet())}
        >
          <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <SheetHeader>
              <SheetTitle>{creatingSelf ? 'Add yourself' : `New ${label}`}</SheetTitle>
            </SheetHeader>
            <ContactForm
              defaultValues={{
                name: creatingSelf ? (user?.fullName ?? '') : pendingName,
                greetingName: creatingSelf
                  ? (user?.firstName ?? '')
                  : pendingName.trim().split(/\s+/)[0] ?? '',
                email: creatingSelf ? (user?.primaryEmailAddress?.emailAddress ?? '') : '',
                phone: '', website: '',
                addressLine1: '', addressLine2: '', city: '', county: '',
                postcode: '', country: 'GB', latitude: null, longitude: null, placeId: null,
                notes: '', parkingInfo: '',
                accessInfo: '', equipmentAvailable: '', commissionArrangement: '', primaryRole: '',
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
