import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPackagesPage from './OnboardingPackagesPage';

const meta = {
  component: OnboardingPackagesPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof OnboardingPackagesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('Choose your packages'))[0]).toBeVisible();
    await expect((await canvas.findAllByText('Duo'))[0]).toBeVisible();
  },
};
