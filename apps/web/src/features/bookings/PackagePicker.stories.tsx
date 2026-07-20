import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { PackagePicker } from './PackagePicker';
import type { PackageTemplate } from '@/types/api';

function tmpl(over: Partial<PackageTemplate> & { id: string; label: string; category: string }): PackageTemplate {
  return {
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    icon: 'music',
    keyMoments: [],
    defaultGenreSelection: [],
    notes: null,
    isSystemDefault: false,
    enabled: true,
    slots: [{ id: `${over.id}-s1`, label: 'Set 1', duration: 45, order: 0 }],
    ...over,
  };
}

const TEMPLATES: PackageTemplate[] = [
  tmpl({
    id: 't1', label: 'Wedding Ceremony', category: 'WEDDING', icon: 'church',
    slots: [
      { id: 't1-a', label: 'Processional', duration: 5, order: 0 },
      { id: 't1-b', label: 'Recessional', duration: 5, order: 1 },
    ],
    defaultGenreSelection: ['Classical', 'Acoustic'],
    keyMoments: ['First kiss'],
  }),
  tmpl({ id: 't2', label: 'Evening Reception', category: 'WEDDING', icon: 'moon' }),
  tmpl({ id: 't3', label: 'Conference Day', category: 'CORPORATE', icon: 'briefcase' }),
];

// Controlled harness mirroring the host (create/Builder) that owns the selection.
function Harness({
  onToggle,
  showMusic,
  templates = TEMPLATES,
  initialSelected = [],
}: {
  onToggle: (id: string) => void;
  showMusic: boolean;
  templates?: PackageTemplate[];
  initialSelected?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  return (
    <PackagePicker
      templates={templates}
      eventType="WEDDING"
      selectedIds={selected}
      onToggle={(id) => { setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id])); onToggle(id); }}
      showMusic={showMusic}
    />
  );
}

const meta: Meta<typeof PackagePicker> = {
  component: PackagePicker,
  tags: ['ai-generated'],
  args: { onToggle: fn(), showMusic: true },
  render: (args) => <Harness onToggle={args.onToggle} showMusic={args.showMusic ?? true} />,
};

export default meta;
type Story = StoryObj<typeof PackagePicker>;

export const Grouping: Story = {
  name: 'Matching templates lead; non-matching collapse under "Other packages"',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wedding templates (matching the event type) are visible up front. Exact names target the
    // select chip, not its sibling "Preview …" eye button.
    await expect(canvas.getByRole('button', { name: 'Wedding Ceremony' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Evening Reception' })).toBeVisible();
    // The corporate one is tucked under "Other packages" until expanded.
    await expect(canvas.queryByRole('button', { name: 'Conference Day' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: /Other packages \(1\)/i }));
    await expect(canvas.getByRole('button', { name: 'Conference Day' })).toBeVisible();
  },
};

export const SelectedOtherIsNeverHidden: Story = {
  name: 'A selected non-matching template is visible without expanding "Other packages"',
  // The invariant behind #755: creating a template inline from the New Booking form auto-selects
  // it, and an off-category one lands in "Other". If the group stayed collapsed the package would
  // be applied to the booking with nothing on screen to say so.
  render: (args) => (
    <Harness onToggle={args.onToggle} showMusic={args.showMusic ?? true} initialSelected={['t3']} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Visible immediately — no click on the "Other packages" toggle first.
    const conference = canvas.getByRole('button', { name: 'Conference Day' });
    await expect(conference).toBeVisible();
    await expect(conference).toHaveAttribute('aria-pressed', 'true');
    // And the group reads as expanded.
    await expect(canvas.getByRole('button', { name: /▾ Other packages \(1\)/i })).toBeVisible();
  },
};

export const EmptyLibrary: Story = {
  name: 'Empty library reads as "not yet", not as a dead end',
  render: (args) => <Harness onToggle={args.onToggle} showMusic={args.showMusic ?? true} templates={[]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No package templates yet.')).toBeVisible();
  },
};

export const Multiselect: Story = {
  name: 'Multiselect: clicking chips toggles selection on and off',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const ceremony = canvas.getByRole('button', { name: 'Wedding Ceremony' });
    await userEvent.click(ceremony);
    await expect(ceremony).toHaveAttribute('aria-pressed', 'true');
    await expect(args.onToggle).toHaveBeenCalledWith('t1');

    const evening = canvas.getByRole('button', { name: 'Evening Reception' });
    await userEvent.click(evening);
    await expect(evening).toHaveAttribute('aria-pressed', 'true');

    // Clicking again deselects.
    await userEvent.click(ceremony);
    await expect(ceremony).toHaveAttribute('aria-pressed', 'false');
  },
};

export const PreviewShowsMusic: Story = {
  name: 'Preview lists sets and (when music is on) the named genres + special requests',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Preview Wedding Ceremony/i }));
    await expect(canvas.getByText('Processional')).toBeVisible();
    await expect(canvas.getByText(/Genres the client can request songs from/i)).toBeVisible();
    await expect(canvas.getByText('Classical')).toBeVisible();
    await expect(canvas.getByText('First kiss')).toBeVisible();
  },
};

export const PreviewHidesMusicWhenOff: Story = {
  name: 'Preview hides the music-form section when the song-request form is off',
  args: { showMusic: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /Preview Wedding Ceremony/i }));
    await expect(canvas.getByText('Processional')).toBeVisible();
    await expect(canvas.queryByText(/Genres the client can request songs from/i)).toBeNull();
  },
};
