import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import OnboardingChecklistPage from './OnboardingChecklistPage';

// A fresh user's /me, with default goals keyed to the real catalogue so GOAL_SUMMARIES resolve.
const mkGoal = (key: string, label: string, requiredForStatus: string) => ({
  key, label, completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus, dueDateRule: null, enabled: true,
});

const meOnboardingGoals = {
  id: 'user_storybook_test',
  digestEmailEnabled: true,
  onboardingCompletedAt: null,
  preferences: {
    reminderLeadDays: 7,
    checklistDefaults: [
      mkGoal('get_the_quote_accepted', 'Get the quote accepted', 'PROVISIONAL'),
      mkGoal('get_deposit_paid', 'Get the deposit paid', 'CONFIRMED'),
      mkGoal('get_contract_signed', 'Get the contract signed', 'CONFIRMED'),
      mkGoal('get_the_balance_paid', 'Get the balance paid', 'READY'),
      mkGoal('play_the_gig', 'Play the gig', 'COMPLETE'),
      mkGoal('send_thank_you', 'Send thank you', 'COMPLETE'),
    ],
  },
};

const meta = {
  component: OnboardingChecklistPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: {
    msw: {
      handlers: [http.get('/api/me', () => HttpResponse.json(meOnboardingGoals))],
    },
  },
} satisfies Meta<typeof OnboardingChecklistPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('How GigLoop runs your bookings'))[0]).toBeVisible();
    // Reminder orientation copy.
    await expect((await canvas.findAllByText('GigLoop keeps every booking on track'))[0]).toBeVisible();
    // A goal grouped under its predecessor stage, with its "what's included" summary.
    await expect((await canvas.findAllByText('Get the quote accepted'))[0]).toBeVisible();
    await expect((await canvas.findAllByText(/chase the client until they say yes/i))[0]).toBeVisible();
  },
};
