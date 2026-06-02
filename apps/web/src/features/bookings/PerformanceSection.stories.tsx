import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import PerformanceSection from './PerformanceSection';
import type { BookingDetail } from '@/types/api';

const baseBooking: BookingDetail = {
  id: 'b1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  status: 'CONFIRMED', eventType: 'WEDDING', date: '2030-09-15T15:00:00Z',
  title: 'Smith Wedding', fee: '2000.00', notes: null,
  customerId: 'c1',
  customer: { id: 'c1', name: 'Jane Smith', email: 'jane@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Jane', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  venueId: null, venue: null, bookingAgentId: null, bookingAgent: null,
  sets: [], packages: [],
  activeContract: null, depositReceivedAt: null, portalToken: 'tok_abc',
  hasMusicFormConfig: false, hasMusicFormResponse: false,
  seriesId: null, series: null,
};

const weddingPackage = {
  id: 'bp1', order: 0, packageId: 'pkg1',
  package: { id: 'pkg1', label: 'Wedding Package', icon: 'heart', keyMoments: [], defaultGenreSelection: [] },
};

const corporatePackage = {
  id: 'bp2', order: 1, packageId: 'pkg2',
  package: { id: 'pkg2', label: 'Corporate Dinner', icon: 'briefcase', keyMoments: [], defaultGenreSelection: [] },
};

const meta = {
  component: PerformanceSection,
  tags: ['ai-generated'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: { onEdit: () => {} },
} satisfies Meta<typeof PerformanceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoPackages: Story = {
  args: { booking: baseBooking },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No formats applied')).toBeVisible();
  },
};

export const SingleFormatWithSets: Story = {
  args: {
    booking: {
      ...baseBooking,
      packages: [weddingPackage],
      sets: [
        { id: 's1', order: 0, duration: 60, startTime: '15:30', label: 'Ceremony', packageId: 'pkg1' },
        { id: 's2', order: 1, duration: 180, startTime: '18:00', label: 'Reception', packageId: 'pkg1' },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Wedding Package')).toBeVisible();
    await expect(canvas.getByText(/Ceremony/)).toBeVisible();
    await expect(canvas.getByText('15:30')).toBeVisible();
  },
};

export const MultipleFormats: Story = {
  args: {
    booking: {
      ...baseBooking,
      packages: [weddingPackage, corporatePackage],
      sets: [
        { id: 's1', order: 0, duration: 60, startTime: null, label: 'Ceremony', packageId: 'pkg1' },
        { id: 's2', order: 1, duration: 45, startTime: '19:00', label: 'Welcome drinks', packageId: 'pkg2' },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Wedding Package')).toBeVisible();
    await expect(canvas.getByText('Corporate Dinner')).toBeVisible();
  },
};

export const SetsWithStartTimes: Story = {
  args: {
    booking: {
      ...baseBooking,
      packages: [weddingPackage],
      sets: [
        { id: 's1', order: 0, duration: 45, startTime: '14:00', label: 'Pre-ceremony', packageId: 'pkg1' },
        { id: 's2', order: 1, duration: 60, startTime: '15:00', label: 'Ceremony', packageId: 'pkg1' },
        { id: 's3', order: 2, duration: 90, startTime: '18:30', label: 'Dinner', packageId: 'pkg1' },
      ],
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('14:00')).toBeVisible();
    await expect(canvas.getByText('15:00')).toBeVisible();
    await expect(canvas.getByText('18:30')).toBeVisible();
  },
};
