import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import OnboardingSongsPage from './OnboardingSongsPage';

const meta = {
  component: OnboardingSongsPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
} satisfies Meta<typeof OnboardingSongsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('Add songs to your repertoire'))[0]).toBeVisible();
    await expect((await canvas.findAllByText('Contemporary'))[0]).toBeVisible();
  },
};
