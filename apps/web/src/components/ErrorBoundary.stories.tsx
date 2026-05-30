import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import ErrorBoundary from './ErrorBoundary';

const meta = {
  component: ErrorBoundary,
  tags: ['ai-generated'],
} satisfies Meta<typeof ErrorBoundary>;

export default meta;
type Story = StoryObj<typeof meta>;

function Bomb(): React.ReactNode {
  throw new Error('Test explosion');
}

export const Caught: Story = {
  args: { children: <Bomb /> },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Something went wrong')).toBeVisible();
    await expect(canvas.getByText('Test explosion')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /try again/i })).toBeVisible();
  },
};

export const WithChildren: Story = {
  args: { children: <p>All good here</p> },
};

export const WithCustomFallback: Story = {
  args: {
    children: <Bomb />,
    fallback: <div>Custom error UI</div>,
  },
};
