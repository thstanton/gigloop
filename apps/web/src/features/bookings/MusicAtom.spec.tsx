import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MusicAtom, type MusicAtomProps } from './MusicAtom';
import type { MusicFormConfig } from '@/types/api';

// #535 Gap D: the atom re-syncs local state from `config` when the config changes AND the atom is
// not dirty, so the accept-suggestion path (config A → A+B) is not silently clobbered by a later
// Save — while a genuine mid-edit is preserved. This needs a prop rerender, so it lives here rather
// than in a Storybook play.

const baseConfig: MusicFormConfig = {
  id: 'mfc1',
  bookingId: 'b1',
  keyMoments: [{ label: 'First dance', section: 'Other' }],
  enabledGenres: ['CONTEMPORARY'],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

function renderAtom(config: MusicFormConfig, overrides: Partial<MusicAtomProps> = {}) {
  const props: MusicAtomProps = {
    hasMusicFormConfig: true,
    config,
    packages: [],
    onSave: vi.fn(),
    onTurnOn: vi.fn(),
    onTurnOff: vi.fn(),
    isSaving: false,
    saved: false,
    saveError: null,
    isTurningOn: false,
    isTurningOff: false,
    ...overrides,
  };
  return render(<MusicAtom {...props} />);
}

describe('MusicAtom — Gap D config re-sync', () => {
  it('adopts an updated config when the atom is not dirty (accept-suggestion path)', () => {
    const { rerender } = renderAtom(baseConfig);
    expect(screen.getByDisplayValue('First dance')).toBeInTheDocument();

    // A suggestion is accepted elsewhere: config gains a moment without any local edit here.
    const grown: MusicFormConfig = {
      ...baseConfig,
      keyMoments: [...baseConfig.keyMoments, { label: 'Cake cutting', section: 'Other' }],
    };
    rerender(
      <MusicAtom
        hasMusicFormConfig
        config={grown}
        packages={[]}
        onSave={vi.fn()}
        onTurnOn={vi.fn()}
        onTurnOff={vi.fn()}
        isSaving={false}
        saved={false}
        saveError={null}
        isTurningOn={false}
        isTurningOff={false}
      />,
    );

    // The new moment is adopted into the editor rather than dropped.
    expect(screen.getByDisplayValue('Cake cutting')).toBeInTheDocument();
    expect(screen.getByDisplayValue('First dance')).toBeInTheDocument();
  });

  it('preserves a mid-edit when the config changes underneath it', async () => {
    const user = userEvent.setup();
    const { rerender } = renderAtom(baseConfig);

    // User edits the moment label locally (now dirty).
    const input = screen.getByDisplayValue('First dance');
    await user.clear(input);
    await user.type(input, 'Bridal entrance');

    // A background config change arrives while the edit is unsaved.
    const grown: MusicFormConfig = {
      ...baseConfig,
      keyMoments: [...baseConfig.keyMoments, { label: 'Cake cutting', section: 'Other' }],
    };
    rerender(
      <MusicAtom
        hasMusicFormConfig
        config={grown}
        packages={[]}
        onSave={vi.fn()}
        onTurnOn={vi.fn()}
        onTurnOff={vi.fn()}
        isSaving={false}
        saved={false}
        saveError={null}
        isTurningOn={false}
        isTurningOff={false}
      />,
    );

    // The mid-edit survives — the atom did not clobber it with the incoming config.
    expect(screen.getByDisplayValue('Bridal entrance')).toBeInTheDocument();
  });
});
