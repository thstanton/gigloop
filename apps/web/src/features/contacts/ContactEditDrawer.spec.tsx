import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactEditDrawer from './ContactEditDrawer';
import type { ContactDetail } from '@/types/api';

vi.mock('@/lib/api', () => ({
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const baseContact: ContactDetail = {
  id: 'contact-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  name: 'Test Contact',
  greetingName: null,
  email: null,
  phone: null,
  notes: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
  country: null,
  latitude: null,
  longitude: null,
  placeId: null,
  travelTimeMinutes: null,
  travelDistanceMetres: null,
  travelTimeCalculatedAt: null,
  travelMode: null,
  parkingInfo: null,
  accessInfo: null,
  equipmentAvailable: null,
  website: null,
  commissionArrangement: null,
  primaryRole: null,
  customerBookings: [],
  venueBookings: [],
  bookingAgentBookings: [],
};

const bookingRef = {
  id: 'booking-1',
  title: null,
  date: '2025-06-01',
  status: 'CONFIRMED' as const,
  eventType: 'WEDDING' as const,
};

function renderDrawer(contact: ContactDetail) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/?edit=true']}>
        <Routes>
          <Route path="/" element={<ContactEditDrawer contact={contact} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContactEditDrawer — delete section', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables the delete button when the contact has no bookings', () => {
    renderDrawer(baseContact);
    expect(screen.getByRole('button', { name: /delete contact/i })).not.toBeDisabled();
  });

  it('disables the delete button when the contact has customer bookings', () => {
    renderDrawer({ ...baseContact, customerBookings: [bookingRef] });
    expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
  });

  it('disables the delete button when the contact has venue bookings', () => {
    renderDrawer({ ...baseContact, venueBookings: [bookingRef] });
    expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
  });

  it('disables the delete button when the contact has booking agent bookings', () => {
    renderDrawer({ ...baseContact, bookingAgentBookings: [bookingRef] });
    expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
  });

  it('shows the booking count in the explanation text', () => {
    renderDrawer({
      ...baseContact,
      customerBookings: [bookingRef, { ...bookingRef, id: 'booking-2' }],
    });
    expect(screen.getByText(/2 bookings/i)).toBeInTheDocument();
  });

  it('uses singular "booking" when there is exactly one', () => {
    renderDrawer({ ...baseContact, customerBookings: [bookingRef] });
    expect(screen.getByText(/1 booking[^s]/i)).toBeInTheDocument();
  });
});
