import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, screen } from 'storybook/test';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookingBuilderPage from './BookingBuilderPage';
import { makeBuilderHandlers } from '../../../../.storybook/msw-handlers';

// PRD #511 Module C — BookingBuilderPage stories (page-tier: smoke + exit-backstop interaction).
// Smoke verifies the full spine renders; interaction verifies the exit-backstop summary dialog
// fires when Done is clicked with undone concerns and offers a one-tap fix per concern.

const meta = {
  component: BookingBuilderPage,
  tags: ['ai-generated'],
  decorators: [
    (Story) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/admin/bookings/bd1/builder'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, {
            path: '/admin/bookings/:id/builder',
            element: React.createElement(Story),
          }),
          React.createElement(Route, {
            path: '/admin/bookings/:id',
            element: React.createElement('div', null, 'Booking detail'),
          }),
        ),
      ),
  ],
} satisfies Meta<typeof BookingBuilderPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllSections: Story = {
  name: 'Builder — all spine sections render (smoke)',
  parameters: { msw: { handlers: makeBuilderHandlers('FullySet') } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // All eight spine sections render. Each section's <h2> precedes any same-named
    // atom sub-heading in DOM order (the rail uses buttons, not headings), so the
    // first heading match is the section title.
    await canvas.findByRole('heading', { name: 'Overview' });
    await expect(canvas.getAllByRole('heading', { name: 'Overview' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'People' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'Venue' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'Package Templates' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'Itinerary' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'Details' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'Music' })[0]).toBeVisible();
    await expect(canvas.getAllByRole('heading', { name: 'Notes' })[0]).toBeVisible();
    // Completeness rail is present on desktop.
    await expect(canvas.getByText('Sections')).toBeVisible();
    // Done button is accessible.
    const doneButtons = canvas.getAllByRole('button', { name: /^done$/i });
    await expect(doneButtons.length).toBeGreaterThan(0);
  },
};

export const ExitBackstopOnDone: Story = {
  name: 'Builder — exit backstop shows undone concerns when Done is clicked',
  parameters: { msw: { handlers: makeBuilderHandlers('MissingVenue') } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Wait for the Builder to fully load (target the section heading — the label also
    // appears in the completeness rail).
    await canvas.findByRole('heading', { name: 'Overview' });

    // Click the Done button (desktop rail version).
    const doneButtons = canvas.getAllByRole('button', { name: /^done$/i });
    await userEvent.click(doneButtons[doneButtons.length - 1]);

    // The exit-backstop dialog should appear.
    const dialog = within(await screen.findByRole('dialog'));
    await expect(dialog.getByText('A few things still need setting up')).toBeVisible();

    // Venue is listed as an undone concern.
    await expect(dialog.getByText('Venue')).toBeVisible();

    // Each undone concern offers a one-tap fix.
    const setUpButtons = dialog.getAllByRole('button', { name: /set up/i });
    await expect(setUpButtons.length).toBeGreaterThan(0);

    // "Keep editing" dismisses the dialog.
    await userEvent.click(dialog.getByRole('button', { name: /keep editing/i }));
    await expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
};
