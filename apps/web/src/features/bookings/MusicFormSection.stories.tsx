import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import MusicFormSection from './MusicFormSection';
import type { BookingDetail, MusicFormConfig } from '@/types/api';

const baseBooking: BookingDetail = {
  id: 'b1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  status: 'CONFIRMED', eventType: 'WEDDING', date: '2030-09-15T15:00:00Z',
  title: 'Smith Wedding', fee: '2000.00', notes: null,
  customerId: 'c1',
  customer: { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  venueId: null, venue: null, bookingAgentId: null, bookingAgent: null,
  sets: [], packages: [
    {
      id: 'pkg1', order: 0, label: 'Wedding Package', icon: 'heart',
    },
  ],
  activeContract: null, depositReceivedAt: null, portalToken: 'tok_abc',
  hasMusicFormConfig: false, hasMusicFormResponse: false,
  portalVisibility: { contract: null, musicForm: null },
  seriesId: null, series: null,
  logistics: null,
};

const config: MusicFormConfig = {
  id: 'mfc1', bookingId: 'b1',
  keyMoments: [
    { label: 'First dance', section: 'Wedding Package' },
    { label: 'Bridal walk-in', section: 'Wedding Package' },
  ],
  enabledGenres: ['JAZZ', 'CLASSICAL'],
  createdAt: '2030-04-02T10:00:00Z', updatedAt: '2030-04-02T10:00:00Z',
};

const noop = () => {};

const meta = {
  component: MusicFormSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    documents: [],
    config: null,
    isLoading: false,
    onTurnOn: noop,
    isTurningOn: false,
    onEdit: noop,
  },
} satisfies Meta<typeof MusicFormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  args: { booking: { ...baseBooking, hasMusicFormConfig: false } },
  play: async ({ canvas }) => {
    // Off == no config row. The empty state stays visible (no vanish) and offers a turn-on control.
    await expect(canvas.getByText('No music form')).toBeVisible();
    await expect(canvas.getByText('Set up a music form to collect song requests from your clients.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Turn on music form' })).toBeVisible();
  },
};

export const OnButNotSetUp: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: false },
    config: { ...config, keyMoments: [], enabledGenres: [] },
  },
  play: async ({ canvas }) => {
    // On (config row present) but empty — make it obvious it hasn't been set up.
    await expect(canvas.getByText(/not set up yet/i)).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeVisible();
  },
};

export const ConfiguredNoResponse: Story = {
  args: {
    booking: {
      ...baseBooking,
      hasMusicFormConfig: true,
      hasMusicFormResponse: false,
      portalVisibility: { contract: null, musicForm: { visible: true } },
    },
    config,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('First dance')).toBeVisible();
    await expect(canvas.getByText('Genres')).toBeVisible();
    // Music form on → the portal-visibility badge is shown (ADR-0054).
    await expect(canvas.getByText('Visible on Client Portal')).toBeVisible();
  },
};

export const ResponseReceived: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: true },
    config,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1/music-form-response', () =>
          HttpResponse.json({ selectedSongs: [], specialRequests: [], notes: null, submittedAt: '2030-08-01T12:00:00Z' }),
        ),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Preview' })).toBeVisible();
  },
};

export const WithResponse: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: true },
    config,
  },
  parameters: {
    msw: {
      handlers: [
        http.get('/api/bookings/b1/music-form-response', () =>
          HttpResponse.json({
            selectedSongs: [],
            specialRequests: [
              { key: 'First dance', song: { id: 's1', title: 'At Last', artist: 'Etta James', genre: 'JAZZ' }, freeText: null },
              { key: 'Bridal walk-in', song: null, freeText: 'Something classical' },
            ],
            notes: 'No heavy metal please — keep it mellow during dinner.',
            submittedAt: '2030-08-01T12:00:00Z',
          }),
        ),
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.findByText(/At Last/)).resolves.toBeVisible();
    await expect(canvas.findByText(/Something classical/)).resolves.toBeVisible();
    // The client's submitted notes surface on the completed card (#535).
    await expect(canvas.findByText(/keep it mellow during dinner/)).resolves.toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Preview' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Preview' }));
    const sheet = within(document.body);
    await expect(sheet.findByText('Song requests')).resolves.toBeVisible();
  },
};

export const LoadingConfig: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: false },
    config: null,
    isLoading: true,
  },
};
