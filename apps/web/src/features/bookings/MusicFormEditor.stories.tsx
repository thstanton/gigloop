import { Meta, StoryObj, Decorator } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect } from 'storybook/test';
import MusicFormEditor from './MusicFormEditor';
import type { BookingDetail, MusicFormConfig } from '@/types/api';

const mockBooking: BookingDetail = {
  id: 'b1',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  status: 'CONFIRMED',
  eventType: 'WEDDING',
  date: '2026-08-15T18:00:00Z',
  title: 'Wedding Reception',
  fee: '2500',
  notes: null,
  customerId: 'c1',
  customer: {
    id: 'c1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    name: 'Sarah Johnson',
    greetingName: null,
    email: 'sarah@example.com',
    phone: null,
    notes: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    county: null,
    postcode: null,
    country: null,
    latitude: null,
    longitude: null,
    placeId: null,
    travelTimeMinutes: null,
    travelDistanceMetres: null,
    travelTimeCalculatedAt: null,
    travelMode: null,
    parkingInfo: null,
    accessInfo: null,
    equipmentAvailable: null,
    website: null,
    commissionArrangement: null,
    primaryRole: null,
  },
  venueId: null,
  venue: null,
  bookingAgentId: null,
  bookingAgent: null,
  sets: [],
  series: null,
  seriesId: null,
  packages: [],
  depositReceivedAt: null,
  portalToken: 'portal-token-123',
  hasMusicFormConfig: true,
  hasMusicFormResponse: false,
  logistics: null,
  activeContract: null,
};

const emptyConfig: MusicFormConfig = {
  id: 'mfc1',
  bookingId: 'b1',
  keyMoments: [],
  enabledGenres: [],
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
};

/**
 * Seed the QueryClient cache BEFORE the editor renders so config is defined on the very
 * first render — the cache-hit path. This is the only setup that reproduces the
 * perpetual-loading hang: a story that lets MSW fetch the config exercises the cold path,
 * which renders fine even against the buggy code, so it has no regression value.
 */
function withSeededConfig(config: MusicFormConfig | null): Decorator {
  return (Story) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    if (config) client.setQueryData(['booking-music-form-config', config.bookingId], config);
    return (
      <QueryClientProvider client={client}>
        <Story />
      </QueryClientProvider>
    );
  };
}

const meta: Meta<typeof MusicFormEditor> = {
  component: MusicFormEditor,
};

export default meta;
type Story = StoryObj<typeof meta>;

// Regression for the warm-cache hang: with config already cached, the editor body must
// render immediately — not the skeleton. Against the buggy code this showed the
// animate-pulse skeleton forever and "Add key moment" never appeared.
export const WarmEmptyConfig: Story = {
  args: { booking: mockBooking, isOpen: true },
  decorators: [withSeededConfig(emptyConfig)],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Add key moment')).toBeVisible();
    await expect(canvas.getByText('Enabled genres')).toBeVisible();
    await expect(canvas.getByText('Save music form')).toBeVisible();
  },
};

// Off: no config row — the editor shows an explicit turn-on control rather than an empty form.
export const Off: Story = {
  args: { booking: { ...mockBooking, hasMusicFormConfig: false }, isOpen: true },
  decorators: [withSeededConfig(null)],
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Turn on music form')).toBeVisible();
  },
};
