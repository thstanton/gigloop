import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { LaunchHero } from './HomePage';

const meta = {
  component: LaunchHero,
  tags: ['ai-generated'],
} satisfies Meta<typeof LaunchHero>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('GigMan')).toBeVisible();
    await expect(await canvas.findByText('Get started free')).toBeVisible();
    await expect(await canvas.findByText('Sign in')).toBeVisible();
  },
};
