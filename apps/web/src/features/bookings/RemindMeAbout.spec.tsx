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
    ...overrides,
  };
}

describe('RemindMeAbout', () => {
  it('renders the "Remind me to" header and a row per reminder', () => {
    render(<RemindMeAbout reminders={[reminder(), reminder({ itemId: '2', key: 'send_quote', label: 'Send the quote' })]} onToggle={vi.fn()} />);
    expect(screen.getByText('Remind me to')).toBeInTheDocument();
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
