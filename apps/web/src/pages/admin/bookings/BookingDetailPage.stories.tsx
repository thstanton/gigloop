import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within, screen } from 'storybook/test';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BookingDetailPage from './BookingDetailPage';
import { makeBookingDetailHandlers } from '../../../../.storybook/msw-handlers';

const meta = {
  component: BookingDetailPage,
  tags: ['ai-generated'],
  decorators: [
    (Story) =>
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/admin/bookings/bd1'] },
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: '/admin/bookings/:id', element: React.createElement(Story) }),
        ),
      ),
  ],
} satisfies Meta<typeof BookingDetailPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NewEnquiry: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('NewEnquiry') } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie's Wedding")).toBeVisible();
    await expect(canvas.getByText('Enquiry')).toBeVisible();
  },
};

export const ConfirmedWithContract: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('ConfirmedWithContract') } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie's Wedding")).toBeVisible();
    await expect(canvas.getAllByText('Confirmed')[0]).toBeVisible();
  },
};

export const ReadyToGo: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('ReadyToGo') } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie's Wedding")).toBeVisible();
    await expect(canvas.getAllByText('Ready')[0]).toBeVisible();
  },
};

export const Complete: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('Complete') } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie's Wedding")).toBeVisible();
    await expect(canvas.getAllByText('Complete')[0]).toBeVisible();
  },
};

export const Cancelled: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('Cancelled') } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie's Wedding")).toBeVisible();
    await expect(canvas.getByText('Cancelled')).toBeVisible();
  },
};

export const InSeries: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('InSeries') } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie's Wedding")).toBeVisible();
    await expect(canvas.getByText('Series Invoice')).toBeVisible();
    await expect(canvas.getAllByText('Grand Hotel Monthly Residency')[0]).toBeVisible();
  },
};

// Series assignment was relocated (#528) off the detail page into the Overview atom,
// reached via the strip's "Edit overview" pencil — these drive that new entry point.
export const AddToSeriesNoSeries: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('AddToSeriesNoSeries') } },
  play: async ({ canvas }) => {
    // Radix locks <body> pointer-events while the dialog is open; under full-suite
    // load that effect can race userEvent's CSS guard (the button is genuinely
    // interactive in a real browser). Skip the guard for these dialog interactions.
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await canvas.findByText("Sophie's Wedding");
    await user.click(canvas.getByRole('button', { name: 'Edit overview' }));
    const dialog = within(await screen.findByRole('dialog'));
    await expect(dialog.getByText('Series (optional)')).toBeVisible();
    await expect(dialog.getByRole('button', { name: /existing series/i })).toBeVisible();
    // No assignment change made yet, so the save stays disabled.
    await expect(dialog.getByRole('button', { name: /^save$/i })).toBeDisabled();
  },
};

export const AddToSeriesWithSeries: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('AddToSeriesWithSeries') } },
  play: async ({ canvas }) => {
    // See AddToSeriesNoSeries: skip userEvent's pointer-events guard, which races
    // Radix's <body> lock under full-suite load (line 98 flaked here — #495).
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    await canvas.findByText("Sophie's Wedding");
    await user.click(canvas.getByRole('button', { name: 'Edit overview' }));
    const dialog = within(await screen.findByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: /existing series/i }));
    // Selecting 'existing' reveals the series picker fed by GET /series.
    await expect(dialog.getByRole('combobox', { name: 'Series' })).toBeVisible();
  },
};
