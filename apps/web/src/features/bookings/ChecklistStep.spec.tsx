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
const checklistDefaults: ChecklistDefaultItem[] = [
  def({ key: 'send_quote', label: 'Send the quote', requiredForStatus: 'PROVISIONAL' }),
  def({ key: 'create_contract', label: 'Create the contract', requiredForStatus: 'CONFIRMED' }),
  def({ key: 'send_contract', label: 'Send the contract', requiredForStatus: 'CONFIRMED', dependsOn: ['create_contract'] }),
  def({ key: 'play_the_gig', label: 'Play the gig', requiredForStatus: 'COMPLETE' }),
];

function renderStep(onCreate = vi.fn()) {
  render(
    <ChecklistStep
      preview={preview}
      isPreviewLoading={false}
      checklistDefaults={checklistDefaults}
      onBack={vi.fn()}
      onCreate={onCreate}
      isCreating={false}
      isError={false}
    />,
  );
  return onCreate;
}

const payloadKeys = (onCreate: ReturnType<typeof vi.fn>) =>
  (onCreate.mock.calls[0][0] as ChecklistDefaultItem[]).map((i) => i.key);

describe('ChecklistStep (New Booking reminders, #560)', () => {
  it('shows a loading state while the preview is in flight', () => {
    render(
      <ChecklistStep
        preview={[]}
        isPreviewLoading
        checklistDefaults={[]}
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
      expect(payloadKeys(onCreate)).toEqual(['send_quote', 'create_contract', 'send_contract']);
    });

    it('excluding one reminder drops exactly that key, nothing else', async () => {
      const onCreate = renderStep();
      // "Send the quote" lives in the People section; turn it off.
      const quoteRow = screen.getByText('Send the quote').closest('li')!;
      await userEvent.click(within(quoteRow).getByRole('button', { name: 'Turn off' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      expect(payloadKeys(onCreate)).toEqual(['create_contract', 'send_contract']);
    });

    it('a re-enabled reminder returns to the payload', async () => {
      const onCreate = renderStep();
      const quoteRow = screen.getByText('Send the quote').closest('li')!;
      await userEvent.click(within(quoteRow).getByRole('button', { name: 'Turn off' }));
      await userEvent.click(within(quoteRow).getByRole('button', { name: 'Remind me' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
      expect(payloadKeys(onCreate)).toEqual(['send_quote', 'create_contract', 'send_contract']);
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
      await userEvent.type(other.getByPlaceholderText('Item label'), 'Charge the camera');
      await userEvent.click(other.getByRole('button', { name: 'Add' }));
      await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));

      const items = onCreate.mock.calls[0][0] as ChecklistDefaultItem[];
      expect(items).toContainEqual(
        expect.objectContaining({ key: null, label: 'Charge the camera', concern: null }),
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
    await userEvent.type(other.getByPlaceholderText('Item label'), 'Charge the camera');
    await userEvent.click(other.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Charge the camera')).toBeInTheDocument();

    const customRow = screen.getByText('Charge the camera').closest('li')!;
    await userEvent.click(within(customRow).getByRole('button', { name: 'Turn off' }));
    expect(screen.queryByText('Charge the camera')).not.toBeInTheDocument();
  });
});
