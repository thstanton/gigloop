import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
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
  // Only the Preview story's PreviewBanner needs a Router (its "Back to booking" `Link`), but the
  // wrapper is harmless for the rest, so it sits on the shared meta rather than one story.
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: {
    data: ACTIVE_DATA,
    token: 'story-token',
    onConfirm: fn(),
    onDecline: fn(),
    pendingResponse: null,
  },
} satisfies Meta<typeof BandGigSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

// Page-level smoke (ADR-0024) — the gig identity, running order, roster (own chair highlighted)
// and logistics all render. ACTIVE_DATA's self.status is CONFIRMED, so the response bar (#892)
// reads as already-answered here — Unanswered/Confirmed/Declined below cover the response bar itself.
export const Default: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Sophie & Tom's Wedding")).toBeVisible();
    await expect(canvas.getByText('The Old Barn')).toBeVisible();
    await expect(canvas.getByText('Dave Player')).toBeVisible();
    await expect(canvas.getByText('Vacant')).toBeVisible();
    await expect(canvas.getByText('£150.00')).toBeVisible();
    await expect(canvas.getByRole('link', { name: /Download call sheet/i })).toBeVisible();
  },
};

// #892's story task: the sticky response bar in its three states.
export const Unanswered: Story = {
  args: { data: { ...ACTIVE_DATA, self: { ...ACTIVE_DATA.self, status: 'INVITED' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Are you in for this gig?')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeVisible();
  },
};

export const Confirmed: Story = {
  args: { data: { ...ACTIVE_DATA, self: { ...ACTIVE_DATA.self, status: 'CONFIRMED' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("You've confirmed you're playing this gig.")).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
  },
};

export const Declined: Story = {
  args: { data: { ...ACTIVE_DATA, self: { ...ACTIVE_DATA.self, status: 'DECLINED' } } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("You've declined this gig.")).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Decline' })).not.toBeInTheDocument();
  },
};

export const Cancelled: Story = {
  args: { data: CANCELLED_DATA },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This gig has been cancelled.')).toBeVisible();
    expect(canvas.queryByText('Band')).not.toBeInTheDocument();
    expect(canvas.queryByText('Are you in for this gig?')).not.toBeInTheDocument();
  },
};

// #980 — the organiser's admin preview of a dep's own unanswered view: the banner names the dep
// (read off their own highlighted chair, not a prop), and the response bar is visible but inert.
export const Preview: Story = {
  args: {
    data: { ...ACTIVE_DATA, self: { ...ACTIVE_DATA.self, status: 'INVITED' } },
    isPreview: true,
    previewFrom: '/admin/bookings/booking-1',
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText((_, element) => element?.textContent === 'Preview — this is what Dave Player sees'),
    ).toBeVisible();
    await expect(canvas.getAllByText('Dave Player').length).toBeGreaterThan(0);
    await expect(canvas.getByText('Preview only — response disabled')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Confirm' })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Decline' })).toBeDisabled();
  },
};
