import { useState } from 'react';
import { Search, X, ChevronDown, Plus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
}

export default function ContactPicker({
  value,
  onChange,
  placeholder = 'Select contact...',
  label = 'contact',
}: ContactPickerProps) {
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [pendingName, setPendingName] = useState('');

  const { data: contacts = [] } = useContacts();
  const queryClient = useQueryClient();

  const selected = contacts.find((c) => c.id === value) ?? null;

  const filtered = search
    ? contacts.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : contacts;

  const hasExactMatch = contacts.some(
    (c) => c.name.toLowerCase() === search.toLowerCase()
  );

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
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  function handleCreateClick() {
    setPendingName(search);
    setOpen(false);
    setCreateOpen(true);
  }

  return (
    <>
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSearch(''); }}>
        <PopoverTrigger asChild>
          <button
            type="button"
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
                className="text-muted flex-shrink-0 ml-2 hover:text-foreground transition-colors"
                onClick={handleClear}
              />
            ) : (
              <ChevronDown size={14} className="text-muted flex-shrink-0 ml-2" />
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
            <Search size={14} className="text-muted flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && !search && (
              <p className="text-sm text-muted px-3 py-4 text-center">No contacts yet</p>
            )}
            {filtered.length === 0 && search && !hasExactMatch && (
              <p className="text-sm text-muted px-3 py-3">No matches</p>
            )}
            {filtered.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => handleSelect(contact)}
                className={cn(
                  'w-full text-left px-3 py-2.5 hover:bg-accent transition-colors',
                  contact.id === value && 'bg-accent',
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
                type="button"
                onClick={handleCreateClick}
                className="w-full text-left px-3 py-2.5 flex items-center gap-2 text-primary hover:bg-accent transition-colors border-t border-border"
              >
                <Plus size={14} className="flex-shrink-0" />
                <span className="text-sm">Create "{search}"</span>
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New {label}</DialogTitle>
          </DialogHeader>
          <ContactForm
            defaultValues={{
              name: pendingName,
              email: '', phone: '', website: '',
              address: '', notes: '', parkingInfo: '',
              accessInfo: '', equipmentAvailable: '', commissionArrangement: '',
            }}
            onSubmit={(values) => createMutation.mutate(values)}
            isPending={createMutation.isPending}
            isError={createMutation.isError}
            submitLabel="Create"
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
