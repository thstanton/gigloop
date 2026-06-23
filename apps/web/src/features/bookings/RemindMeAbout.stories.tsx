import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RemindMeAbout } from './RemindMeAbout';
import type { ApplicableReminder } from '@/types/api';

// A full-range set so the reusable control is reviewable beyond the Venue tracer (which renders
// just `add_venue`): on, off-skipped, off-discoverable, and a custom item with no tied status.
const reminders: ApplicableReminder[] = [
  // Discoverable system reminder, never seeded → off, turning on seeds on demand.
  { itemId: null, key: 'add_venue', label: 'Confirm the venue', on: false, source: 'system', state: null, requiredForStatus: 'READY', autoCompleteHint: null, after: null },
  // Tracked.
  { itemId: '1', key: 'send_contract', label: 'Send the contract', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, after: null },
  // On + complete — still reads "on" (no lifecycle shown; that's the checklist's job).
  { itemId: '2', key: 'send_quote', label: 'Send the quote', on: true, source: 'system', state: 'COMPLETE', requiredForStatus: 'PROVISIONAL', autoCompleteHint: null, after: null },
  // Client-committed milestone (#567): carries an auto-complete condition, shown after a tick icon.
  { itemId: '5', key: 'contract_signed', label: 'Contract signed', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'CONFIRMED', autoCompleteHint: 'when the client signs in the portal', after: null },
  // User-skipped, was seeded → off, re-enableable.
  { itemId: '3', key: 'send_thank_you', label: 'Send a thank-you', on: false, source: 'system', state: 'SKIPPED', requiredForStatus: 'COMPLETE', autoCompleteHint: null, after: null },
  // Custom concern-tagged reminder, no tied status.
  { itemId: '4', key: null, label: 'Order the celebration cake', on: true, source: 'custom', state: 'PENDING', requiredForStatus: null, autoCompleteHint: null, after: null },
];

const meta = {
  component: RemindMeAbout,
  tags: ['ai-generated'],
  args: {
    reminders,
    onToggle: fn(),
  },
} satisfies Meta<typeof RemindMeAbout>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FullRange: Story = {
  name: 'Full range: tracked, skipped, discoverable, custom',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Header + every row's label renders.
    await expect(canvas.getByText('Remind me about')).toBeInTheDocument();
    await expect(canvas.getByText('Confirm the venue')).toBeInTheDocument();
    await expect(canvas.getByText('Order the celebration cake')).toBeInTheDocument();
    // Coaching sub-line names the *preceding* status (work done during that stage) — scoped to one
    // row since several CONFIRMED-staged reminders all coach "Provisional".
    await expect(
      within(canvas.getByText('Send the contract').closest('li')!).getByText('Provisional'),
    ).toBeInTheDocument(); // send_contract → prereq for Confirmed → done during Provisional
    await expect(canvas.getByText('Confirm the venue').closest('li')).toHaveTextContent(/Could remind you when the booking is Confirmed/);
    // A client-committed milestone carries its auto-complete condition (#567).
    await expect(canvas.getByText('Contract signed').closest('li')).toHaveTextContent(
      'when the client signs in the portal',
    );
  },
};

export const ToggleFires: Story = {
  name: 'Toggling a row calls onToggle with that reminder',
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    // A tracked row offers "Turn off"; a discoverable row offers "Remind me".
    await userEvent.click(canvas.getAllByRole('button', { name: 'Turn off' })[0]);
    await expect(args.onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'send_contract', on: true }),
    );
    // Two off rows now share the "Remind me" action, so scope to the venue row.
    const venueRow = canvas.getByText('Confirm the venue').closest('li')!;
    await userEvent.click(within(venueRow).getByRole('button', { name: 'Remind me' }));
    await expect(args.onToggle).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'add_venue', on: false }),
    );
  },
};

export const BusyRowDisabled: Story = {
  name: 'A row with an in-flight toggle is disabled',
  args: {
    busyKeys: new Set(['send_contract']), // keyed by the stable row id (system key)
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const contractRow = canvas.getByText('Send the contract').closest('li')!;
    await expect(within(contractRow).getByRole('button', { name: 'Turn off' })).toBeDisabled();
  },
};

export const WithDependency: Story = {
  name: 'Dependency chain: "…, after you <prerequisite>" (#557/#558)',
  args: {
    reminders: [
      // `after` is populated by the selector only while the dependency is a live gate (the prereq is
      // outstanding + tracked, per #554). Shown here so the wording is reviewable.
      { itemId: '1', key: 'send_contract', label: 'Send the contract', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, after: 'create the contract' },
      { itemId: '2', key: 'deposit_received', label: 'Take the deposit', on: false, source: 'system', state: null, requiredForStatus: 'CONFIRMED', autoCompleteHint: null, after: 'send the contract' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Send the contract').closest('li')).toHaveTextContent(
      'Reminding you when the booking is Provisional, after you create the contract',
    );
    await expect(canvas.getByText('Take the deposit').closest('li')).toHaveTextContent(
      'Could remind you when the booking is Provisional, after you send the contract',
    );
  },
};

export const PassedStagesCollapsed: Story = {
  name: 'Passed-stage reminders collapse behind a disclosure',
  args: {
    // The booking is Confirmed, so reminders required-for Confirmed (or earlier) have passed their
    // work window and collapse; only the Ready/Complete ones stay listed.
    currentStatus: 'CONFIRMED',
    reminders: [
      { itemId: '1', key: 'send_contract', label: 'Send the contract', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, after: null }, // passed
      { itemId: '2', key: 'create_balance_invoice', label: 'Create the balance invoice', on: false, source: 'system', state: null, requiredForStatus: 'READY', autoCompleteHint: null, after: null }, // active
      { itemId: '3', key: 'play_the_gig', label: 'Play the gig', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'COMPLETE', autoCompleteHint: null, after: null }, // active
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Future-stage reminders show; the passed one is hidden until the disclosure is opened.
    await expect(canvas.getByText('Create the balance invoice')).toBeInTheDocument();
    await expect(canvas.queryByText('Send the contract')).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: /Show 1 passed reminder/ }));
    await expect(canvas.getByText('Send the contract')).toBeInTheDocument();
  },
};

export const AddYourOwn: Story = {
  name: 'Add your own: tag a personal reminder to the concern (#559)',
  args: {
    onAdd: fn(async () => {}),
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /add your own/i }));
    await userEvent.type(canvas.getByPlaceholderText('Item label'), 'Book the photographer');
    await userEvent.click(canvas.getByRole('button', { name: 'Add' }));
    await expect(args.onAdd).toHaveBeenCalledWith('Book the photographer');
  },
};

export const Empty: Story = {
  name: 'No applicable reminders: renders nothing',
  args: { reminders: [], onAdd: undefined },
};
