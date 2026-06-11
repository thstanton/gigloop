import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
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
      id: 'bp1', order: 0, packageId: 'pkg1',
      package: { id: 'pkg1', label: 'Wedding Package', icon: 'heart', keyMoments: ['First dance', 'Bridal walk-in'], defaultGenreSelection: ['JAZZ', 'CLASSICAL'] },
    },
  ],
  activeContract: null, depositReceivedAt: null, portalToken: 'tok_abc',
  hasMusicFormConfig: false, hasMusicFormResponse: false,
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
    onUpdateConfig: noop,
    onEdit: noop,
  },
} satisfies Meta<typeof MusicFormSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotConfigured: Story = {
  args: { booking: { ...baseBooking, hasMusicFormConfig: false } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Music form')).toBeVisible();
    await expect(canvas.getByText('Configure song request form')).toBeVisible();
    const ghost = canvas.getByText('Music form').closest('div');
    await expect(ghost).not.toHaveClass('border');
  },
};

export const ConfiguredNoResponse: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: false },
    config,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('First dance')).toBeVisible();
    await expect(canvas.getByText('Genres')).toBeVisible();
  },
};

export const ResponseReceived: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: true },
    config,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Response received/)).toBeVisible();
  },
};

export const LoadingConfig: Story = {
  args: {
    booking: { ...baseBooking, hasMusicFormConfig: true, hasMusicFormResponse: false },
    config: null,
    isLoading: true,
  },
};
