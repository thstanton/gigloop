import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { CreatedCheckpoint } from './CreatedCheckpoint';

const meta = {
  component: CreatedCheckpoint,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement('div', { className: 'p-6' }, React.createElement(Story))],
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  args: {
    title: 'Smith Wedding',
    onFinish: fn(),
    onContinue: fn(),
  },
} satisfies Meta<typeof CreatedCheckpoint>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Booking created')).toBeVisible();
    await expect(canvas.getByText('Smith Wedding')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Continue setup' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Finish' })).toBeVisible();
  },
};

export const ContinueSetup: Story = {
  name: 'Continue setup rolls into the Builder',
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Continue setup' }));
    await expect(args.onContinue).toHaveBeenCalled();
  },
};

export const Finish: Story = {
  name: 'Finish exits to the booking as-is',
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Finish' }));
    await expect(args.onFinish).toHaveBeenCalled();
  },
};
