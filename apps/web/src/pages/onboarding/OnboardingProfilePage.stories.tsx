import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import OnboardingProfilePage from './OnboardingProfilePage';

const meta = {
  component: OnboardingProfilePage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof OnboardingProfilePage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Set up your profile')).toBeVisible();
    await expect(await canvas.findByPlaceholderText(/Smith String Quartet/i)).toBeVisible();
  },
};
