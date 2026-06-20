import { useState } from 'react';
import { User, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/common/FormField';
import { SubLabel } from '@/components/common/SubLabel';
import ContactPicker from './ContactPicker';

// PRD #511 Module B — the People section editor atom (assignment only): consolidates the
// customer (required) and booking-agent (optional) inline blocks into one editor, killing the
// old per-box saves. Like VenueAtom it is Sheet-agnostic, owns no mutation, and surfaces intent
// via onSave(selection); the host injects the regime and the save state.

/** Fields captured when inline-creating a contact for a role. */
export interface NewContactData {
  name: string;
  greetingName?: string;
  email?: string;
  phone?: string;
  commissionArrangement?: string;
}

/** A role's intended assignment: keep/pick/clear an existing contact, or create a new one. */
export type RoleSelection =
  | { kind: 'existing'; contactId: string | null }
  | { kind: 'new'; contact: NewContactData };

/** Only the role(s) the user actually changed are present, so the host PATCHes the minimum. */
export interface PeopleSelection {
  customer?: RoleSelection;
  agent?: RoleSelection;
}

interface PeopleAtomProps {
  initialCustomerId: string | null;
  initialAgentId: string | null;
  onSave: (selection: PeopleSelection) => void;
  // Tier-1-capable save state, injected by the host (the quick-tweak shell uses Tier-2 and
  // leaves saved/saveError off; the Builder shell can drive them).
  isSaving: boolean;
  saved: boolean;
  saveError: string | null;
}

function trimmedOrUndefined(value: string): string | undefined {
  return value.trim() || undefined;
}

function firstWord(name: string): string | undefined {
  return name.trim().split(/\s+/)[0] || undefined;
}

interface RoleFieldProps {
  label: string;
  preferredRole: 'CUSTOMER' | 'BOOKING_AGENT';
  /** Customer is required, so its picker hides the clear control. */
  required: boolean;
  /** Booking agents carry a commission arrangement; customers don't. */
  showCommission: boolean;
  initialContactId: string | null;
  onChange: (selection: RoleSelection) => void;
}

// Internal (same file → no separate story): one role's pick-existing / inline-create editor.
// It owns its ephemeral form state and reports the current intended selection upward.
function RoleField({ label, preferredRole, required, showCommission, initialContactId, onChange }: RoleFieldProps) {
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedId, setSelectedId] = useState<string | null>(initialContactId);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('');

  function reportExisting(id: string | null) {
    onChange({ kind: 'existing', contactId: id });
  }

  function reportNew(next: { name?: string; email?: string; phone?: string; commission?: string }) {
    const n = next.name ?? name;
    onChange({
      kind: 'new',
      contact: {
        name: n.trim(),
        greetingName: firstWord(n),
        email: trimmedOrUndefined(next.email ?? email),
        phone: trimmedOrUndefined(next.phone ?? phone),
        ...(showCommission ? { commissionArrangement: trimmedOrUndefined(next.commission ?? commission) } : {}),
      },
    });
  }

  function handleModeChange(value: string) {
    const next = value as 'existing' | 'new';
    setMode(next);
    if (next === 'existing') reportExisting(selectedId);
    else reportNew({});
  }

  const header = (
    <div className="flex items-center gap-1.5">
      <User size={16} className="text-muted-foreground" aria-hidden="true" />
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
              onChange={(e) => { setName(e.target.value); reportNew({ name: e.target.value }); }}
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
              {showCommission && (
                <FormField label="Commission arrangement">
                  <Input
                    value={commission}
                    onChange={(e) => { setCommission(e.target.value); reportNew({ commission: e.target.value }); }}
                    placeholder="e.g. 15% of fee"
                  />
                </FormField>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function isDirty(selection: RoleSelection | null, initialId: string | null): boolean {
  if (!selection) return false;
  if (selection.kind === 'new') return !!selection.contact.name.trim();
  return (selection.contactId ?? null) !== (initialId ?? null);
}

export function PeopleAtom({
  initialCustomerId,
  initialAgentId,
  onSave,
  isSaving,
  saved,
  saveError,
}: PeopleAtomProps) {
  const [customerSel, setCustomerSel] = useState<RoleSelection | null>(null);
  const [agentSel, setAgentSel] = useState<RoleSelection | null>(null);

  const customerDirty = isDirty(customerSel, initialCustomerId);
  const agentDirty = isDirty(agentSel, initialAgentId);

  // Customer is required: a change that would leave it unset is not saveable.
  const customerWouldClear =
    customerDirty && customerSel?.kind === 'existing' && customerSel.contactId == null;
  const canSave = (customerDirty || agentDirty) && !customerWouldClear;

  function handleSave() {
    const selection: PeopleSelection = {};
    if (customerDirty && customerSel) selection.customer = customerSel;
    if (agentDirty && agentSel) selection.agent = agentSel;
    onSave(selection);
  }

  return (
    <div className="space-y-4">
      <RoleField
        label="Customer"
        preferredRole="CUSTOMER"
        required
        showCommission={false}
        initialContactId={initialCustomerId}
        onChange={setCustomerSel}
      />
      <RoleField
        label="Booking agent"
        preferredRole="BOOKING_AGENT"
        required={false}
        showCommission
        initialContactId={initialAgentId}
        onChange={setAgentSel}
      />

      {/* Tier-1-capable inline save row; the quick-tweak shell drives it Tier-2 (close on
          success) and leaves saved/saveError unset. */}
      <div className="flex items-center gap-3 pt-1">
        <Button type="button" onClick={handleSave} disabled={isSaving || !canSave}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
        {saved && !isSaving && <span className="text-xs text-muted">Saved</span>}
        {customerWouldClear && (
          <p className="text-sm text-status-cancelled">A customer is required.</p>
        )}
        {saveError && <p className="text-sm text-status-cancelled">{saveError}</p>}
      </div>
    </div>
  );
}
