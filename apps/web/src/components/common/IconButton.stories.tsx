import type { Meta, StoryObj } from '@storybook/react';
import { Pencil, Trash2, Send as SendIcon } from 'lucide-react';
import { IconButton } from './IconButton';

const meta: Meta<typeof IconButton> = {
  title: 'Common/IconButton',
  component: IconButton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    label: 'Edit',
    children: <Pencil size={14} />,
  },
};

export const Destructive: Story = {
  args: {
    label: 'Delete',
    children: <Trash2 size={14} />,
  },
};

export const SendAction: Story = {
  args: {
    label: 'Send',
    children: <SendIcon size={14} />,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Edit (disabled)',
    disabled: true,
    children: <Pencil size={14} />,
  },
};
