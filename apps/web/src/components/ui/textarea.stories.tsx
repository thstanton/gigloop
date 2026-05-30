import type { Meta, StoryObj } from '@storybook/react';
import { Textarea } from './textarea';

const meta: Meta<typeof Textarea> = {
  title: 'UI/Textarea',
  component: Textarea,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {
  args: { rows: 2, placeholder: 'Write something…' },
};

export const Filled: Story = {
  args: { rows: 2, defaultValue: 'The quick brown fox jumps over the lazy dog.' },
};

export const TallRows: Story = {
  args: { rows: 4, placeholder: 'Longer note area' },
};

export const Disabled: Story = {
  args: { rows: 2, value: 'Read-only content', disabled: true, readOnly: true },
};
