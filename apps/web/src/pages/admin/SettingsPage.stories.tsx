import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import { allHandlers, meOnboarding } from '../../../.storybook/msw-handlers';

const meta = {
  component: SettingsPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof SettingsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Business details')).toBeVisible();
  },
};

// #615: the checklist configurator renders its system goals from the fetched backend defaults
// (/me preferences.checklistDefaults) — no hardcoded duplicate list. This profile carries a
// representative slice of the goal catalogue across lifecycle stages plus a custom global item;
// the story proves those goal labels (and the custom item) come through from the fetched data.
const meWithChecklistDefaults = {
  ...meOnboarding,
  onboardingCompletedAt: '2024-01-01T00:00:00Z',
  songRequestFormEnabled: true,
  preferences: {
    reminderLeadDays: 7,
    checklistDefaults: [
      { key: 'send_quote', label: 'Send quote', completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus: 'PROVISIONAL', dueDateRule: { basis: 'bookingCreation', offsetDays: 2 } },
      { key: 'get_deposit_paid', label: 'Get the deposit paid', completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', dueDateRule: { basis: 'bookingDate', offsetDays: -30 } },
      { key: 'gather_song_requests', label: 'Gather song requests', completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus: 'READY', dueDateRule: { basis: 'bookingDate', offsetDays: -30 } },
      { key: 'send_thank_you', label: 'Send thank you', completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus: 'COMPLETE', dueDateRule: { basis: 'bookingDate', offsetDays: 7 } },
      { key: null, label: 'Book parking', completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', dueDateRule: null, concern: 'venue' },
    ],
  },
};

export const ChecklistDefaultsFromBackend: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/me', () => HttpResponse.json(meWithChecklistDefaults)),
        ...allHandlers,
      ],
    },
  },
  play: async ({ canvas }) => {
    // System goals rendered from the fetched defaults, across stages
    await expect(await canvas.findByText('Get the deposit paid')).toBeVisible();
    await expect(await canvas.findByText('Gather song requests')).toBeVisible();
    await expect(await canvas.findByText('Send thank you')).toBeVisible();
    // Custom global-template item still renders
    await expect(await canvas.findByText('Book parking')).toBeVisible();
  },
};
