import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { isEnabled } = vi.hoisted(() => ({ isEnabled: vi.fn((_flag: string) => true) }));
vi.mock('@/lib/featureFlags', () => ({ isEnabled }));
vi.mock('@/lib/api', () => ({ apiGet: vi.fn().mockResolvedValue({ businessName: 'Band', photo: null }) }));
vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true }),
  useClerk: () => ({ signOut: vi.fn() }),
  useUser: () => ({ user: { firstName: 'Tim', lastName: 'S', primaryEmailAddress: { emailAddress: 't@x.com' } } }),
}));
vi.mock('@/features/search/GlobalCommandPalette', () => ({ GlobalCommandPalette: () => null }));

import AppShell from './AppShell';
import { APPEARANCE_STORAGE_KEY } from '@/lib/hooks/useAppearance';

function renderShell() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AppShell />}>
            <Route index element={<div>Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AppShell appearance control', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  it('shows the control in the account menu and the More sheet, and changes the stored preference', async () => {
    isEnabled.mockReturnValue(true);
    renderShell();

    await userEvent.click(screen.getByText('Tim S'));
    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(window.localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();

    await userEvent.click(screen.getByRole('button', { name: /More/ }));
    // The open sheet is modal, so the account-menu copy is aria-hidden; count both with `hidden`.
    expect(screen.getByRole('radiogroup', { name: 'Appearance' })).toBeInTheDocument();
    expect(screen.getAllByRole('radiogroup', { name: 'Appearance', hidden: true })).toHaveLength(2);
  });

  it('hides the control everywhere when the Appearance flag is off', async () => {
    isEnabled.mockImplementation((flag: string) => flag !== 'VITE_FEATURE_APPEARANCE');
    renderShell();

    await userEvent.click(screen.getByText('Tim S'));
    await userEvent.click(screen.getByRole('button', { name: /More/ }));
    expect(screen.queryByRole('radiogroup', { name: 'Appearance' })).toBeNull();
  });
});
