import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { SearchResult } from '@/types/api';
import { QUICK_ACTIONS, QUICK_ACTION_CREATES } from '@/lib/constants';
import { CommandPalette } from './CommandPalette';

const results: SearchResult[] = [
  {
    type: 'booking',
    id: 'b1',
    url: '/admin/bookings/b1',
    title: 'Hartley Wedding',
    subtitle: 'The Old Barn',
    status: 'CONFIRMED',
    date: '2026-08-15T18:00:00.000Z',
    eventType: 'WEDDING',
  },
  {
    type: 'booking',
    id: 'b2',
    url: '/admin/bookings/b2',
    title: 'Hartwell Corporate',
    subtitle: null,
    status: 'CANCELLED',
    date: '2026-05-02T18:00:00.000Z',
    eventType: 'CORPORATE',
  },
  {
    type: 'contact',
    id: 'c1',
    url: '/admin/contacts/c1',
    title: 'Jane Hartley',
    subtitle: 'jane@example.com',
    bookingCount: 12,
  },
  {
    type: 'contact',
    id: 'c2',
    url: '/admin/contacts/c2',
    title: 'Tom Hart',
    subtitle: '07700 900123',
    bookingCount: 1,
  },
];

const meta = {
  title: 'Common/CommandPalette',
  component: CommandPalette,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    query: 'hart',
    results,
    isLoading: false,
    actions: QUICK_ACTIONS,
    recent: [results[0], results[2]],
    pinnedActions: QUICK_ACTION_CREATES,
    onOpenChange: fn(),
    onQueryChange: fn(),
    onSelectResult: fn(),
    onSelectAction: fn(),
  },
} satisfies Meta<typeof CommandPalette>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Populated: grouped Bookings then Contacts. Clicking a result reports it to the caller
 *  (the palette never navigates or closes itself). */
export const Default: Story = {
  play: async ({ args }) => {
    const body = within(document.body);
    await expect(body.getByText('Bookings')).toBeVisible();
    await expect(body.getByText('Contacts')).toBeVisible();
    await userEvent.click(body.getByText('Hartley Wedding'));
    await expect(args.onSelectResult).toHaveBeenCalledWith(results[0]);
  },
};

/** Desktop keyboard path: arrow keys move the highlight, Enter opens the highlighted result.
 *  cmdk pre-highlights the first item, so one ArrowDown moves to the second — proving navigation. */
export const KeyboardSelection: Story = {
  play: async ({ args }) => {
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await expect(args.onSelectResult).toHaveBeenCalledWith(results[1]);
  },
};

/** Cold open (empty query): pinned Create actions above a Recent list of viewed items (ADR-0067 §7). */
export const ColdOpen: Story = {
  args: { query: '' },
  play: async () => {
    const body = within(document.body);
    await expect(body.getByText('Create')).toBeVisible();
    await expect(body.getByText('New Booking')).toBeVisible();
    await expect(body.getByText('Recent')).toBeVisible();
    await expect(body.getByText('Hartley Wedding')).toBeVisible();
  },
};

/** Fresh user with no history: still shows the pinned Create actions, and no empty Recent group. */
export const ColdOpenNoRecent: Story = {
  args: { query: '', recent: [] },
  play: async () => {
    const body = within(document.body);
    await expect(body.getByText('New Booking')).toBeVisible();
    await expect(body.getByText('New Contact')).toBeVisible();
    expect(body.queryByText('Recent')).toBeNull();
  },
};

/** In-flight search. */
export const Loading: Story = {
  args: { isLoading: true },
  play: async () => {
    const body = within(document.body);
    await expect(body.getByText(/searching/i)).toBeVisible();
  },
};

/** A query that matched nothing. */
export const NoResults: Story = {
  args: { query: 'zzzzz', results: [] },
  play: async () => {
    const body = within(document.body);
    await expect(body.getByText(/no results/i)).toBeVisible();
  },
};

/** Quick actions: matched by label + keywords (ADR-0067 §6 — "add gig" → New Booking). Selecting
 *  an action reports it to the caller to navigate; the palette never mutates. */
export const QuickActions: Story = {
  args: { query: 'add gig', results: [] },
  play: async ({ args }) => {
    const body = within(document.body);
    await expect(body.getByText('Actions')).toBeVisible();
    await userEvent.click(body.getByText('New Booking'));
    await expect(args.onSelectAction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-booking' }),
    );
  },
};
