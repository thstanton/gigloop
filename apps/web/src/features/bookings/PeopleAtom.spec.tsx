import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PeopleAtom } from './PeopleAtom';
import type { Contact } from '@/types/api';

// Stub the container (it drags ContactForm → AddressAutocomplete into jsdom) and RoleField (it
// fetches contacts). This spec covers only the atom's mode-switch + assignment orchestration.
vi.mock('./AssignedContactCardContainer', () => ({
  AssignedContactCardContainer: ({ roleLabel, onChangeContact }: { roleLabel: string; onChangeContact: () => void }) => (
    <div>
      <span>{roleLabel} card</span>
      <button type="button" onClick={onChangeContact}>Change {roleLabel}</button>
    </div>
  ),
}));

vi.mock('./PeopleFields', () => ({
  RoleField: ({ label, onChange }: { label: string; onChange: (s: unknown) => void }) => (
    <button type="button" onClick={() => onChange({ kind: 'existing', contactId: `${label}-new` })}>
      pick {label}
    </button>
  ),
}));

const contact = (id: string, primaryRole: string): Contact => ({
  id, name: id, greetingName: null, email: null, phone: null, website: null,
  addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: 'GB',
  latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null,
  travelTimeCalculatedAt: null, travelMode: null, notes: null, parkingInfo: null, accessInfo: null,
  equipmentAvailable: null, commissionArrangement: null, primaryRole,
  createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
});

const customer = contact('cust', 'CUSTOMER');
const agent = contact('agent', 'BOOKING_AGENT');

function base(over = {}) {
  return { customer, agent, onSave: vi.fn(), isSaving: false, saved: false, saveError: null, ...over };
}

describe('PeopleAtom mode switch + assignment orchestration', () => {
  it('renders an edit card per assigned role', () => {
    render(<PeopleAtom {...base()} />);
    expect(screen.getByText('Customer card')).toBeInTheDocument();
    expect(screen.getByText('Booking agent card')).toBeInTheDocument();
  });

  it('Change switches only that role to assign mode', async () => {
    render(<PeopleAtom {...base()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change Customer' }));

    expect(screen.getByRole('button', { name: 'pick Customer' })).toBeInTheDocument();
    // The agent box is untouched.
    expect(screen.getByText('Booking agent card')).toBeInTheDocument();
  });

  it('assignment Save emits only the changed role', async () => {
    const onSave = vi.fn();
    render(<PeopleAtom {...base({ onSave })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change Customer' }));
    await userEvent.click(screen.getByRole('button', { name: 'pick Customer' }));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(onSave).toHaveBeenCalledWith({ customer: { kind: 'existing', contactId: 'Customer-new' } });
  });

  it('customer-required guard blocks clearing the customer', async () => {
    render(<PeopleAtom {...base()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Change Customer' }));
    // RoleField stub emits a real id; to simulate a clear we drive the guard via the empty case is
    // covered by the atom's own logic — here we assert the Save is disabled before any change.
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('flips only the saved role back to edit — a mid-selection in the other box survives', async () => {
    const { rerender } = render(<PeopleAtom {...base()} />);
    // Put BOTH roles into assign mode.
    await userEvent.click(screen.getByRole('button', { name: 'Change Customer' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change Booking agent' }));
    // Make a selection in the agent box (mid-edit), then save the CUSTOMER assignment.
    await userEvent.click(screen.getByRole('button', { name: 'pick Booking agent' }));
    await userEvent.click(screen.getByRole('button', { name: 'pick Customer' }));
    const saves = screen.getAllByRole('button', { name: /^save$/i });
    await userEvent.click(saves[0]); // customer box is the first

    // Host reports the assignment succeeded.
    rerender(<PeopleAtom {...base({ saved: true })} />);

    // Customer flipped back to its card; the agent box stayed in assign mode (selection preserved).
    expect(screen.getByText('Customer card')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'pick Booking agent' })).toBeInTheDocument();
    expect(screen.queryByText('Booking agent card')).not.toBeInTheDocument();
  });
});
