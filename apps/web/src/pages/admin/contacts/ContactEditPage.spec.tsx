import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactEditPage from './ContactEditPage';
import { useContact } from '@/lib/hooks/useContact';
import type { ContactDetail } from '@/types/api';

vi.mock('@/lib/hooks/useContact');
vi.mock('@/lib/api', () => ({
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const baseContact: ContactDetail = {
  id: 'contact-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  name: 'Test Contact',
  email: null,
  phone: null,
  address: null,
  notes: null,
  parkingInfo: null,
  accessInfo: null,
  equipmentAvailable: null,
  website: null,
  commissionArrangement: null,
  customerBookings: [],
  venueBookings: [],
  referrerBookings: [],
};

const bookingRef = {
  id: 'booking-1',
  title: null,
  date: '2025-06-01',
  status: 'CONFIRMED' as const,
  eventType: 'WEDDING' as const,
};

function renderPage(contact: ContactDetail) {
  vi.mocked(useContact).mockReturnValue({
    data: contact,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useContact>);

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/contacts/contact-1/edit']}>
        <Routes>
          <Route path="/admin/contacts/:id/edit" element={<ContactEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContactEditPage — delete section', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enables the delete button when the contact has no bookings', () => {
    renderPage(baseContact);
    expect(screen.getByRole('button', { name: /delete contact/i })).not.toBeDisabled();
  });

  it('disables the delete button when the contact has customer bookings', () => {
    renderPage({ ...baseContact, customerBookings: [bookingRef] });
    expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
  });

  it('disables the delete button when the contact has venue bookings', () => {
    renderPage({ ...baseContact, venueBookings: [bookingRef] });
    expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
  });

  it('disables the delete button when the contact has referrer bookings', () => {
    renderPage({ ...baseContact, referrerBookings: [bookingRef] });
    expect(screen.getByRole('button', { name: /delete contact/i })).toBeDisabled();
  });

  it('shows the booking count in the explanation text', () => {
    renderPage({
      ...baseContact,
      customerBookings: [bookingRef, { ...bookingRef, id: 'booking-2' }],
    });
    expect(screen.getByText(/2 bookings/i)).toBeInTheDocument();
  });

  it('uses singular "booking" when there is exactly one', () => {
    renderPage({ ...baseContact, customerBookings: [bookingRef] });
    expect(screen.getByText(/1 booking[^s]/i)).toBeInTheDocument();
  });
});
