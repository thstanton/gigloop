import { useState, useRef, useId } from 'react';
import { Search, X, ChevronDown, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';
import { cn } from '@/lib/utils';

interface ContactPickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  placeholder?: string;
  label?: string;
  preferredRole?: string;
}

export default function ContactPicker({
  value,
  onChange,
  placeholder = 'Select contact...',
  label = 'contact',
  preferredRole,
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingName, setPendingName] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  const { data: contacts = [] } = useContacts();
  const queryClient = useQueryClient();

  const selected = contacts.find((c) => c.id === value) ?? null;

  const sortByRole = (list: Contact[]) => {
    if (!preferredRole) return list;
    return [...list].sort((a, b) => {
      const aMatch = a.primaryRole === preferredRole ? 0 : 1;
      const bMatch = b.primaryRole === preferredRole ? 0 : 1;
      return aMatch - bMatch;
    });
  };

  const filtered = sortByRole(
    search
      ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      : contacts,
  );

  const hasExactMatch = contacts.some(
    (c) => c.name.toLowerCase() === search.toLowerCase()
  );

  // Options includes the create option when present
  const totalOptions = filtered.length + (search && !hasExactMatch ? 1 : 0);

  const createMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPost<Contact>('/contacts', toContactPayload(values)),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      setCreateOpen(false);
      setOpen(false);
      setSearch('');
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
            className={cn(
              'w-full flex items-center justify-between rounded-md border border-border bg-background px-3 h-10 text-sm transition-colors',
              'hover:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
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
            {search && !hasExactMatch && (
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

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <SheetHeader>
            <SheetTitle>New {label}</SheetTitle>
          </SheetHeader>
          <ContactForm
            defaultValues={{
              name: pendingName,
              greetingName: pendingName.trim().split(/\s+/)[0] ?? '',
              email: '', phone: '', website: '',
              addressLine1: '', addressLine2: '', city: '', county: '',
              postcode: '', country: 'GB', latitude: null, longitude: null, placeId: null,
              notes: '', parkingInfo: '',
              accessInfo: '', equipmentAvailable: '', commissionArrangement: '', primaryRole: '',
            }}
            onSubmit={(values) => createMutation.mutate(values)}
            isPending={createMutation.isPending}
            isError={createMutation.isError}
            submitLabel="Create"
            onCancel={() => setCreateOpen(false)}
            autoSuggestGreetingName
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
