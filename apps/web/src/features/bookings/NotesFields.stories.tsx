import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { NotesField } from './NotesFields';

// The shared Notes core (ADR-0053 / #548): a controlled textarea bubbling its value via onChange.
// Controlled harness mirrors the create-form regime (RHF owns the value); the spy lets stories
// assert what bubbled. The self-saving variant is covered by InlineNotes.stories.

function Harness({ onChange, initial = '' }: { onChange: (v: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div className="max-w-xl">
      <NotesField
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange(next);
        }}
      />
    </div>
  );
}

const meta: Meta<typeof NotesField> = {
  component: NotesField,
  tags: ['ai-generated'],
  args: { onChange: fn() },
  render: (args) => <Harness onChange={args.onChange} />,
};

export default meta;
type Story = StoryObj<typeof NotesField>;

export const EditBubbles: Story = {
  name: 'Typing into the notes textarea bubbles the value',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const notes = canvas.getByPlaceholderText('Add notes about this booking…');
    await expect(notes).toBeVisible();
    await userEvent.type(notes, 'Load-in via the rear entrance');
    await expect(notes).toHaveValue('Load-in via the rear entrance');
    await expect(args.onChange).toHaveBeenLastCalledWith('Load-in via the rear entrance');
  },
};
