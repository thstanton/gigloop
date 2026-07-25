import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { SearchResult } from '@/types/api';
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
    onOpenChange: fn(),
    onQueryChange: fn(),
    onSelectResult: fn(),
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

/** Opening with no query shows the search hint (Recent lands here in a later slice). */
export const EmptyQuery: Story = {
  args: { query: '' },
  play: async () => {
    const body = within(document.body);
    await expect(body.getByText(/type to search/i)).toBeVisible();
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
