import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import BookingsListPage from './BookingsListPage';

const meta = {
  component: BookingsListPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof BookingsListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBookings: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('Grand Hotel Summer Ball'))[0]).toBeVisible();
    await expect((await canvas.findAllByText('Confirmed'))[0]).toBeVisible();
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/bookings', () => HttpResponse.json([]))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/no bookings/i)).toBeVisible();
  },
};

export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/bookings', () => new HttpResponse(null, { status: 500 }))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/failed to load/i)).toBeVisible();
  },
};
