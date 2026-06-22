import { useState } from 'react';
import { User, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import ContactPicker from './ContactPicker';

// PRD #511 Module B / ADR-0053 — the controlled presentational core for a People role
// (customer or booking agent). Sibling to DetailsFields / MusicFields / VenueFields: it owns
// its ephemeral form state and surfaces the user's intended selection via `onChange` — no
// booking id, no PATCH, no save row. Two thin compositions consume it: the self-saving
// PeopleAtom (Builder + quick-tweak) and the New Booking form (create-mode, value bubbles to
// the atomic POST). New-contact capture is the union of both roles' legacy inline blocks
// (ADR-0053: enrich the shared atom rather than drop fields).

/** Fields captured when inline-creating a contact for a role. */
export interface NewContactData {
  name: string;
  greetingName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  website?: string;
  commissionArrangement?: string;
}

/** A role's intended assignment: pick/clear an existing contact, or create a new one. */
export type RoleSelection =
  | { kind: 'existing'; contactId: string | null }
  | { kind: 'new'; contact: NewContactData };

function trimmedOrUndefined(value: string): string | undefined {
  return value.trim() || undefined;
}

export function firstWord(name: string): string | undefined {
  return name.trim().split(/\s+/)[0] || undefined;
}

interface RoleFieldProps {
  label: string;
  preferredRole: 'CUSTOMER' | 'BOOKING_AGENT';
  /** Customer is required, so its picker hides the clear control. */
  required: boolean;
  /** Drives the icon and which extra fields the new-contact path shows. */
  variant: 'customer' | 'agent';
  initialContactId: string | null;
  /** Default tab — create defaults customer to "new" (Story 39: a new enquiry is usually a
   *  new customer). Omitted → "existing". */
  initialMode?: 'existing' | 'new';
  /** Required-field error, rendered below the card (used by the create form). */
  error?: string;
  onChange: (selection: RoleSelection) => void;
}

// One role's pick-existing / inline-create editor. Owns its ephemeral form state and reports
// the current intended selection upward on every edit.
export function RoleField({
  label,
  preferredRole,
  required,
  variant,
  initialContactId,
  initialMode,
  error,
  onChange,
}: RoleFieldProps) {
  const [mode, setMode] = useState<'existing' | 'new'>(initialMode ?? 'existing');
  const [selectedId, setSelectedId] = useState<string | null>(initialContactId);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [greetingName, setGreetingName] = useState('');
  const [greetingEdited, setGreetingEdited] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [website, setWebsite] = useState('');
  const [commission, setCommission] = useState('');

  const showAgentExtras = variant === 'agent';

  function reportExisting(id: string | null) {
    onChange({ kind: 'existing', contactId: id });
  }

  function reportNew(over: Partial<NewContactData> = {}) {
    const merged: NewContactData = {
      name,
      greetingName,
      email,
      phone,
      notes,
      addressLine1,
      addressLine2,
      city,
      postcode,
      website,
      commissionArrangement: commission,
      ...over,
    };
    onChange({
      kind: 'new',
      contact: {
        name: merged.name?.trim() ?? '',
        greetingName: trimmedOrUndefined(merged.greetingName ?? ''),
        email: trimmedOrUndefined(merged.email ?? ''),
        phone: trimmedOrUndefined(merged.phone ?? ''),
        ...(variant === 'customer' ? { notes: trimmedOrUndefined(merged.notes ?? '') } : {}),
        ...(showAgentExtras
          ? {
              addressLine1: trimmedOrUndefined(merged.addressLine1 ?? ''),
              addressLine2: trimmedOrUndefined(merged.addressLine2 ?? ''),
              city: trimmedOrUndefined(merged.city ?? ''),
              postcode: trimmedOrUndefined(merged.postcode ?? ''),
              website: trimmedOrUndefined(merged.website ?? ''),
              commissionArrangement: trimmedOrUndefined(merged.commissionArrangement ?? ''),
            }
          : {}),
      },
    });
  }

  function handleModeChange(value: string) {
    const next = value as 'existing' | 'new';
    setMode(next);
    if (next === 'existing') reportExisting(selectedId);
    else reportNew();
  }

  function handleNameChange(value: string) {
    setName(value);
    const derived = greetingEdited ? greetingName : firstWord(value) ?? '';
    if (!greetingEdited) setGreetingName(derived);
    reportNew({ name: value, greetingName: derived });
  }

  const Icon = variant === 'agent' ? Briefcase : User;
  const header = (
    <div className="flex items-center gap-1.5">
      <Icon size={16} className="text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-semibold">
        {label}
        {!required && <span className="font-normal text-muted-foreground"> (optional)</span>}
      </p>
    </div>
  );

  return (
    <div className="border border-border rounded-md p-4 space-y-3">
      <Tabs value={mode} onValueChange={handleModeChange}>
        <div className="flex items-center justify-between gap-3">
          {header}
          <TabsList size="sm" className="bg-secondary border border-border">
            <TabsTrigger
              size="sm"
              value="existing"
              className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              Select existing
            </TabsTrigger>
            <TabsTrigger
              size="sm"
              value="new"
              className="text-foreground/60 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-none"
            >
              + New
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="existing" className="mt-3">
          <ContactPicker
            value={selectedId}
            onChange={(id) => { setSelectedId(id); reportExisting(id); }}
            placeholder={`Select ${label.toLowerCase()}...`}
            label={label.toLowerCase()}
            preferredRole={preferredRole}
            disableCreate
          />
        </TabsContent>

        <TabsContent value="new" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <SubLabel>Name</SubLabel>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Jane Smith"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowMore((o) => !o)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showMore ? (
              <><ChevronUp className="h-4 w-4" aria-hidden="true" />Hide contact details</>
            ) : (
              <><ChevronDown className="h-4 w-4" aria-hidden="true" />Add contact details</>
            )}
          </button>

          {showMore && (
            <div className="space-y-3">
              <FormField label="Greeting name">
                <Input
                  value={greetingName}
                  onChange={(e) => { setGreetingName(e.target.value); setGreetingEdited(true); reportNew({ greetingName: e.target.value }); }}
                  placeholder="e.g. Jane"
                />
                <p className="text-sm text-muted-foreground mt-1">Used in emails and letters to this contact</p>
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); reportNew({ email: e.target.value }); }}
                  placeholder="jane@example.com"
                />
              </FormField>
              <FormField label="Phone">
                <Input
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); reportNew({ phone: e.target.value }); }}
                  placeholder="07700 900000"
                />
              </FormField>

              {variant === 'customer' && (
                <FormField label="Notes">
                  <Textarea
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); reportNew({ notes: e.target.value }); }}
                    rows={2}
                  />
                </FormField>
              )}

              {showAgentExtras && (
                <>
                  <div className="space-y-1.5">
                    <SubLabel>Address line 1</SubLabel>
                    <Input
                      value={addressLine1}
                      onChange={(e) => { setAddressLine1(e.target.value); reportNew({ addressLine1: e.target.value }); }}
                      placeholder="123 High Street"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <SubLabel>Address line 2</SubLabel>
                    <Input
                      value={addressLine2}
                      onChange={(e) => { setAddressLine2(e.target.value); reportNew({ addressLine2: e.target.value }); }}
                      placeholder="(optional)"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <SubLabel>City</SubLabel>
                      <Input
                        value={city}
                        onChange={(e) => { setCity(e.target.value); reportNew({ city: e.target.value }); }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <SubLabel>Postcode</SubLabel>
                      <Input
                        value={postcode}
                        onChange={(e) => { setPostcode(e.target.value); reportNew({ postcode: e.target.value }); }}
                      />
                    </div>
                  </div>
                  <FormField label="Website">
                    <Input
                      type="url"
                      value={website}
                      onChange={(e) => { setWebsite(e.target.value); reportNew({ website: e.target.value }); }}
                      placeholder="https://agency.example.com"
                    />
                  </FormField>
                  <FormField label="Commission arrangement">
                    <Textarea
                      value={commission}
                      onChange={(e) => { setCommission(e.target.value); reportNew({ commissionArrangement: e.target.value }); }}
                      rows={2}
                      placeholder="e.g. 15% of fee"
                    />
                  </FormField>
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {error && <p className="text-sm text-status-cancelled">{error}</p>}
    </div>
  );
}
