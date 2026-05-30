import type { Meta, StoryObj } from '@storybook/react';
import { DatePicker } from './date-picker';

const meta: Meta<typeof DatePicker> = {
  title: 'UI/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Empty: Story = {
  args: {
    value: '',
    onChange: () => {},
    placeholder: 'Pick a date',
  },
};

export const WithValue: Story = {
  args: {
    value: '2026-08-15',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    value: '2026-08-15',
    onChange: () => {},
    disabled: true,
  },
};
