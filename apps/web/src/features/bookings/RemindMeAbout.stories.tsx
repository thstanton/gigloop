import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import { RemindMeAbout } from './RemindMeAbout';
import type { ApplicableReminder } from '@/types/api';

// A full-range set so the reusable control is reviewable beyond the Venue tracer (which renders
// just `add_venue`): on, off-skipped, off-discoverable, and a custom item with no tied status.
const reminders: ApplicableReminder[] = [
  // Discoverable system reminder, never seeded → off, turning on seeds on demand.
  { itemId: null, key: 'add_venue', label: 'Confirm the venue', on: false, source: 'system', state: null, requiredForStatus: 'READY' },
  // Tracked.
  { itemId: '1', key: 'send_contract', label: 'Send the contract', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'CONFIRMED' },
  // On + complete — still reads "on" (no lifecycle shown; that's the checklist's job).
  { itemId: '2', key: 'send_quote', label: 'Send the quote', on: true, source: 'system', state: 'COMPLETE', requiredForStatus: 'PROVISIONAL' },
  // User-skipped, was seeded → off, re-enableable.
  { itemId: '3', key: 'send_thank_you', label: 'Send a thank-you', on: false, source: 'system', state: 'SKIPPED', requiredForStatus: 'COMPLETE' },
  // Custom concern-tagged reminder, no tied status.
  { itemId: '4', key: null, label: 'Order the celebration cake', on: true, source: 'custom', state: 'PENDING', requiredForStatus: null },
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
    await expect(canvas.getByText('Remind me to')).toBeInTheDocument();
    await expect(canvas.getByText('Confirm the venue')).toBeInTheDocument();
    await expect(canvas.getByText('Order the celebration cake')).toBeInTheDocument();
    // Coaching sub-line names the *preceding* status (work done during that stage).
    await expect(canvas.getByText('Provisional')).toBeInTheDocument(); // send the quote → prereq for Provisional
    await expect(canvas.getByText('Confirm the venue').closest('li')).toHaveTextContent(/Could remind you when the booking is Confirmed/);
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
  name: 'Dependency chain: "…, after you <prerequisite>" (deferred wiring, #557/#558)',
  args: {
    reminders: [
      // `after` is set by the container only when the dependency is a live gate. Shown here so the
      // wording is reviewable; the Venue tracer won't populate it (add_venue has no dependsOn).
      { itemId: '1', key: 'send_contract', label: 'Send the contract', on: true, source: 'system', state: 'PENDING', requiredForStatus: 'CONFIRMED', after: 'create the contract' },
      { itemId: '2', key: 'deposit_received', label: 'Take the deposit', on: false, source: 'system', state: null, requiredForStatus: 'CONFIRMED', after: 'send the contract' },
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

export const Empty: Story = {
  name: 'No applicable reminders: renders nothing',
  args: { reminders: [] },
};
