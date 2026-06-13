import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BookingEditDrawer from './BookingEditDrawer';
import type { BookingDetail } from '@/types/api';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn().mockResolvedValue([]),
  apiPost: vi.fn().mockResolvedValue({}),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('./PerformanceEditor', () => ({ default: () => null }));
vi.mock('./MusicFormEditor', () => ({ default: () => null }));
vi.mock('./OnTheDayEditor', () => ({ default: () => null }));

const mockContact = {
  id: 'c1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  name: 'Sarah Johnson',
  greetingName: null,
  email: 'sarah@example.com',
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
};

const mockBooking: BookingDetail = {
  id: 'b1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  status: 'CONFIRMED',
  eventType: 'WEDDING',
  date: '2026-08-15T18:00:00Z',
  title: null,
  fee: null,
  notes: null,
  customerId: 'c1',
  customer: mockContact,
  venueId: null,
  venue: null,
  bookingAgentId: null,
  bookingAgent: null,
  sets: [],
  series: null,
  seriesId: null,
  packages: [],
  depositReceivedAt: null,
  portalToken: 'tok-1',
  hasMusicFormConfig: false,
  hasMusicFormResponse: false,
  logistics: null,
  activeContract: null,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderDrawer() {
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/?sheet=bookingEdit']}>
        <Routes>
          <Route path="/" element={<BookingEditDrawer booking={mockBooking} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('BookingEditDrawer — mutation error recovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows error and re-enables button after a failed save, clears error on successful retry', async () => {
    const user = userEvent.setup();
    const { apiPatch } = await import('@/lib/api');

    vi.mocked(apiPatch)
      .mockRejectedValueOnce(new Response('Internal Server Error', { status: 500 }))
      .mockResolvedValueOnce(undefined as never);

    renderDrawer();

    const saveBtn = await screen.findByRole('button', { name: /save changes/i });

    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText(/failed to save changes/i)).toBeInTheDocument();
    });
    expect(saveBtn).not.toBeDisabled();

    await user.click(saveBtn);

    await waitFor(() => {
      expect(screen.queryByText(/failed to save changes/i)).not.toBeInTheDocument();
    });
  });
});
