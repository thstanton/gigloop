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

const d = (over: Partial<ChecklistDefaultItem> & { key: string; label: string }): ChecklistDefaultItem => ({
  completedBy: 'USER', dependsOn: [], autoCompleteRule: null, requiredForStatus: null, dueDateRule: null, ...over,
});

const checklistDefaults: ChecklistDefaultItem[] = [
  d({ key: 'send_quote', label: 'Send the quote', requiredForStatus: 'PROVISIONAL' }),
  d({ key: 'create_contract', label: 'Create the contract', requiredForStatus: 'CONFIRMED' }),
  d({ key: 'send_contract', label: 'Send the contract', requiredForStatus: 'CONFIRMED', dependsOn: ['create_contract'] }),
  d({ key: 'contract_signed', label: 'Contract signed', requiredForStatus: 'CONFIRMED', dependsOn: ['send_contract'] }),
  d({ key: 'add_venue', label: 'Confirm the venue', requiredForStatus: 'READY' }),
];

const meta = {
  title: 'Bookings/ChecklistStep',
  component: ChecklistStep,
  args: {
    preview,
    isPreviewLoading: false,
    checklistDefaults,
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
