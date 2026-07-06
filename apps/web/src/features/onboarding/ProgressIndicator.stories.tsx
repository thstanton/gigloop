import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ProgressIndicator } from './ProgressIndicator';

const meta = {
  component: ProgressIndicator,
  tags: ['ai-generated'],
} satisfies Meta<typeof ProgressIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstStep: Story = {
  args: { currentPath: '/onboarding/profile' },
};

export const MidFlow: Story = {
  args: { currentPath: '/onboarding/packages' },
  play: async ({ canvas }) => {
    // The active step ("Packages") is emphasised; a later step ("Songs") is not.
    const active = await canvas.findByText('Packages');
    await expect(active).toHaveClass('font-medium');
    const upcoming = await canvas.findByText('Songs');
    await expect(upcoming).not.toHaveClass('font-medium');
  },
};
