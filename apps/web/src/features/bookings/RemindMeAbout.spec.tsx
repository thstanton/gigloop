import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RemindMeAbout, reminderRowId, type ReminderRow } from './RemindMeAbout';

function reminder(overrides: Partial<ReminderRow> = {}): ReminderRow {
  return {
    itemId: '1',
    key: 'send_contract',
    label: 'Send the contract',
    on: true,
    source: 'system',
    state: 'PENDING',
    requiredForStatus: 'CONFIRMED',
    autoCompleteHint: null,
    after: null,
    ...overrides,
  };
}

describe('RemindMeAbout', () => {
  it('renders the "Remind me about" header and a row per reminder', () => {
    render(<RemindMeAbout reminders={[reminder(), reminder({ itemId: '2', key: 'send_quote', label: 'Send the quote' })]} onToggle={vi.fn()} />);
    expect(screen.getByText('Remind me about')).toBeInTheDocument();
    expect(screen.getByText('Send the contract')).toBeInTheDocument();
    expect(screen.getByText('Send the quote')).toBeInTheDocument();
  });

  it('renders nothing when there are no applicable reminders', () => {
    const { container } = render(<RemindMeAbout reminders={[]} onToggle={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the preceding status the work is done during, in that status colour while on', () => {
    // send_contract is a prerequisite for CONFIRMED → the work happens during Provisional.
    render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} />);
    const status = screen.getByText('Provisional');
    expect(status).toHaveClass('text-status-provisional');
    expect(screen.getByText('Send the contract').closest('li')).toHaveTextContent(
      'Reminding you when the booking is Provisional',
    );
  });

  it('drops the status colour on an off (discoverable) reminder', () => {
    render(<RemindMeAbout reminders={[reminder({ on: false, state: null })]} onToggle={vi.fn()} />);
    const status = screen.getByText('Provisional');
    expect(status).not.toHaveClass('text-status-provisional');
    expect(screen.getByText('Send the contract').closest('li')).toHaveTextContent(/Could remind you/);
  });

  it('reads a skipped reminder the same as a never-seeded one (unified off wording)', () => {
    render(<RemindMeAbout reminders={[reminder({ on: false, state: 'SKIPPED' })]} onToggle={vi.fn()} />);
    expect(screen.getByText('Send the contract').closest('li')).toHaveTextContent(
      'Could remind you when the booking is Provisional',
    );
    expect(screen.getByRole('button', { name: 'Remind me' })).toBeInTheDocument();
  });

  it('does not show lifecycle state (a completed reminder still reads as on)', () => {
    render(<RemindMeAbout reminders={[reminder({ state: 'COMPLETE' })]} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument();
    expect(screen.queryByText(/done|complete/i)).not.toBeInTheDocument();
  });

  it('falls back to plain wording for a custom item with no tied status', () => {
    render(<RemindMeAbout reminders={[reminder({ key: null, source: 'custom', label: 'Order the cake', requiredForStatus: null })]} onToggle={vi.fn()} />);
    expect(screen.getByText('Reminding you')).toBeInTheDocument();
  });

  it.each([
    ['on', { on: true, state: 'PENDING' as const }, 'Turn off'],
    ['skipped', { on: false, state: 'SKIPPED' as const }, 'Remind me'],
    ['discoverable', { on: false, state: null }, 'Remind me'],
  ])('shows the %s action label', (_label, patch, action) => {
    render(<RemindMeAbout reminders={[reminder(patch)]} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: action })).toBeInTheDocument();
  });

  it('calls onToggle with the reminder when its action is clicked', async () => {
    const onToggle = vi.fn();
    const r = reminder();
    render(<RemindMeAbout reminders={[r]} onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: 'Turn off' }));
    expect(onToggle).toHaveBeenCalledWith(r);
  });

  it('appends the dependency clause when `after` is set', () => {
    render(<RemindMeAbout reminders={[reminder({ after: 'create the contract' })]} onToggle={vi.fn()} />);
    expect(screen.getByText('Send the contract').closest('li')).toHaveTextContent(
      'Reminding you when the booking is Provisional, after you create the contract',
    );
  });

  it('omits the dependency clause when `after` is absent', () => {
    render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} />);
    expect(screen.getByText('Send the contract').closest('li')).not.toHaveTextContent('after you');
  });

  it('disables a row whose toggle is in flight', () => {
    render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} busyKeys={new Set(['send_contract'])} />);
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeDisabled();
  });

  describe('auto-complete condition (#567)', () => {
    it.each([
      ['on', true],
      ['off', false],
    ])('renders the auto-complete hint inline when present (%s)', (_label, on) => {
      render(
        <RemindMeAbout
          reminders={[reminder({ key: 'contract_signed', label: 'Contract signed', on, autoCompleteHint: 'when the client signs in the portal' })]}
          onToggle={vi.fn()}
        />,
      );
      expect(screen.getByText('Contract signed').closest('li')).toHaveTextContent(
        '· when the client signs in the portal',
      );
    });

    it('renders no hint clause when autoCompleteHint is null', () => {
      render(<RemindMeAbout reminders={[reminder({ key: 'send_quote', label: 'Send quote', autoCompleteHint: null })]} onToggle={vi.fn()} />);
      // The hint clause is separated by a middot; absent means no clause was rendered.
      expect(screen.getByText('Send quote').closest('li')).not.toHaveTextContent('·');
    });

    it('renders the dependency clause and the auto-complete hint together, in order', () => {
      // contract_signed gated by an outstanding send_contract is the densest line: both fields set.
      render(
        <RemindMeAbout
          reminders={[reminder({ key: 'contract_signed', label: 'Contract signed', after: 'send the contract', autoCompleteHint: 'when the client signs in the portal' })]}
          onToggle={vi.fn()}
        />,
      );
      expect(screen.getByText('Contract signed').closest('li')).toHaveTextContent(
        'Reminding you when the booking is Provisional, after you send the contract · when the client signs in the portal',
      );
    });
  });

  describe('add your own (#559)', () => {
    it('shows no add affordance when onAdd is not provided', () => {
      render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} />);
      expect(screen.queryByRole('button', { name: /add your own/i })).not.toBeInTheDocument();
    });

    it('offers the add affordance even on a concern with no reminders', () => {
      render(<RemindMeAbout reminders={[]} onToggle={vi.fn()} onAdd={vi.fn().mockResolvedValue(undefined)} />);
      expect(screen.getByRole('button', { name: /add your own/i })).toBeInTheDocument();
    });

    it('reveals a label input and calls onAdd with the trimmed label and the default (no) stage', async () => {
      const onAdd = vi.fn().mockResolvedValue(undefined);
      render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} onAdd={onAdd} />);
      await userEvent.click(screen.getByRole('button', { name: /add your own/i }));
      await userEvent.type(screen.getByPlaceholderText('Item label'), '  Book photographer  ');
      await userEvent.click(screen.getByRole('button', { name: 'Add' }));
      // Stage defaults to "no requirement" → null (the Radix Select is driven in the story, where a
      // real browser env supports its pointer interactions; jsdom covers the label + default here).
      expect(onAdd).toHaveBeenCalledWith('Book photographer', null);
    });

    it('offers a stage picker, defaulting to no stage requirement', async () => {
      render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} onAdd={vi.fn().mockResolvedValue(undefined)} />);
      await userEvent.click(screen.getByRole('button', { name: /add your own/i }));
      expect(screen.getByRole('combobox')).toHaveTextContent('No stage requirement');
    });

    it('disables Add until a label is entered', async () => {
      render(<RemindMeAbout reminders={[reminder()]} onToggle={vi.fn()} onAdd={vi.fn().mockResolvedValue(undefined)} />);
      await userEvent.click(screen.getByRole('button', { name: /add your own/i }));
      expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    });
  });

  describe('passed-stage collapse (currentStatus)', () => {
    // send_contract is required-for CONFIRMED → its work window has passed on a CONFIRMED booking;
    // create_balance_invoice is required-for READY → still ahead, so it stays active.
    const passedRow = () =>
      reminder({ key: 'send_contract', label: 'Send the contract', requiredForStatus: 'CONFIRMED' });
    const activeRow = () =>
      reminder({ key: 'create_balance_invoice', label: 'Create the balance invoice', requiredForStatus: 'READY' });

    it('lists every reminder when no currentStatus is given (default)', () => {
      render(<RemindMeAbout reminders={[passedRow(), activeRow()]} onToggle={vi.fn()} />);
      expect(screen.getByText('Send the contract')).toBeInTheDocument();
      expect(screen.getByText('Create the balance invoice')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /passed/ })).not.toBeInTheDocument();
    });

    it('hides passed-stage reminders behind a disclosure, revealing them on expand', async () => {
      render(<RemindMeAbout reminders={[passedRow(), activeRow()]} onToggle={vi.fn()} currentStatus="CONFIRMED" />);
      // Active row shows; the passed one is hidden until expanded.
      expect(screen.getByText('Create the balance invoice')).toBeInTheDocument();
      expect(screen.queryByText('Send the contract')).not.toBeInTheDocument();
      // The disclosure names the count.
      const disclosure = screen.getByRole('button', { name: /Show 1 passed reminder/ });
      await userEvent.click(disclosure);
      expect(screen.getByText('Send the contract')).toBeInTheDocument();
    });

    it('keeps a single passed reminder visible rather than collapsing the whole section (min 1)', () => {
      render(<RemindMeAbout reminders={[passedRow()]} onToggle={vi.fn()} currentStatus="CONFIRMED" />);
      expect(screen.getByText('Remind me about')).toBeInTheDocument();
      expect(screen.getByText('Send the contract')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /passed/ })).not.toBeInTheDocument();
    });

    it('promotes the most recent passed reminder and collapses the rest when all have passed', async () => {
      // Both passed on a CONFIRMED booking; deposit_received (CONFIRMED) is more recent than
      // confirm_quote (PROVISIONAL), so it leads and the older one collapses.
      const older = reminder({ key: 'confirm_quote', label: 'Quote confirmed', requiredForStatus: 'PROVISIONAL' });
      const recent = reminder({ key: 'deposit_received', label: 'Deposit received', requiredForStatus: 'CONFIRMED' });
      render(<RemindMeAbout reminders={[older, recent]} onToggle={vi.fn()} currentStatus="CONFIRMED" />);
      expect(screen.getByText('Deposit received')).toBeInTheDocument();
      expect(screen.queryByText('Quote confirmed')).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: /Show 1 passed reminder/ }));
      expect(screen.getByText('Quote confirmed')).toBeInTheDocument();
    });

    it('never treats a stage-less custom reminder as passed', () => {
      render(
        <RemindMeAbout
          reminders={[reminder({ key: null, source: 'custom', label: 'Order the cake', requiredForStatus: null })]}
          onToggle={vi.fn()}
          currentStatus="COMPLETE"
        />,
      );
      expect(screen.getByText('Order the cake')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /passed/ })).not.toBeInTheDocument();
    });
  });
});

describe('reminderRowId', () => {
  it('prefers the stable system key (survives an on-demand seed), falling back to itemId for custom items', () => {
    // Same key, before vs after seed (itemId null → uuid): identity is unchanged.
    expect(reminderRowId(reminder({ key: 'add_venue', itemId: null }))).toBe('add_venue');
    expect(reminderRowId(reminder({ key: 'add_venue', itemId: 'uuid-1' }))).toBe('add_venue');
    // Custom item has no key → itemId.
    expect(reminderRowId(reminder({ key: null, itemId: 'custom-1' }))).toBe('custom-1');
  });
});
