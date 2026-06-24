import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChecklistStep } from './ChecklistStep';
import type { ChecklistDefaultItem, ReminderPreview } from '@/types/api';

// A small preview spanning two concerns with a cross-concern dependency: send_contract (people)
// depends on create_contract (overview).
const preview: ReminderPreview[] = [
  { key: 'send_quote', label: 'Send the quote', concern: 'people', requiredForStatus: 'PROVISIONAL', autoCompleteHint: null, prerequisites: [] },
  { key: 'create_contract', label: 'Create the contract', concern: 'overview', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, prerequisites: [] },
  { key: 'send_contract', label: 'Send the contract', concern: 'people', requiredForStatus: 'CONFIRMED', autoCompleteHint: null, prerequisites: [{ key: 'create_contract', phrase: 'create the contract' }] },
];

const def = (over: Partial<ChecklistDefaultItem> & { key: string | null; label: string }): ChecklistDefaultItem => ({
  completedBy: 'USER',
  dependsOn: [],
  autoCompleteRule: null,
  requiredForStatus: null,
  dueDateRule: null,
  ...over,
});

// The full template the form holds — the create payload is built from these. `play_the_gig` is in
// the template but NOT the preview (e.g. filtered as past-stage), so it must never reach the payload.
// Two global custom defaults (key: null, from Settings #561): one tagged to Venue, one concern-less.
const checklistDefaults: ChecklistDefaultItem[] = [
  def({ key: 'send_quote', label: 'Send the quote', requiredForStatus: 'PROVISIONAL' }),
  def({ key: 'create_contract', label: 'Create the contract', requiredForStatus: 'CONFIRMED' }),
  def({ key: 'send_contract', label: 'Send the contract', requiredForStatus: 'CONFIRMED', dependsOn: ['create_contract'] }),
  def({ key: 'play_the_gig', label: 'Play the gig', requiredForStatus: 'COMPLETE' }),
  def({ key: null, label: 'Book parking', concern: 'venue', requiredForStatus: null }),
  def({ key: null, label: 'Charge the camera', concern: null, requiredForStatus: null }),
];

function renderStep(onCreate = vi.fn(), defaults = checklistDefaults, startingStatus: 'PROVISIONAL' | 'CONFIRMED' | 'READY' | 'COMPLETE' = 'PROVISIONAL') {
  render(
    <ChecklistStep
      preview={preview}
      isPreviewLoading={false}
      checklistDefaults={defaults}
      startingStatus={startingStatus}
      onBack={vi.fn()}
      onCreate={onCreate}
      isCreating={false}
      isError={false}
    />,
  );
  return onCreate;
}

const payloadItems = (onCreate: ReturnType<typeof vi.fn>) =>
  onCreate.mock.calls[0][0] as ChecklistDefaultItem[];
// System (keyed) reminders only — global/inline customs carry a null key and are asserted by label.
const systemKeys = (onCreate: ReturnType<typeof vi.fn>) =>
  payloadItems(onCreate).map((i) => i.key).filter((k): k is string => k != null);
const payloadLabels = (onCreate: ReturnType<typeof vi.fn>) =>
  payloadItems(onCreate).map((i) => i.label);

