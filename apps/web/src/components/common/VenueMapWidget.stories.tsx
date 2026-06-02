import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { VenueMapWidget } from './VenueMapWidget';

const venue = {
  name: 'The O2 Arena',
  email: 'events@theo2.co.uk',
  phone: '+44 20 8463 2000',
  addressLine1: 'Peninsula Square',
  addressLine2: null,
  city: 'London',
  postcode: 'SE10 0DX',
  latitude: 51.503,
  longitude: 0.0032,
  parkingInfo: 'Use the North Greenwich car park. Show event confirmation for free entry.',
  accessInfo: 'Stage door on Drawdock Road. Security desk open from 14:00.',
  equipmentAvailable: 'Full PA, lighting rig, grand piano.',
};

const venueNoCoords = { ...venue, latitude: null, longitude: null };

const meta = {
  title: 'Common/VenueMapWidget',
  component: VenueMapWidget,
  tags: ['autodocs'],
  decorators: [(Story) => React.createElement(MemoryRouter, {}, React.createElement(Story))],
  args: {
    venue,
    onRefreshTravelTime: fn(),
  },
} satisfies Meta<typeof VenueMapWidget>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Booking detail page — full header + venue details + travel + map. */
export const BookingPage: Story = {
  args: {
    showHeader: true,
    travelTime: { minutes: 45, distanceMetres: 32000 },
    isLoadingTravelTime: false,
    contactHref: '/admin/contacts/v1',
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('The O2 Arena')).toBeVisible();
    await expect(canvas.getByText('Peninsula Square, London, SE10 0DX')).toBeVisible();
    await expect(canvas.getByText('Parking')).toBeVisible();
    await expect(canvas.getByText('Access')).toBeVisible();
    await expect(canvas.getByText('Equipment')).toBeVisible();
    await expect(canvas.getByText('~45 min · 32.0 km driving')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /refresh travel time/i }));
    await expect(args.onRefreshTravelTime).toHaveBeenCalledOnce();
  },
};

/** Contact detail page — header hidden (name/contact shown elsewhere on the page). */
export const ContactPage: Story = {
  args: {
    showHeader: false,
    travelTime: { minutes: 45, distanceMetres: 32000 },
    isLoadingTravelTime: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('The O2 Arena')).toBeNull();
    await expect(canvas.getByText('Parking')).toBeVisible();
    await expect(canvas.getByText('~45 min · 32.0 km driving')).toBeVisible();
  },
};

export const LoadingTravelTime: Story = {
  args: {
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: true,
    contactHref: '/admin/contacts/v1',
  },
};

export const NoTravelTime: Story = {
  args: {
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: false,
    contactHref: '/admin/contacts/v1',
  },
};

export const NoAddress: Story = {
  args: {
    venue: venueNoCoords,
    showHeader: true,
    travelTime: null,
    isLoadingTravelTime: false,
    onRefreshTravelTime: undefined,
    contactHref: '/admin/contacts/v1',
  },
};
