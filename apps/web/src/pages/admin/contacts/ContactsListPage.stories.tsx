import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import ContactsListPage from './ContactsListPage';

const meta = {
  component: ContactsListPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof ContactsListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithContacts: Story = {
  play: async ({ canvas }) => {
    // Component renders both desktop table and mobile card list, so multiple elements
    const matches = await canvas.findAllByText('The Grand Hotel');
    await expect(matches[0]).toBeVisible();
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => HttpResponse.json([]))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No contacts yet')).toBeVisible();
  },
};

export const LoadError: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => new HttpResponse(null, { status: 500 }))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/failed to load/i)).toBeVisible();
  },
};
