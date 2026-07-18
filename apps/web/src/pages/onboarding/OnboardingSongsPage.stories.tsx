import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import OnboardingSongsPage from './OnboardingSongsPage';

// Stateful /me + /songs mocks so the optimistic turn-off toggle and the add/remove
// flow survive the page's refetches. The flag ends where it starts (true) so
// repeated runs are consistent.
let srfEnabled = true;
let songSeq = 0;

const me = {
  id: 'up1',
  userId: 'user_storybook_test',
  onboardingCompletedAt: null,
  digestEmailEnabled: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

// A business name distinct from the component's fallback sample, so the play function
// proves the quote-email subject is actually personalised rather than coincidentally
// matching the sample (#695).
const publicProfileHandler = http.get('/api/me/public', () =>
  HttpResponse.json({
    id: 'pp1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    businessName: 'The Aurora Quartet',
    displayName: 'James',
    bio: null,
    email: 'james@auroraquartet.co.uk',
    phone: null,
    logoUrl: null,
    photo: null,
    website: null,
    socials: null,
    clientPortalConfig: { theme: 'LIGHT_MODERN', brandColour: '#000000', heroImage: null, showContactPhoto: false, showContactEmail: true, showContactPhone: true },
  }),
);

// Story-level msw.handlers REPLACE the global set (Storybook merges parameters but
// replaces arrays), so every route the page hits must be declared here.
const catalogueHandler = http.get('/api/songs/catalogue', () =>
  HttpResponse.json([
    {
      genre: 'CONTEMPORARY',
      label: 'Contemporary',
      songs: [
        { id: 'con-001', title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY' },
        { id: 'con-002', title: 'All of Me', artist: 'John Legend', genre: 'CONTEMPORARY' },
      ],
    },
  ]),
);

const meta = {
  component: OnboardingSongsPage,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  parameters: {
    msw: {
      handlers: [
        http.get('/api/me', () => HttpResponse.json({ ...me, songRequestFormEnabled: srfEnabled })),
        http.patch('/api/me', async ({ request }) => {
          const body = (await request.json()) as { songRequestFormEnabled?: boolean };
          if (typeof body.songRequestFormEnabled === 'boolean') srfEnabled = body.songRequestFormEnabled;
          return HttpResponse.json({ ...me, songRequestFormEnabled: srfEnabled });
        }),
        http.post('/api/songs', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          songSeq += 1;
          return HttpResponse.json(
            { id: `new-song-${songSeq}`, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', ...body },
            { status: 201 },
          );
        }),
        http.delete('/api/songs/:id', () => new HttpResponse(null, { status: 204 })),
        catalogueHandler,
        publicProfileHandler,
      ],
    },
  },
} satisfies Meta<typeof OnboardingSongsPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    // Orientation: email templates framing (deliberate sends, not automation)
    await expect(
      (await canvas.findAllByText('Communicating with your clients'))[0],
    ).toBeVisible();
    await expect(canvas.getByText('Emails, ready when you are')).toBeVisible();
    await expect(await canvas.findByText('Your quote from The Aurora Quartet')).toBeVisible();
    await expect(canvas.getByText('Thank you for having us!')).toBeVisible();

    // Song requests: empty repertoire state
    await expect(canvas.getByText('Song requests')).toBeVisible();
    await expect(canvas.getByText('Repertoire')).toBeVisible();
    await expect(await canvas.findByText('Add a song to begin')).toBeVisible();

    // Add a song from the catalogue autocomplete
    const search = canvas.getByPlaceholderText('Search the catalogue by title or artist…');
    await userEvent.type(search, 'Perfect');
    await userEvent.click(await canvas.findByText('Ed Sheeran', { exact: false }));
    await expect(await canvas.findByText('Perfect')).toBeVisible();
    await expect(canvas.queryByText('Add a song to begin')).not.toBeInTheDocument();

    // Remove it again — empty state returns
    await userEvent.click(await canvas.findByLabelText('Remove Perfect'));
    await expect(await canvas.findByText('Add a song to begin')).toBeVisible();

    // Turn-off control hides the activation immediately
    await userEvent.click(canvas.getByText('Not for you? Turn off song requests'));
    await expect(await canvas.findByText('Song requests are off.')).toBeVisible();
    await expect(
      canvas.queryByPlaceholderText('Search the catalogue by title or artist…'),
    ).not.toBeInTheDocument();

    // And back on
    await userEvent.click(canvas.getByText('turn it back on'));
    await expect(
      await canvas.findByPlaceholderText('Search the catalogue by title or artist…'),
    ).toBeVisible();
    await waitFor(() => expect(srfEnabled).toBe(true));
  },
};

export const RequestsOff: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/me', () => HttpResponse.json({ ...me, songRequestFormEnabled: false })),
        catalogueHandler,
        publicProfileHandler,
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Song requests are off.')).toBeVisible();
    await expect(
      canvas.queryByPlaceholderText('Search the catalogue by title or artist…'),
    ).not.toBeInTheDocument();
    // Skip stays available independent of the toggle
    await expect(canvas.getByText('Skip for now — customise in Settings')).toBeVisible();
  },
};
