import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPackagesPage from './OnboardingPackagesPage';

const meta = {
  component: OnboardingPackagesPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof OnboardingPackagesPage>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke — the step's title, the concept callout, and the catalogue starters render.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('What you offer'))[0]).toBeVisible();
    await expect(canvas.getByText('Package Templates')).toBeVisible();
    await expect(await canvas.findByRole('button', { name: 'Wedding Ceremony' })).toBeVisible();
  },
};

// Primary flow — picking a booking type reveals the inline editor pre-filled with that starter,
// and enables "Save & continue".
export const ConfiguresOneTemplate: Story = {
  play: async ({ canvas }) => {
    // No editor until a starter is chosen, and Save is disabled.
    await expect(canvas.getByRole('button', { name: 'Save & continue' })).toBeDisabled();

    await userEvent.click(await canvas.findByRole('button', { name: 'Corporate Dinner' }));

    // The inline PackageForm appears pre-filled with the chosen starter's label.
    await expect(await canvas.findByDisplayValue('Corporate Dinner')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Save & continue' })).toBeEnabled();
  },
};
