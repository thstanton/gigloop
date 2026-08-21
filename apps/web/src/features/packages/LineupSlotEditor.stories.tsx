import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { LineupSlotEditor, type LineupSlotDraft } from './LineupSlotEditor';

// Band members v1 (#879, ADR-0072 §3): the reusable part-list editor behind a lineup — symmetric
// with PackageForm's set editor, but for free-text roles rather than duration/label sets.
function Harness({ initial = [] }: { initial?: LineupSlotDraft[] }) {
  const [slots, setSlots] = useState<LineupSlotDraft[]>(initial);
  return <LineupSlotEditor slots={slots} onChange={setSlots} />;
}

const meta = {
  component: LineupSlotEditor,
  tags: ['ai-generated'],
  args: { slots: [], onChange: () => {} },
} satisfies Meta<typeof LineupSlotEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke — an empty lineup renders just the "+ Add part" control.
export const Empty: Story = {
  render: () => <Harness />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Parts')).toBeVisible();
    await expect(canvas.getByRole('button', { name: '+ Add part' })).toBeVisible();
    await expect(canvas.queryByLabelText('Role')).toBeNull();
  },
};

// Primary happy path: building a lineup by adding parts and naming their roles.
export const AddingParts: Story = {
  render: () => <Harness />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ Add part' }));
    const firstRole = canvas.getByPlaceholderText('e.g. Saxophone');
    await userEvent.type(firstRole, 'Saxophone');
    await expect(firstRole).toHaveValue('Saxophone');

    await userEvent.click(canvas.getByRole('button', { name: '+ Add part' }));
    const roles = canvas.getAllByPlaceholderText('e.g. Saxophone');
    await expect(roles).toHaveLength(2);
    await userEvent.type(roles[1], 'Drums');
    await expect(roles[1]).toHaveValue('Drums');

    // Removing the first part leaves only the second, re-ordered.
    const removeButtons = canvas.getAllByRole('button', { name: 'Remove part' });
    await userEvent.click(removeButtons[0]);
    await expect(canvas.getAllByPlaceholderText('e.g. Saxophone')).toHaveLength(1);
    await expect(canvas.getByPlaceholderText('e.g. Saxophone')).toHaveValue('Drums');
  },
};
