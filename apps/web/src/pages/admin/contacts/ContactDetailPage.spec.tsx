import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContactDetailPage from './ContactDetailPage';
import { useContact } from '@/lib/hooks/useContact';
import { isEnabled } from '@/lib/featureFlags';
import type { ContactDetail } from '@/types/api';

// The dep profile is gated on a build-time `VITE_` flag, so it can only be exercised by mocking
// the helper — Storybook has no value defined for it (#978).
vi.mock('@/lib/featureFlags', () => ({ isEnabled: vi.fn() }));
vi.mock('@/lib/hooks/useContact', () => ({ useContact: vi.fn() }));
vi.mock('@/lib/hooks/useRoleVocabulary', () => ({ useRoleVocabulary: () => [] }));
vi.mock('@/lib/api', () => ({ apiGet: vi.fn(), apiPatch: vi.fn(), apiDelete: vi.fn() }));

const baseContact: ContactDetail = {
  id: 'contact-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  name: 'Dave Sax',
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
  primaryRole: 'BAND_MEMBER',
  primaryBandRole: null,
  instruments: [],
  travelNotes: null,
  equipmentNotes: null,
  outfitNotes: null,
  availabilityNotes: null,
  customerBookings: [],
  venueBookings: [],
  bookingAgentBookings: [],
  bandMemberCount: 0,
};

const filledBandMember: ContactDetail = {
  ...baseContact,
  primaryBandRole: 'Saxophone',
  instruments: ['Saxophone', 'Clarinet'],
  travelNotes: 'Drives, happy to take others.',
  equipmentNotes: 'Brings own amp.',
  outfitNotes: 'Owns a dinner suit.',
  availabilityNotes: 'No Sundays before 3pm.',
};

function renderPage(contact: ContactDetail) {
  vi.mocked(useContact).mockReturnValue({
    data: contact,
    isLoading: false,
    isError: false,
  } as ReturnType<typeof useContact>);

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/contacts/contact-1']}>
        <Routes>
          <Route path="/admin/contacts/:id" element={<ContactDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContactDetailPage — dep profile (#978)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows every populated band field for a BAND_MEMBER when the flag is on', () => {
    vi.mocked(isEnabled).mockReturnValue(true);
    renderPage(filledBandMember);

    expect(screen.getByText('Band member details')).toBeInTheDocument();
    expect(screen.getByText('Identity')).toBeInTheDocument();
    expect(screen.getByText('Saxophone', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('Clarinet')).toBeInTheDocument();
    expect(screen.getByText('Drives, happy to take others.')).toBeInTheDocument();
    expect(screen.getByText('Brings own amp.')).toBeInTheDocument();
    expect(screen.getByText('Owns a dinner suit.')).toBeInTheDocument();
    expect(screen.getByText('No Sundays before 3pm.')).toBeInTheDocument();
  });

  it('omits the row for a field that is empty', () => {
    vi.mocked(isEnabled).mockReturnValue(true);
    renderPage({ ...filledBandMember, outfitNotes: null, instruments: [] });

    expect(screen.getByText('Band member details')).toBeInTheDocument();
    expect(screen.queryByText('Outfit notes')).not.toBeInTheDocument();
    expect(screen.queryByText('Instruments')).not.toBeInTheDocument();
    expect(screen.getByText('Travel notes')).toBeInTheDocument();
  });

  it('treats an empty string as unset, not as a value to draw', () => {
    // The DTO accepts `""` (@IsString with no @IsNotEmpty), so the field can hold an empty
    // string even though the form converts one to null on submit.
    vi.mocked(isEnabled).mockReturnValue(true);
    renderPage({ ...baseContact, primaryBandRole: '', travelNotes: 'Drives.' });

    expect(screen.getByText('Band member details')).toBeInTheDocument();
    expect(screen.queryByText('Identity')).not.toBeInTheDocument();
  });

  it('renders no block when every field is an empty string rather than null', () => {
    vi.mocked(isEnabled).mockReturnValue(true);
    renderPage({
      ...baseContact,
      primaryBandRole: '',
      travelNotes: '',
      equipmentNotes: '',
      outfitNotes: '',
      availabilityNotes: '',
    });

    expect(screen.queryByText('Band member details')).not.toBeInTheDocument();
  });

  it('renders no block at all when every band field is empty', () => {
    vi.mocked(isEnabled).mockReturnValue(true);
    renderPage(baseContact);

    expect(screen.queryByText('Band member details')).not.toBeInTheDocument();
  });

  it('renders nothing band-related when the flag is off', () => {
    vi.mocked(isEnabled).mockReturnValue(false);
    renderPage(filledBandMember);

    expect(screen.queryByText('Band member details')).not.toBeInTheDocument();
    expect(screen.queryByText('Drives, happy to take others.')).not.toBeInTheDocument();
  });

  it('renders no band block for a contact filed under another role', () => {
    vi.mocked(isEnabled).mockReturnValue(true);
    renderPage({ ...filledBandMember, primaryRole: 'CUSTOMER' });

    expect(screen.queryByText('Band member details')).not.toBeInTheDocument();
  });
});
