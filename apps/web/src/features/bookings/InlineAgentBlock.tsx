import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import ContactPicker from './ContactPicker';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';

interface InlineAgentBlockProps {
  value: string | null;
  onChange: (id: string | null) => void;
  error?: string;
  /** When provided, the block is in edit mode: a per-box Save appears whenever the
   *  selection differs from committedValue (the contact saved on the booking). */
  committedValue?: string | null;
  onSave?: (value: string | null) => void;
  isSaving?: boolean;
  saveError?: string | null;
}

export function InlineAgentBlock({
  value,
  onChange,
  error,
  committedValue,
  onSave,
  isSaving,
  saveError,
}: InlineAgentBlockProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [greetingName, setGreetingName] = useState('');
  const [greetingEdited, setGreetingEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [website, setWebsite] = useState('');
  const [commissionArrangement, setCommissionArrangement] = useState('');
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
        addressLine1: addressLine1.trim() || undefined,
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim() || undefined,
        postcode: postcode.trim() || undefined,
        website: website.trim() || null,
        commissionArrangement: commissionArrangement.trim() || null,
        primaryRole: 'BOOKING_AGENT',
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onChange(created.id);
      setName('');
      setGreetingName('');
      setGreetingEdited(false);
      setEmail('');
      setPhone('');
      setAddressLine1('');
      setAddressLine2('');
      setCity('');
      setPostcode('');
      setWebsite('');
      setCommissionArrangement('');
      setShowMore(false);
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

  const dirty = !!onSave && (value || null) !== (committedValue ?? null);

  const header = (
    <div className="flex items-center gap-1.5">
      <Briefcase size={16} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold">
        Booking agent <span className="font-normal text-muted-foreground">(optional)</span>
      </p>
    </div>
  );

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      {value ? (
        // Attached: show the selected contact (clear with the ✕ to detach)
        <>
          {header}
          <ContactPicker
            value={value}
            onChange={onChange}
            placeholder="Select booking agent..."
            label="booking agent"
            preferredRole="BOOKING_AGENT"
            disableCreate
          />
        </>
      ) : (
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'existing' | 'new')}>
          <div className="flex items-center justify-between gap-3">
            {header}
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
                  placeholder="e.g. Bob"
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
                <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide agent details</>
              ) : (
                <><ChevronDown className="h-4 w-4" aria-hidden="true" />Add more agent details</>
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
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <SubLabel>Address line 1</SubLabel>
                    <Input
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      placeholder="123 High Street"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <SubLabel>Address line 2</SubLabel>
                    <Input
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="(optional)"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <SubLabel>City</SubLabel>
                      <Input value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <SubLabel>Postcode</SubLabel>
                      <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} />
                    </div>
                  </div>
                </div>
                <FormField label="Website">
                  <Input
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://agency.example.com"
                  />
                </FormField>
                <FormField label="Commission arrangement">
                  <Textarea
                    value={commissionArrangement}
                    onChange={(e) => setCommissionArrangement(e.target.value)}
                    rows={2}
                    placeholder="e.g. 15% of fee"
                  />
                </FormField>
              </div>
            )}

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
      )}

      {onSave && dirty && (
        <div className="flex items-center gap-3">
          <Button type="button" onClick={() => onSave(value)} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
          {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
        </div>
      )}

      {error && <p className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
}
