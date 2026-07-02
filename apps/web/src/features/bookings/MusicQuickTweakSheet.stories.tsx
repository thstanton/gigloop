import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MusicQuickTweakSheet } from './MusicQuickTweakSheet';
import type { MusicFormConfig } from '@/types/api';

// A draft (on, not yet published) config — the sheet opens on it and offers Save draft / Publish.
const draftConfig: MusicFormConfig = {
  id: 'mfc1',
  bookingId: 'b1',
  keyMoments: [],
  enabledGenres: ['CONTEMPORARY', 'JAZZ'],
  publishedAt: null,
  createdAt: '2030-06-01T00:00:00Z',
  updatedAt: '2030-06-01T00:00:00Z',
};

const meta = {
  component: MusicQuickTweakSheet,
  tags: ['ai-generated'],
  args: {
    bookingId: 'b1',
    hasMusicFormConfig: true,
    packages: [],
    open: true,
    onOpenChange: fn(),
    onPublished: fn(),
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1/music-form-config', () => HttpResponse.json(draftConfig)),
        http.post('/api/bookings/b1/music-form-config/publish', () =>
          HttpResponse.json({ ...draftConfig, publishedAt: '2030-06-02T00:00:00Z' }, { status: 201 }),
        ),
      ],
    },
  },
} satisfies Meta<typeof MusicQuickTweakSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Opens the music atom in a sheet (draft → Save draft / Publish)',
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await expect(await body.findByRole('heading', { name: 'Music form' })).toBeVisible();
    // A draft form offers both actions.
    await expect(await body.findByRole('button', { name: /^publish$/i })).toBeVisible();
    await expect(body.getByRole('button', { name: /^save draft$/i })).toBeVisible();
  },
};

export const PublishChainsToSendInvite: Story = {
  name: '#632: publishing fires onPublished so the container can open the send-invite sheet',
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole('button', { name: /^publish$/i }));
    // The container is told to chain into the send-invite sheet (invoice issue → send pattern).
    await waitFor(() => expect(args.onPublished).toHaveBeenCalled());
  },
};
