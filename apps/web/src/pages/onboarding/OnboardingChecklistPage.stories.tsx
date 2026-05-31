import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { meOnboarding } from '../../../.storybook/msw-handlers';
import OnboardingChecklistPage from './OnboardingChecklistPage';

const meta = {
  component: OnboardingChecklistPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/me', () => HttpResponse.json(meOnboarding)),
      ],
    },
  },
} satisfies Meta<typeof OnboardingChecklistPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('Booking checklist defaults'))[0]).toBeVisible();
    await expect((await canvas.findAllByText('Send quote'))[0]).toBeVisible();
  },
};
