import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { MemoryRouter } from 'react-router-dom';
import { bookingDetail } from '@/test/factories';
import { BookingDetailMobileContent } from './BookingDetailMobileContent';
import type { MobileBookingContentActions, MobileBookingContentData } from './BookingDetailMobileContent';

const booking = bookingDetail();
const data: MobileBookingContentData = {
  booking,
  bookingId: booking.id,
  backState: { from: `/admin/bookings/${booking.id}`, label: booking.title ?? 'Wedding' },
  bandData: null,
  documents: [],
  musicFormConfig: null,
  musicFormConfigLoading: false,
  isTurningOnMusicForm: false,
  seriesBookings: [],
  seriesBookingsLoading: false,
  invoices: [],
  contractShortcutType: 'contract_cover',
  contractActions: {
    createContract: fn(),
    isCreatingContract: false,
    voidContract: fn(),
    isVoidingContract: false,
    deleteContract: fn(),
    isDeletingContract: false,
  },
  fields: { updateNotes: fn(), isNotesPending: false },
  missingConcerns: [],
  communications: [],
};
const actions: MobileBookingContentActions = {
  navigate: fn(),
  setSearchParams: fn(),
  openCompose: fn(),
  openEditInvoice: fn(),
  onTurnOnMusicForm: fn(),
  onEditMusicForm: fn(),
};

const meta = {
  component: BookingDetailMobileContent,
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  parameters: { viewport: { defaultViewport: 'mobile2' } },
  args: {
    data,
    actions,
    defaultTab: 'checklist',
    checklist: <p>Checklist content</p>,
  },
} satisfies Meta<typeof BookingDetailMobileContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BookingDetailTabs: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: 'Checklist' })).toBeVisible();
    await expect(canvas.getByRole('tab', { name: 'On the Day' })).toBeVisible();
    await expect(canvas.getByRole('tab', { name: 'Info' })).toBeVisible();
  },
};
