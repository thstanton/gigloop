import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';

const publicProfile = {
  id: 'pp1',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  businessName: 'Jane Smith Music',
  displayName: 'Jane Smith',
  bio: null,
  email: 'jane@example.com',
  phone: null,
  logoUrl: null,
  photo: null,
  website: null,
  socials: null,
  clientPortalConfig: {
    theme: 'LIGHT_MODERN',
    brandColour: '#000000',
    heroImage: null,
    showContactPhoto: false,
    showContactEmail: true,
    showContactPhone: true,
  },
};

const meta = {
  component: SettingsPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/me/public', () => HttpResponse.json(publicProfile)),
      ],
    },
  },
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findByText('Business details'))).toBeVisible();
  },
};
