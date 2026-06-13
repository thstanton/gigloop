import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PortalMusicPage from './PortalMusicPage';
import type { PortalData, PortalMusicFormData } from '@/types/api';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const mod = await importOriginal<typeof import('react-router-dom')>();
  return { ...mod, useNavigate: () => mockNavigate };
});

vi.mock('@/lib/portalApi', () => ({
  getPortalData: vi.fn(),
  getMusicFormData: vi.fn(),
  submitMusicForm: vi.fn(),
}));

const mockPortalData: PortalData = {
  booking: {
    id: 'b1',
    date: '2026-08-15T18:00:00Z',
    fee: null,
    title: 'Summer Wedding',
    status: 'CONFIRMED',
    customerName: 'Sarah Johnson',
    customerGreetingName: null,
    venueName: null,
    sets: [],
    formats: [],
    contractSignedAt: null,
  },
  publicProfile: {
    businessName: 'Jazz Trio',
    displayName: null,
    bio: null,
    email: null,
    phone: null,
    logoUrl: null,
    brandColour: '#1a1a1a',
    photo: null,
    portalTheme: null,
    portalHeroImage: null,
    showContactPhoto: false,
    showContactEmail: false,
    showContactPhone: false,
  },
  signedContractUrl: null,
  documents: [],
  hasMusicForm: true,
  hasMusicFormResponse: false,
  contractStatus: null,
  depositInvoiceDueDate: null,
};

const mockMusicFormData: PortalMusicFormData = {
  config: {
    keyMoments: [],
    enabledGenres: ['POP'],
  },
  songs: [{ id: 's1', title: 'Let It Be', artist: 'The Beatles', genre: 'POP' }],
  allSongs: [{ id: 's1', title: 'Let It Be', artist: 'The Beatles', genre: 'POP' }],
  existingResponse: null,
};

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage() {
  render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={['/booking/test-token']}>
        <Routes>
          <Route path="/booking/:token" element={<PortalMusicPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PortalMusicPage — mutation error recovery', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    const { getPortalData, getMusicFormData } = await import('@/lib/portalApi');
    vi.mocked(getPortalData).mockResolvedValue(mockPortalData);
    vi.mocked(getMusicFormData).mockResolvedValue(mockMusicFormData);
  });

  it('shows error and re-enables Submit after failure, navigates away on successful retry', async () => {
    const user = userEvent.setup();
    const { submitMusicForm } = await import('@/lib/portalApi');

    vi.mocked(submitMusicForm)
      .mockRejectedValueOnce(new Response('Internal Server Error', { status: 500 }))
      .mockResolvedValueOnce(undefined);

    renderPage();

    const submitBtn = await screen.findByRole('button', { name: /submit requests/i });

    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
    expect(submitBtn).not.toBeDisabled();

    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/booking/test-token?music=1');
    });
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });
});
