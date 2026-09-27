import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { BandGigSheet } from './BandGigSheet';
import type { BandPortalData } from '@/types/api';

const BRANDING: BandPortalData['branding'] = {
  businessName: 'The Aurora Quartet',
  displayName: 'James',
  logoUrl: null,
  brandColour: '#1a1a1a',
  portalTheme: 'LIGHT_MODERN',
  email: 'james@auroraquartet.co.uk',
  phone: '07700 900123',
};

const ACTIVE_DATA: BandPortalData = {
  cancelled: false,
  branding: BRANDING,
  roster: {
    bookingTitle: "Sophie & Tom's Wedding",
    bookingDate: '2027-06-12T00:00:00.000Z',
    venueName: 'The Old Barn',
    venueAddress: {
      line1: '1 Barn Lane',
      line2: null,
      city: 'Bath',
      county: 'Somerset',
      postcode: 'BA1 1AA',
      country: 'GB',
    },
    sets: [
      { order: 0, label: null, startTime: '17:30', duration: 30, packageId: 'pkg-drinks' },
      { order: 1, label: 'First set', startTime: '19:00', duration: 45, packageId: 'pkg-evening' },
      { order: 2, label: 'Second set', startTime: '20:00', duration: 45, packageId: 'pkg-evening' },
    ],
    segments: [
      { id: 'pkg-drinks', label: 'Drinks Reception', icon: 'wine', order: 0 },
      { id: 'pkg-evening', label: 'Evening Party', icon: 'music', order: 1 },
    ],
    chairs: [
      {
        id: 'chair-sax',
        role: 'Saxophone',
        memberName: 'Dave Player',
        callTimes: [
          { segmentId: 'pkg-drinks', segmentLabel: 'Drinks Reception', startTime: '17:30' },
          { segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:00' },
        ],
      },
      {
        id: 'chair-drums',
        role: 'Drums',
        memberName: null,
        callTimes: [{ segmentId: 'pkg-evening', segmentLabel: 'Evening Party', startTime: '19:00' }],
      },
    ],
    logistics: [
      { key: 'arrivalTime', value: '16:30' },
      { key: 'travelPlan', value: 'Free parking behind the barn — text James on arrival.' },
    ],
  },
  self: {
    status: 'CONFIRMED',
    sessionFee: '150.00',
    ownChairIds: ['chair-sax'],
  },
};

const CANCELLED_DATA: BandPortalData = {
  cancelled: true,
  branding: BRANDING,
};

const meta = {
  title: 'Portal/BandGigSheet',
  component: BandGigSheet,
  tags: ['ai-generated'],
  args: { data: ACTIVE_DATA },
} satisfies Meta<typeof BandGigSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// Page-level smoke (ADR-0024) — the gig identity, running order, roster (own chair highlighted)
// and logistics all render.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Sophie & Tom's Wedding")).toBeVisible();
    await expect(canvas.getByText('The Old Barn')).toBeVisible();
    await expect(canvas.getByText('Dave Player')).toBeVisible();
    await expect(canvas.getByText('Vacant')).toBeVisible();
    await expect(canvas.getByText('£150.00')).toBeVisible();
  },
};

export const Cancelled: Story = {
  args: { data: CANCELLED_DATA },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This gig has been cancelled.')).toBeVisible();
    expect(canvas.queryByText('Band')).not.toBeInTheDocument();
  },
};
