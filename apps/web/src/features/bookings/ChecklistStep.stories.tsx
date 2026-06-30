import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { ChecklistStep } from './ChecklistStep';
import type { ChecklistDefaultItem, ReminderPreview } from '@/types/api';

const preview: ReminderPreview[] = [
  { key: 'send_quote', label: 'Send the quote', concern: 'people', requiredForStatus: 'PROVISIONAL', autoCompleteHint: null, prerequisites: [] },
  { key: 'create_contract', label: 'Create the contract', concern: 'overview', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, prerequisites: [] },
  { key: 'send_contract', label: 'Send the contract', concern: 'people', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, prerequisites: [{ key: 'create_contract', phrase: 'create the contract' }] },
  { key: 'contract_signed', label: 'Contract signed', concern: 'overview', requiredForStatus: 'CONFIRMED', autoCompleteHint: 'when the client signs in the portal', prerequisites: [{ key: 'send_contract', phrase: 'send the contract' }] },
  { key: 'add_venue', label: 'Confirm the venue', concern: 'venue', requiredForStatus: 'READY', autoCompleteHint: null, prerequisites: [] },
];

const d = (over: Partial<ChecklistDefaultItem> & { key: string | null; label: string }): ChecklistDefaultItem => ({
  completedBy: 'USER', autoCompleteRule: null, requiredForStatus: null, dueDateRule: null, ...over,
});

const checklistDefaults: ChecklistDefaultItem[] = [
  d({ key: 'send_quote', label: 'Send the quote', requiredForStatus: 'PROVISIONAL' }),
  d({ key: 'create_contract', label: 'Create the contract', requiredForStatus: 'CONFIRMED' }),
  d({ key: 'send_contract', label: 'Send the contract', requiredForStatus: 'CONFIRMED' }),
  d({ key: 'contract_signed', label: 'Contract signed', requiredForStatus: 'CONFIRMED' }),
  d({ key: 'add_venue', label: 'Confirm the venue', requiredForStatus: 'READY' }),
  // Global custom defaults from Settings (#561): one tagged to a concern, one concern-less.
  d({ key: null, label: 'Book parking', concern: 'venue', requiredForStatus: null }),
  d({ key: null, label: 'Charge the camera', concern: null, requiredForStatus: null }),
];

const meta = {
  title: 'Bookings/ChecklistStep',
  component: ChecklistStep,
  args: {
    preview,
    isPreviewLoading: false,
    checklistDefaults,
    startingStatus: 'PROVISIONAL',
    onBack: fn(),
    onCreate: fn(),
    isCreating: false,
    isError: false,
  },
} satisfies Meta<typeof ChecklistStep>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Per-concern reminder controls, all on by default',
};

export const Loading: Story = {
  name: 'Loading the preview',
  args: { preview: [], isPreviewLoading: true },
};

export const AddCustomWithStage: Story = {
  name: 'Add a concern-tagged custom with a stage; it lands in the create payload (#560/#568)',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const venue = within(canvas.getByRole('region', { name: 'Venue' }));

    await userEvent.click(venue.getByRole('button', { name: /add your own/i }));
    await userEvent.type(venue.getByPlaceholderText('Item label'), 'Hire the marquee');
    // Pick a stage via the Radix Select (options render in a body portal).
    await userEvent.click(venue.getByRole('combobox'));
    await userEvent.click(await within(document.body).findByRole('option', { name: 'Required for Confirmed' }));
    await userEvent.click(venue.getByRole('button', { name: 'Add' }));

    await userEvent.click(canvas.getByRole('button', { name: 'Create booking' }));
    await expect(args.onCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: null, label: 'Hire the marquee', concern: 'venue', requiredForStatus: 'CONFIRMED' }),
      ]),
    );
  },
};

export const DependencyClauseFollowsSelection: Story = {
  name: '"after you …" clause disappears when the prerequisite is turned off',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // contract_signed depends on send_contract, which depends on create_contract — both clauses show.
    const signedRow = canvas.getByText('Contract signed').closest('li')!;
    await expect(signedRow).toHaveTextContent(/after you send the contract/i);

    // Turn off send_contract (People) → contract_signed's clause drops it.
    const people = within(canvas.getByRole('region', { name: 'People' }));
    const sendRow = people.getByText('Send the contract').closest('li')!;
    await userEvent.click(within(sendRow).getByRole('button', { name: 'Turn off' }));
    await expect(canvas.getByText('Contract signed').closest('li')!).not.toHaveTextContent(/after you send the contract/i);
  },
};

export const GlobalCustomTogglesButStays: Story = {
  name: 'A global custom default toggles off but stays shown (durable item, #561)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // "Book parking" is a concern-tagged global custom — it appears in the Venue section, on.
    const venue = within(canvas.getByRole('region', { name: 'Venue' }));
    const parkingRow = venue.getByText('Book parking').closest('li')!;
    await userEvent.click(within(parkingRow).getByRole('button', { name: 'Turn off' }));
    // Unlike an inline custom it does NOT vanish — it stays shown and re-addable, so its action
    // flips to "Remind me". (Payload exclusion is asserted in the spec.)
    await expect(venue.getByText('Book parking')).toBeVisible();
    await expect(within(venue.getByText('Book parking').closest('li')!).getByRole('button', { name: 'Remind me' })).toBeVisible();
  },
};
