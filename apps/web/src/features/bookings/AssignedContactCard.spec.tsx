import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssignedContactCard, type AssignedContactCardProps } from './AssignedContactCard';
import type { Contact } from '@/types/api';

// The real ContactForm drags AddressAutocomplete / VenuePlaceSearch into jsdom; this spec only
// covers the card's change/confirm state machine, so stub the form to a marker (the form's own
// behaviour is covered by ContactForm's stories in the browser project).
vi.mock('@/features/contacts/ContactForm', () => ({
  __esModule: true,
  default: () => <div data-testid="contact-form" />,
  contactToFormValues: () => ({}),
}));

const contact = { id: 'c1', updatedAt: '2026-01-01T00:00:00.000Z', name: 'Sophie' } as unknown as Contact;

function renderCard(overrides: Partial<AssignedContactCardProps> = {}) {
  const props: AssignedContactCardProps = {
    contact,
    roleLabel: 'Customer',
    contextRole: 'CUSTOMER',
    onSave: vi.fn(),
    onChangeContact: vi.fn(),
    isSaving: false,
    saved: false,
    saveError: false,
    dirty: false,
    ...overrides,
  };
  render(<AssignedContactCard {...props} />);
  return props;
}

describe('AssignedContactCard change/confirm state machine', () => {
  it('re-assigns immediately when the form is clean', async () => {
    const props = renderCard({ dirty: false });
    await userEvent.click(screen.getByRole('button', { name: /change customer/i }));

    expect(props.onChangeContact).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/discard changes/i)).not.toBeInTheDocument();
  });

  it('asks to discard first when the form is dirty', async () => {
    const props = renderCard({ dirty: true });
    await userEvent.click(screen.getByRole('button', { name: /change customer/i }));

    expect(screen.getByText(/discard changes and pick someone else/i)).toBeInTheDocument();
    expect(props.onChangeContact).not.toHaveBeenCalled();
  });

  it('re-assigns after confirming the discard', async () => {
    const props = renderCard({ dirty: true });
    await userEvent.click(screen.getByRole('button', { name: /change customer/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, change/i }));

    expect(props.onChangeContact).toHaveBeenCalledTimes(1);
  });

  it('cancel returns to edit without re-assigning', async () => {
    const props = renderCard({ dirty: true });
    await userEvent.click(screen.getByRole('button', { name: /change customer/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(props.onChangeContact).not.toHaveBeenCalled();
    expect(screen.queryByText(/discard changes/i)).not.toBeInTheDocument();
    // Back to the plain change control, form still mounted with its values intact
    expect(screen.getByRole('button', { name: /change customer/i })).toBeInTheDocument();
    expect(screen.getByTestId('contact-form')).toBeInTheDocument();
  });

  it('labels the change control and header per role', () => {
    renderCard({ roleLabel: 'Booking agent', contextRole: 'BOOKING_AGENT' });
    expect(screen.getByText('Booking agent')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /change booking agent/i })).toBeInTheDocument();
  });
});
