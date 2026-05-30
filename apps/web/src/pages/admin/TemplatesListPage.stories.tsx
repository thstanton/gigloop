import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import TemplatesListPage from './TemplatesListPage';

const meta = {
  component: TemplatesListPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof TemplatesListPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTemplates: Story = {
  play: async ({ canvas }) => {
    // Templates show TEMPLATE_DISPLAY names, not template.name
    await expect(await canvas.findByText('Booking confirmation')).toBeVisible();
    await expect(canvas.getByText('Quote')).toBeVisible();
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/templates', () => HttpResponse.json([]))],
    },
  },
};
