import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import InlineNotes from './InlineNotes';

const meta = {
  component: InlineNotes,
  tags: ['ai-generated'],
  args: {
    onSave: () => {},
    isSaving: false,
  },
} satisfies Meta<typeof InlineNotes>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { notes: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByPlaceholderText('Add notes about this booking…')).toBeVisible();
  },
};

export const PreFilled: Story = {
  args: { notes: 'Client prefers jazz. Avoid anything too loud after 10pm.' },
  play: async ({ canvas }) => {
    await expect(canvas.getByDisplayValue('Client prefers jazz. Avoid anything too loud after 10pm.')).toBeVisible();
  },
};

export const Saving: Story = {
  args: { notes: 'Some notes', isSaving: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Saving…')).toBeVisible();
  },
};
