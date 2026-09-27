import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import TemplatesListPage from './TemplatesListPage';
import * as api from '@/lib/api';
import type { Template } from '@/types/api';

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
}));

vi.mock('@/lib/api');

const templates: Template[] = [
  { id: 'quote', createdAt: '', updatedAt: '', name: 'Quote', content: {}, builtInType: 'quote' },
  { id: 'invite', createdAt: '', updatedAt: '', name: 'Invite', content: {}, builtInType: 'band_invite' },
  { id: 'invite-message', createdAt: '', updatedAt: '', name: 'Invite message', content: {}, builtInType: 'band_invite_message' },
  { id: 'call-sheet-message', createdAt: '', updatedAt: '', name: 'Call sheet message', content: {}, builtInType: 'band_call_sheet_message' },
  { id: 'final-details-message', createdAt: '', updatedAt: '', name: 'Final details message', content: {}, builtInType: 'band_final_details_message' },
];

function renderTemplatesPage() {
  vi.mocked(api.apiGet).mockResolvedValue(templates as never);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <TemplatesListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TemplatesListPage band templates', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

  it('hides band templates when the feature flag is off', async () => {
    vi.stubEnv('VITE_FEATURE_BAND_MEMBERS', 'false');
    renderTemplatesPage();

    expect(await screen.findByText('Quote')).toBeInTheDocument();
    expect(screen.queryByText('Messages')).not.toBeInTheDocument();
    expect(screen.queryByText('Band invitation email')).not.toBeInTheDocument();
    expect(screen.queryByText('Band invitation message')).not.toBeInTheDocument();
  });

  it('lists email and copy-paste message templates when the feature flag is on', async () => {
    vi.stubEnv('VITE_FEATURE_BAND_MEMBERS', 'true');
    renderTemplatesPage();

    expect(await screen.findByText('Band invitation email')).toBeInTheDocument();
    expect(screen.getByText('Messages')).toBeInTheDocument();
    expect(screen.getByText('Band invitation message')).toBeInTheDocument();
    expect(screen.getByText('Band call sheet message')).toBeInTheDocument();
    expect(screen.getByText('Band final details message')).toBeInTheDocument();
  });
});
