import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Name' });
    await expect(input).toHaveAttribute('aria-required', 'true');
  },
};

export const WithError: Story = {
  args: {
    label: 'Email address',
    required: true,
    error: 'Invalid email address',
    children: <Input placeholder="you@example.com" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Email address' });
    const errorMsg = canvas.getByText('Invalid email address');
    await expect(errorMsg).toHaveAttribute('id');
    await expect(input).toHaveAttribute('aria-describedby', errorMsg.id);
  },
};

export const WithHint: Story = {
  args: {
    label: 'Your name',
    hint: 'The personal name that signs your emails and contracts.',
    children: <Input placeholder="Jane Smith" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Your name' });
    const hint = canvas.getByText('The personal name that signs your emails and contracts.');
    await expect(input).toHaveAttribute('aria-describedby', hint.id);
  },
};

export const WithHintAndError: Story = {
  args: {
    label: 'Your name',
    hint: 'The personal name that signs your emails and contracts.',
    error: 'This name is already taken',
    children: <Input placeholder="Jane Smith" />,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('textbox', { name: 'Your name' });
    const hint = canvas.getByText('The personal name that signs your emails and contracts.');
    const errorMsg = canvas.getByText('This name is already taken');
    await expect(input).toHaveAttribute('aria-describedby', `${hint.id} ${errorMsg.id}`);
  },
};

export const DisabledInput: Story = {
  args: {
    label: 'Account email',
    children: <Input value="locked@example.com" disabled />,
  },
};
