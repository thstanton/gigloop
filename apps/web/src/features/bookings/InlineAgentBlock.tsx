import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import ContactPicker from './ContactPicker';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';

interface InlineAgentBlockProps {
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
}

export function InlineAgentBlock({ value, onChange, error }: InlineAgentBlockProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      apiPost<Contact>('/contacts', {
        name: name.trim(),
        email: email.trim() || undefined,
        primaryRole: 'BOOKING_AGENT',
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      setMode('existing');
      setName('');
      setEmail('');
      setLocalError(null);
    },
    onError: () => {
      setLocalError('Failed to create booking agent. Please try again.');
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
          <p className="text-sm font-semibold">
            Booking agent <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
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
            placeholder="Select booking agent..."
            label="booking agent"
            preferredRole="BOOKING_AGENT"
            disableCreate
          />
        </TabsContent>

        <TabsContent value="new" className="mt-3 space-y-3">
          <FormField label="Name" required>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); setLocalError(null); }}
              onKeyDown={handleKeyDown}
              placeholder="Full name"
              autoFocus
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="email@example.com"
            />
          </FormField>

          <div className="flex items-center gap-3">
            <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating…' : 'Create booking agent'}
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
