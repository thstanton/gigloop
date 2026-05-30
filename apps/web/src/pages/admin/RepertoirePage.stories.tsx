import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import RepertoirePage from './RepertoirePage';

const meta = {
  component: RepertoirePage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof RepertoirePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSongs: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Fly Me to the Moon')).toBeVisible();
    await expect(canvas.getByText('Autumn Leaves')).toBeVisible();
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/songs', () => HttpResponse.json([]))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/no songs/i)).toBeVisible();
  },
};
