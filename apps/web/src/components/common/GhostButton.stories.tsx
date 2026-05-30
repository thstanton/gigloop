import type { Meta, StoryObj } from '@storybook/react';
import { Plus } from 'lucide-react';
import { GhostButton } from './GhostButton';

const meta: Meta<typeof GhostButton> = {
  title: 'Common/GhostButton',
  component: GhostButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof GhostButton>;

export const TextOnly: Story = {
  args: { children: 'Cancel' },
};

export const IconAndText: Story = {
  args: {
    icon: <Plus size={14} />,
    children: 'Add item',
  },
};

export const PrimaryVariant: Story = {
  args: {
    icon: <Plus size={12} />,
    children: 'Add invoice',
    variant: 'primary',
    size: 'xs',
  },
};

export const Disabled: Story = {
  args: {
    icon: <Plus size={14} />,
    children: 'Add item',
    disabled: true,
  },
};
