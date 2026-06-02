import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { VenueMapWidget } from './VenueMapWidget';

const venue = {
  name: 'The O2 Arena',
  addressLine1: 'Peninsula Square',
  addressLine2: null,
  city: 'London',
  postcode: 'SE10 0DX',
  latitude: 51.503,
  longitude: 0.0032,
};

const venueNoCoords = {
  ...venue,
  latitude: null,
  longitude: null,
};

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

export const HappyPath: Story = {
  args: {
    travelTime: { minutes: 45, distanceMetres: 32000 },
    isLoadingTravelTime: false,
    contactHref: '/contacts/v1',
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText('The O2 Arena')).toBeVisible();
    await expect(canvas.getByText('Peninsula Square, London, SE10 0DX')).toBeVisible();
    await expect(canvas.getByText('~45 min · 32.0 km driving')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /refresh travel time/i }));
    await expect(args.onRefreshTravelTime).toHaveBeenCalledOnce();
  },
};

export const Loading: Story = {
  args: {
    travelTime: null,
    isLoadingTravelTime: true,
  },
};

export const NoTravelTime: Story = {
  args: {
    travelTime: null,
    isLoadingTravelTime: false,
  },
};

export const NoAddress: Story = {
  args: {
    venue: venueNoCoords,
    travelTime: null,
    isLoadingTravelTime: false,
    onRefreshTravelTime: undefined,
  },
};
