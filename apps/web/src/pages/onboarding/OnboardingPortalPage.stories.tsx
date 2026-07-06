import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPortalPage from './OnboardingPortalPage';

const meta = {
  component: OnboardingPortalPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof OnboardingPortalPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('Your portal & branding'))[0]).toBeVisible();
    await expect(
      (await canvas.findAllByText('Skip for now — customise in Settings'))[0],
    ).toBeVisible();
  },
};
