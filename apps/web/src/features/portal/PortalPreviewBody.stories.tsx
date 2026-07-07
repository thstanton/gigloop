import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { PortalPreviewBody, type PreviewPage } from './PortalPreviewBody';
import type { Overrides } from '@/features/portal/CustomiseSheet';
import type { PublicProfile } from '@/types/api';

const PROFILE = {
  businessName: 'The Aurora Quartet',
  displayName: 'James',
  bio: 'Elegant live music for weddings and events.',
  email: 'hello@auroraquartet.co.uk',
  phone: '07700 900123',
  website: null,
  logoUrl: null,
  photo: null,
  clientPortalConfig: null,
} as unknown as PublicProfile;

const OVERRIDES: Overrides = {
  theme: 'LIGHT_MODERN',
  brandColour: '#1a1a1a',
  heroImage: null,
  showContactPhoto: false,
  showContactEmail: true,
  showContactPhone: false,
};

// The container owns previewPage + navigation; this harness supplies it so the
// booking-page CTAs can switch views, mirroring how the admin page wires it.
function Harness({ overrides = OVERRIDES }: { overrides?: Overrides }) {
  const [page, setPage] = useState<PreviewPage>('booking');
  return (
    <MemoryRouter>
      <PortalPreviewBody
        profile={PROFILE}
        overrides={overrides}
        previewPage={page}
        onNavigate={setPage}
      />
    </MemoryRouter>
  );
}

const meta = {
  title: 'Portal/PortalPreviewBody',
  component: PortalPreviewBody,
  tags: ['ai-generated'],
  args: {
    profile: PROFILE,
    overrides: OVERRIDES,
    previewPage: 'booking',
    onNavigate: () => {},
  },
} satisfies Meta<typeof PortalPreviewBody>;

export default meta;
type Story = StoryObj<typeof meta>;

// Smoke — the booking preview renders the mock booking with its venue and CTAs.
export const Booking: Story = {
  render: () => <Harness />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The Grand Ballroom')).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Choose your songs/ })).toBeVisible();
  },
};

// Primary use case — navigating from the booking page to the music form via its CTA.
export const NavigatesToMusic: Story = {
  render: () => <Harness />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Choose your songs/ }));
    await expect(canvas.getByText('Song requests')).toBeVisible();
  },
};
