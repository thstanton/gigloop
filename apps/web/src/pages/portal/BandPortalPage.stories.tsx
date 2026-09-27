import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import BandPortalPage from './BandPortalPage';
import type { BandPortalData } from '@/types/api';

const DATA: BandPortalData = {
  cancelled: false,
  branding: {
    businessName: 'The Aurora Quartet',
    displayName: 'James',
    logoUrl: null,
    brandColour: '#1a1a1a',
    portalTheme: 'LIGHT_MODERN',
    email: 'james@auroraquartet.co.uk',
    phone: '07700 900123',
  },
  roster: {
    bookingTitle: "Sophie & Tom's Wedding",
    bookingDate: '2027-06-12T00:00:00.000Z',
    venueName: 'The Old Barn',
    venueAddress: null,
    sets: [],
    segments: [],
    chairs: [{ id: 'chair-sax', role: 'Saxophone', memberName: 'Dave Player', callTimes: [] }],
    logistics: [],
  },
  self: { status: 'CONFIRMED', sessionFee: '150.00', ownChairIds: ['chair-sax'] },
};

// Page-level smoke only (ADR-0024) — the richer normal/cancelled coverage lives on the
// presentational body, BandGigSheet.stories.tsx. This story just proves the fetch/loading/render
// wiring works end to end through MSW.
const meta = {
  component: BandPortalPage,
  tags: ['ai-generated'],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/band/tok-1']}>
        <Routes>
          <Route path="/band/:token" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof BandPortalPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  parameters: { msw: { handlers: [http.get('/api/band/:token', () => HttpResponse.json(DATA))] } },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Sophie & Tom's Wedding")).toBeVisible();
    await expect(canvas.getByText('Dave Player')).toBeVisible();
  },
};

export const NotFound: Story = {
  parameters: {
    msw: {
      handlers: [http.get('/api/band/:token', () => HttpResponse.json({ message: 'Not found' }, { status: 404 }))],
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Link not found')).toBeVisible();
  },
};
