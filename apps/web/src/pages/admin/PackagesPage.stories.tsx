import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import PackagesPage from './PackagesPage';

const meta = {
  component: PackagesPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof PackagesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithPackages: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Wedding Package')).toBeVisible();
    await expect(canvas.getByText('Corporate Dinner')).toBeVisible();

    // #883, ADR-0072 §3: VITE_FEATURE_BAND_MEMBERS is unset in Storybook, so the Lineups tab must
    // not render at all — not just be unreachable, but genuinely absent from the page.
    await expect(canvas.queryByRole('tab', { name: 'Lineups' })).toBeNull();
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/packages', () => HttpResponse.json([]))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/no package templates/i)).toBeVisible();
  },
};
