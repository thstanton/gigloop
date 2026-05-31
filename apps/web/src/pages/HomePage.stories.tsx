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
    await expect((await canvas.findAllByText('GigMan'))[0]).toBeVisible();
    await expect((await canvas.findAllByText('Get started free'))[0]).toBeVisible();
    await expect((await canvas.findAllByText('Sign in'))[0]).toBeVisible();
  },
};