describe('ChecklistStep (New Booking reminders, #560)', () => {
  it('shows a loading state while the preview is in flight', () => {
    render(
      <ChecklistStep
        preview={[]}
        isPreviewLoading
        checklistDefaults={[]}
        startingStatus="PROVISIONAL"
        onBack={vi.fn()}
        onCreate={vi.fn()}
        isCreating={false}
        isError={false}
      />,
    );
    expect(screen.getByText(/loading reminders/i)).toBeInTheDocument();
  });

  it('renders a concern section per preview group plus an "Other items" catch-all', () => {
    renderStep();
    // Concerns in spine order; only the two with rows plus the always-present catch-all matter here.
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other items' })).toBeInTheDocument();
  });

  describe('create payload (the discriminating contract)', () => {
    it('defaults every previewed reminder on → payload is exactly the in-scope keys', async () => {
      const onCreate = renderStep();
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      // Every preview key, in template order; play_the_gig (not previewed) excluded.
      expect(systemKeys(onCreate)).toEqual(['send_quote', 'create_contract', 'send_contract']);
    });

    it('excluding one reminder drops exactly that key, nothing else', async () => {
      const onCreate = renderStep();
      // "Send the quote" lives in the People section; turn it off.
      const quoteRow = screen.getByText('Send the quote').closest('li')!;
      await userEvent.click(within(quoteRow).getByRole('button', { name: 'Turn off' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      expect(systemKeys(onCreate)).toEqual(['create_contract', 'send_contract']);
    });

    it('a re-enabled reminder returns to the payload', async () => {
      const onCreate = renderStep();
      const quoteRow = screen.getByText('Send the quote').closest('li')!;
      await userEvent.click(within(quoteRow).getByRole('button', { name: 'Turn off' }));
      await userEvent.click(within(quoteRow).getByRole('button', { name: 'Remind me' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      expect(systemKeys(onCreate)).toEqual(['send_quote', 'create_contract', 'send_contract']);
    });

    it('a concern-tagged custom lands in the payload with that concern (default stage)', async () => {
      const onCreate = renderStep();
      // Add a custom inside the Venue section.
      const venue = within(screen.getByRole('region', { name: 'Venue' }));
      await userEvent.click(venue.getByRole('button', { name: /add your own/i }));
      await userEvent.type(venue.getByPlaceholderText('Item label'), 'Hire the marquee');
      await userEvent.click(venue.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));

      const items = onCreate.mock.calls[0][0] as ChecklistDefaultItem[];
      expect(items).toContainEqual(
        expect.objectContaining({ key: null, label: 'Hire the marquee', concern: 'venue', requiredForStatus: null }),
      );
    });

    it('a concern-less custom lands via "Other items" with a null concern', async () => {
      const onCreate = renderStep();
      const other = within(screen.getByRole('region', { name: 'Other items' }));
      await userEvent.click(other.getByRole('button', { name: /add your own/i }));
      await userEvent.type(other.getByPlaceholderText('Item label'), 'Pack spare strings');
      await userEvent.click(other.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));

      const items = onCreate.mock.calls[0][0] as ChecklistDefaultItem[];
      expect(items).toContainEqual(
        expect.objectContaining({ key: null, label: 'Pack spare strings', concern: null }),
      );
    });
  });

  describe('"after you …" clause recomputed from the live selection', () => {
    it('shows a dependent\'s clause while its prerequisite is selected', () => {
      renderStep();
      const sendContractRow = screen.getByText('Send the contract').closest('li')!;
      expect(sendContractRow).toHaveTextContent(/after you create the contract/i);
    });

    it('drops the clause once the prerequisite is turned off', async () => {
      renderStep();
      const createRow = screen.getByText('Create the contract').closest('li')!;
      await userEvent.click(within(createRow).getByRole('button', { name: 'Turn off' }));
      const sendContractRow = screen.getByText('Send the contract').closest('li')!;
      expect(sendContractRow).not.toHaveTextContent(/after you create the contract/i);
    });
  });

  it('removes a locally-added custom when it is toggled off (no record to keep)', async () => {
    renderStep();
    const other = within(screen.getByRole('region', { name: 'Other items' }));
    await userEvent.click(other.getByRole('button', { name: /add your own/i }));
    await userEvent.type(other.getByPlaceholderText('Item label'), 'Pack spare strings');
    await userEvent.click(other.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Pack spare strings')).toBeInTheDocument();

    const customRow = screen.getByText('Pack spare strings').closest('li')!;
    await userEvent.click(within(customRow).getByRole('button', { name: 'Turn off' }));
    expect(screen.queryByText('Pack spare strings')).not.toBeInTheDocument();
  });

  describe('global custom defaults from Settings (#561)', () => {
    it('offers a concern-tagged global custom in its section, on by default', () => {
      renderStep();
      const venue = within(screen.getByRole('region', { name: 'Venue' }));
      expect(venue.getByText('Book parking')).toBeInTheDocument();
    });

    it('offers a concern-less global custom under "Other items"', () => {
      renderStep();
      const other = within(screen.getByRole('region', { name: 'Other items' }));
      expect(other.getByText('Charge the camera')).toBeInTheDocument();
    });

    it('seeds both global customs by default, each keeping its concern', async () => {
      const onCreate = renderStep();
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      const items = payloadItems(onCreate);
      expect(items).toContainEqual(expect.objectContaining({ key: null, label: 'Book parking', concern: 'venue' }));
      expect(items).toContainEqual(expect.objectContaining({ key: null, label: 'Charge the camera', concern: null }));
    });

    it('toggling a global custom off keeps it shown but excludes it from the payload', async () => {
      const onCreate = renderStep();
      const parkingRow = screen.getByText('Book parking').closest('li')!;
      await userEvent.click(within(parkingRow).getByRole('button', { name: 'Turn off' }));
      // Still shown (durable item, re-addable), unlike an inline custom which vanishes.
      expect(screen.getByText('Book parking')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      expect(payloadLabels(onCreate)).not.toContain('Book parking');
    });

    it('does not offer a global custom whose stage has already passed at the starting status', () => {
      const defaults: ChecklistDefaultItem[] = [
        def({ key: null, label: 'Confirm catering', concern: 'venue', requiredForStatus: 'CONFIRMED' }),
      ];
      // Starting at READY → a CONFIRMED-staged custom is past and not offered.
      renderStep(vi.fn(), defaults, 'READY');
      expect(screen.queryByText('Confirm catering')).not.toBeInTheDocument();
    });
  });
});
