import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
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
    await expect(canvas.getByText('Confirmed')).toBeVisible();
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
