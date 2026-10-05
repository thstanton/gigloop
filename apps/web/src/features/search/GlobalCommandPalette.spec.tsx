import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { isEnabled, setPreference, appearance } = vi.hoisted(() => ({
  isEnabled: vi.fn((_flag: string) => true),
  setPreference: vi.fn(),
  appearance: { resolved: 'light' as 'light' | 'dark' },
}));
vi.mock('@/lib/featureFlags', () => ({ isEnabled }));
vi.mock('@/lib/hooks/useAppearance', () => ({
  useAppearance: () => ({ preference: 'system', resolved: appearance.resolved, setPreference }),
}));
vi.mock('@/lib/hooks/useSearch', () => ({ useSearch: () => ({ results: [], isLoading: false }) }));
vi.mock('@/lib/recentlyViewed', () => ({ getRecentlyViewed: () => [] }));

import { GlobalCommandPalette } from './GlobalCommandPalette';

function renderPalette(onOpenChange = vi.fn()) {
  render(
    <MemoryRouter>
      <GlobalCommandPalette open onOpenChange={onOpenChange} />
    </MemoryRouter>,
  );
  return onOpenChange;
}

describe('GlobalCommandPalette appearance command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isEnabled.mockReturnValue(true);
    appearance.resolved = 'light';
  });

  it('flips resolved Light to Dark and closes the palette', async () => {
    const onOpenChange = renderPalette();
    await userEvent.type(screen.getByRole('combobox'), 'appearance');
    await userEvent.click(await screen.findByText('Toggle appearance'));
    expect(setPreference).toHaveBeenCalledWith('dark');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('flips resolved Dark to Light', async () => {
    appearance.resolved = 'dark';
    renderPalette();
    await userEvent.type(screen.getByRole('combobox'), 'appearance');
    await userEvent.click(await screen.findByText('Toggle appearance'));
    expect(setPreference).toHaveBeenCalledWith('light');
  });

  it('hides the command when the Appearance flag is off', async () => {
    isEnabled.mockImplementation((flag: string) => flag !== 'VITE_FEATURE_APPEARANCE');
    renderPalette();
    await userEvent.type(screen.getByRole('combobox'), 'appearance');
    expect(screen.queryByText('Toggle appearance')).toBeNull();
  });
});
