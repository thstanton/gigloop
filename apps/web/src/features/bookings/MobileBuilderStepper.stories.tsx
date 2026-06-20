import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { MobileBuilderStepper, type StepperSection } from './MobileBuilderStepper';

// ADR-0051 — the mobile Booking Builder ambient progress stepper. Mobile viewport
// only (mounted md:hidden in the page). A mix of completeness states on the three
// status-bearing concerns exercises all three glyphs (set / partial / unset→empty)
// alongside the five plain position dots.

const sections: StepperSection[] = [
  { id: 'overview',  label: 'Overview',         status: null },
  { id: 'people',    label: 'People',           status: 'set' },     // CheckCircle2
  { id: 'venue',     label: 'Venue',            status: 'unset' },   // Circle
  { id: 'templates', label: 'Package Templates', status: null },
  { id: 'itinerary', label: 'Itinerary',        status: 'partial' }, // MinusCircle
  { id: 'details',   label: 'Details',          status: null },
  { id: 'music',     label: 'Music',            status: null },
  { id: 'notes',     label: 'Notes',            status: null },
];

const meta = {
  component: MobileBuilderStepper,
  tags: ['ai-generated'],
  // fullscreen so the bar renders edge-to-edge (screen-width), matching how the
  // page mounts it fixed/inset-x-0 — Storybook's default canvas padding otherwise
  // makes it look inset.
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile1' } },
  // Stateful wrapper: tapping a node moves the active highlight (the page drives
  // this from scroll position + jump; here we drive it locally to demo the contract).
  render: (args) => {
    const [activeId, setActiveId] = useState(args.activeId);
    return (
      <MobileBuilderStepper
        {...args}
        activeId={activeId}
        onJump={(id) => {
          args.onJump(id);
          setActiveId(id);
        }}
      />
    );
  },
} satisfies Meta<typeof MobileBuilderStepper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { sections, activeId: 'people', onJump: fn() },
  play: async ({ canvas }) => {
    // All eight sections render as tappable nodes.
    const steps = canvas.getAllByRole('button');
    await expect(steps).toHaveLength(8);

    // Three status-bearing concerns show an icon (svg); the other five are plain dots.
    const withIcon = steps.filter((b) => b.querySelector('svg'));
    const withDot = steps.filter((b) => !b.querySelector('svg'));
    await expect(withIcon).toHaveLength(3);
    await expect(withDot).toHaveLength(5);

    // The active section's label is shown as text.
    await expect(canvas.getByText('People')).toBeVisible();
  },
};

export const JumpOnTap: Story = {
  args: { sections, activeId: 'people', onJump: fn() },
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Venue' }));
    // onJump fires with the tapped section…
    await expect(args.onJump).toHaveBeenCalledWith('venue');
    // …and the active highlight + label follow.
    await expect(canvas.getByText('Venue')).toBeVisible();
  },
};
