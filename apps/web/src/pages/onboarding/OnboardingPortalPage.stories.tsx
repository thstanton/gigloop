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
    // The portal is link-gated — the subheading must say so (#700)
    await expect(
      (await canvas.findAllByText(/sees it only when you share the link/))[0],
    ).toBeVisible();
    // Walkthrough sections (the hero-image step only appears for Bold themes)
    await expect(await canvas.findByText('Pick a theme')).toBeVisible();
    await expect(canvas.getByText('Choose your brand colour')).toBeVisible();
    await expect(canvas.getByText('Add your logo')).toBeVisible();
    // Embedded live preview + expand affordance
    await expect(canvas.getByText('Full preview')).toBeVisible();
    await expect(
      (await canvas.findAllByText('Skip for now — customise in Settings'))[0],
    ).toBeVisible();
  },
};
