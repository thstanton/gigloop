import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const meta = {
  component: DashboardPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof DashboardPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBookings: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('Grand Hotel Summer Ball'))[0]).toBeVisible();
  },
};

export const NoUpcomingGigs: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings', () => HttpResponse.json([])),
        http.get('/api/bookings/actions', () => HttpResponse.json([])),
        // TipsWidgetContainer fetches these — mock them so no request leaks to the network.
        http.get('/api/me', () => HttpResponse.json({})),
        http.get('/api/me/public', () => HttpResponse.json({})),
        http.get('/api/packages', () => HttpResponse.json([])),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText(/no upcoming gigs/i))[0]).toBeVisible();
  },
};
