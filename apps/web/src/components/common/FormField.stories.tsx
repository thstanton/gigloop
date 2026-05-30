import type { Meta, StoryObj } from '@storybook/react';
import { FormField } from './FormField';
import { Input } from '@/components/ui/input';

const meta: Meta<typeof FormField> = {
  title: 'Common/FormField',
  component: FormField,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FormField>;

export const Default: Story = {
  args: {
    label: 'Email address',
    children: <Input placeholder="you@example.com" />,
  },
};

export const Required: Story = {
  args: {
    label: 'Name',
    required: true,
    children: <Input placeholder="Jane Smith" />,
  },
};

export const WithError: Story = {
  args: {
    label: 'Email address',
    required: true,
    error: 'Invalid email address',
    children: <Input placeholder="you@example.com" />,
  },
};

export const DisabledInput: Story = {
  args: {
    label: 'Account email',
    children: <Input value="locked@example.com" disabled />,
  },
};
