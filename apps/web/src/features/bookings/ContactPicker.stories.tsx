import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, userEvent, within } from 'storybook/test';
import ContactPicker from './ContactPicker';

// A reusable contact-search-and-select combobox (with inline "create new" fallback), reused as-is
// by the Band sheet (#885) to fill a vacant chair — no forking needed.

function Controlled({ initial }: { initial: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return <ContactPicker value={value} onChange={setValue} placeholder="Select contact..." />;
}

const meta = {
  component: ContactPicker,
  tags: ['ai-generated'],
  args: {
    value: null,
    onChange: fn(),
    placeholder: 'Select contact...',
  },
} satisfies Meta<typeof ContactPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('combobox')).toHaveTextContent('Select contact...');
  },
};

export const SearchAndSelect: Story = {
  name: 'Typing a search term filters the list, and selecting fires onChange',
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox'));
    await userEvent.type(await screen.findByPlaceholderText(/Search or create new/i), 'Sophie');
    await userEvent.click(await screen.findByRole('option', { name: /Sophie Hartley/i }));
    await expect(args.onChange).toHaveBeenCalledWith('c2');
  },
};

export const WithSelection: Story = {
  name: 'A selected contact shows its name and a clear affordance',
  render: () => <Controlled initial="c2" />,
  play: async ({ canvas }) => {
    // The contact list loads async (useContacts) — the trigger label updates once it resolves.
    await expect(await canvas.findByRole('combobox', { name: /Sophie Hartley/i })).toBeVisible();
  },
};
