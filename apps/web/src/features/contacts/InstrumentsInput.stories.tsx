import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { InstrumentsInput } from './InstrumentsInput';

// Declared capability tag list sharing one soft-matched vocabulary with chair roles (#886,
// ADR-0072 §4) — type-ahead via a native <datalist>, add on Enter/comma, remove per tag.

function Controlled({ initial = [] as string[] }: { initial?: string[] }) {
  const [value, setValue] = useState<string[]>(initial);
  return <InstrumentsInput value={value} onChange={setValue} vocabulary={['Saxophone', 'Drums', 'Bass', 'Vocals']} />;
}

const meta = {
  component: InstrumentsInput,
  tags: ['ai-generated'],
  args: { value: [], onChange: () => {}, vocabulary: ['Saxophone', 'Drums', 'Bass', 'Vocals'] },
  render: () => <Controlled />,
} satisfies Meta<typeof InstrumentsInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AddAndRemoveTag: Story = {
  name: 'Typing and pressing Enter adds a tag; the remove button removes it',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByPlaceholderText(/press Enter to add/i);
    await userEvent.type(input, 'Saxophone{Enter}');
    await expect(canvas.getByText('Saxophone')).toBeVisible();
    await expect(input).toHaveValue('');

    await userEvent.click(canvas.getByRole('button', { name: 'Remove Saxophone' }));
    await expect(canvas.queryByText('Saxophone')).not.toBeInTheDocument();
  },
};

export const PreFilled: Story = {
  render: () => <Controlled initial={['Sax', 'Vocals']} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Sax')).toBeVisible();
    await expect(canvas.getByText('Vocals')).toBeVisible();
  },
};
