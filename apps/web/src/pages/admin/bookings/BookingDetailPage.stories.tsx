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

export const AddToSeriesNoSeries: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('AddToSeriesNoSeries') } },
  play: async ({ canvas }) => {
    await canvas.findByText("Sophie's Wedding");
    await userEvent.click(await canvas.findByText('+ Add to series'));
    const dialog = within(await screen.findByRole('dialog'));
    await expect(dialog.getByRole('heading', { name: 'Add to series' })).toBeVisible();
    await expect(dialog.getByText('No series available')).toBeVisible();
  },
};

export const AddToSeriesWithSeries: Story = {
  parameters: { msw: { handlers: makeBookingDetailHandlers('AddToSeriesWithSeries') } },
  play: async ({ canvas }) => {
    await canvas.findByText("Sophie's Wedding");
    await userEvent.click(await canvas.findByText('+ Add to series'));
    const dialog = within(await screen.findByRole('dialog'));
    await expect(dialog.getByRole('heading', { name: 'Add to series' })).toBeVisible();
    await expect(dialog.getByRole('combobox')).toBeVisible();
  },
};
