import type { Meta, StoryObj } from '@storybook/react';
import { LabelValue } from './LabelValue';

const meta: Meta<typeof LabelValue> = {
  title: 'Common/LabelValue',
  component: LabelValue,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LabelValue>;

export const StringValue: Story = {
  args: {
    label: 'Email',
    children: 'jane@example.com',
  },
};

export const EmptyValue: Story = {
  args: {
    label: 'Notes',
    children: '—',
  },
};

export const MultiLineValue: Story = {
  args: {
    label: 'Address',
    children: (
      <span className="whitespace-pre-wrap">
        {'123 High Street\nLondon\nEC1A 1BB'}
      </span>
    ),
  },
};
