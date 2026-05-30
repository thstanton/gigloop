import type { Meta, StoryObj } from '@storybook/react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {},
};

export const WithPlaceholder: Story = {
  args: { placeholder: 'Enter your name' },
};

export const Filled: Story = {
  args: { defaultValue: 'Jane Smith' },
};

export const Disabled: Story = {
  args: { value: 'Locked value', disabled: true, readOnly: true },
};
