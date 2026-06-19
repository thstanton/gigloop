import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';
import { PackageIcon } from './PackageIcon';

const meta: Meta<typeof PackageIcon> = {
  title: 'Common/PackageIcon',
  component: PackageIcon,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PackageIcon>;

export const Known: Story = {
  args: { icon: 'heart', size: 24 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('svg')).toBeInTheDocument();
  },
};

export const UnknownFallsBackToMusic: Story = {
  args: { icon: 'not-a-real-icon', size: 24 },
};
