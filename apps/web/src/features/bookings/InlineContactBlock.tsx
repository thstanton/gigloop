import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, User } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import ContactPicker from './ContactPicker';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';

interface InlineContactBlockProps {
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
}

export function InlineContactBlock({ value, onChange, error }: InlineContactBlockProps) {
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [greetingName, setGreetingName] = useState('');
  const [greetingEdited, setGreetingEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!greetingEdited) {
      setGreetingName(name.trim().split(/\s+/)[0] ?? '');
    }
  }, [name, greetingEdited]);

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<Contact>('/contacts', {
        name: name.trim(),
        greetingName: greetingName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        primaryRole: 'CUSTOMER',
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      setMode('existing');
      setName('');
      setGreetingName('');
      setGreetingEdited(false);
      setEmail('');
      setPhone('');
      setNotes('');
      setShowMore(false);
      setLocalError(null);
    },
    onError: () => {
      setLocalError('Failed to create contact. Please try again.');
    },
  });

  function handleCreate() {
    if (!name.trim()) {
      setLocalError('Name is required');
      return;
    }
    setLocalError(null);
    createMutation.mutate();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  }

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <User size={16} className="text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-semibold">Customer</span>
          </div>
          <TabsList className="h-auto p-0.5 bg-secondary border border-border">
            <TabsTrigger
              value="existing"
              className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              Select existing
            </TabsTrigger>
            <TabsTrigger
              value="new"
              className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              + New
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="existing" className="mt-3">
          <ContactPicker
            value={value}
            onChange={onChange}
            placeholder="Select customer..."
            label="customer"
            preferredRole="CUSTOMER"
            disableCreate
          />
        </TabsContent>

        <TabsContent value="new" className="mt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Name" required>
              <Input
                value={name}
                onChange={(e) => { setName(e.target.value); setLocalError(null); }}
                onKeyDown={handleKeyDown}
                placeholder="Full name"
                autoFocus
              />
            </FormField>
            <FormField label="Greeting name">
              <Input
                value={greetingName}
                onChange={(e) => { setGreetingName(e.target.value); setGreetingEdited(true); }}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Jane"
              />
              <p className="text-sm text-muted-foreground mt-1">Used in emails and letters to this contact</p>
            </FormField>
          </div>

          <FormField label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="email@example.com"
            />
          </FormField>

          <button
            type="button"
            onClick={() => setShowMore((o) => !o)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMore ? (
              <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide customer details</>
            ) : (
              <><ChevronDown className="h-4 w-4" aria-hidden="true" />Add more customer details</>
            )}
          </button>

          {showMore && (
            <div className="space-y-3">
              <FormField label="Phone">
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </FormField>
              <FormField label="Notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </FormField>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create customer'}
            </Button>
            {localError && (
              <p className="text-sm text-status-cancelled">{localError}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {error && <p className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
}
