import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  brandColour: '#000000',
  photo: null,
  website: null,
  socials: null,
  portalTheme: 'LIGHT_MODERN',
  portalHeroImage: null,
  showContactPhoto: false,
  showContactEmail: true,
  showContactPhone: false,
};

const mockUserProfile: UserProfile = {
  id: 'profile-1',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  address: null,
  bankDetails: null,
  vatNumber: null,
  defaultPaymentTermsDays: 30,
  invoiceNumberSequence: 1,
  invoiceSequenceYear: 2025,
  depositTrackingMode: 'INVOICE',
  depositPercentage: null,
  digestEmailEnabled: false,
  songRequestFormEnabled: false,
  preferences: { reminderLeadDays: 7, checklistDefaults: [] },
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

  it('renders all six reminder type labels once data loads', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Quote email')).toBeInTheDocument());

    expect(screen.getByText('Contract')).toBeInTheDocument();
    expect(screen.getByText('Deposit invoice')).toBeInTheDocument();
    expect(screen.getByText('Balance invoice')).toBeInTheDocument();
    expect(screen.getByText('Music preference form')).toBeInTheDocument();
    expect(screen.getByText('Thank you email')).toBeInTheDocument();
  });

  it('labels the thank you email reminder as after the event', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Thank you email')).toBeInTheDocument());

    const thankYouLabel = screen.getByText('Thank you email');
    // The row containing this label should say "after" not just "before"
    const row = thankYouLabel.closest('div');
    expect(row).toHaveTextContent('after');
  });

  it('labels all other reminder rows as before the event', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Quote email')).toBeInTheDocument());

    for (const label of ['Quote email', 'Contract', 'Deposit invoice', 'Balance invoice', 'Music preference form']) {
      const row = screen.getByText(label).closest('div');
      expect(row).toHaveTextContent('before');
    }
  });
});
