import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import SettingsPage from './SettingsPage';
import * as api from '@/lib/api';
import type { PublicProfile, UserProfile } from '@/types/api';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/api');

const mockPublicProfile: PublicProfile = {
  id: 'profile-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  businessName: 'Test Business',
  displayName: null,
  bio: null,
  email: null,
  phone: null,
  logoUrl: null,
  photo: null,
  website: null,
  socials: null,
  clientPortalConfig: {
    theme: 'LIGHT_MODERN',
    brandColour: '#000000',
    heroImage: null,
    showContactPhoto: false,
    showContactEmail: true,
    showContactPhone: false,
  },
};

const mockUserProfile: UserProfile = {
  id: 'profile-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  addressLine1: null,
  addressLine2: null,
  city: null,
  county: null,
  postcode: null,
  country: null,
  latitude: null,
  longitude: null,
  placeId: null,
  travelBaseAddressLine1: null,
  travelBaseAddressLine2: null,
  travelBaseCity: null,
  travelBaseCounty: null,
  travelBasePostcode: null,
  travelBaseCountry: null,
  travelBaseLatitude: null,
  travelBaseLongitude: null,
  travelBasePlaceId: null,
  bankDetails: null,
  vatNumber: null,
  vatRate: 20,
  defaultPaymentTermsDays: 30,
  invoiceNumberSequence: 1,
  invoiceSequenceYear: 2025,
  depositPercentage: null,
  digestEmailEnabled: false,
  songRequestFormEnabled: false,
  preferences: { reminderLeadDays: 7, checklistDefaults: [] },
  onboardingCompletedAt: '2024-01-01T00:00:00.000Z',
};

function renderPage() {
  vi.mocked(api.apiGet).mockImplementation((url: string) => {
    if (url === '/me/public') return Promise.resolve(mockPublicProfile);
    if (url === '/me') return Promise.resolve(mockUserProfile);
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage — notifications section', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the digest email toggle once data loads', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Weekly digest email')).toBeInTheDocument());
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('keeps the digest toggle accessible and keyboard-operable', async () => {
    const user = userEvent.setup();
    renderPage();

    const toggle = await screen.findByRole('switch', { name: /Weekly digest email/ });
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    toggle.focus();
    await user.keyboard('[Space]');

    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('renders the reminder window input with the profile value', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Reminder window')).toBeInTheDocument());

    // mockUserProfile.preferences.reminderLeadDays = 7
    // The input doesn't have an aria-label; select it by its name attribute
    const input = document.querySelector<HTMLInputElement>('input[name="reminderLeadDays"]');
    expect(input).not.toBeNull();
    expect(Number(input!.value)).toBe(7);
  });

  it('renders the days-before-due-date label', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('days before due date')).toBeInTheDocument());
  });
});
