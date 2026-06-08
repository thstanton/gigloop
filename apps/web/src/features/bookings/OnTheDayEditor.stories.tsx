import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import OnTheDayEditor from './OnTheDayEditor';
import type { BookingDetail } from '@/types/api';

const baseBooking: BookingDetail = {
  id: 'bd1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  status: 'CONFIRMED', eventType: 'WEDDING', date: '2030-09-15T15:00:00Z',
  title: "Sophie's Wedding", fee: '2000.00', notes: null,
  customerId: 'c2',
  customer: { id: 'c2', name: 'Sophie Taylor', email: 'sophie@example.com', phone: null, addressLine1: null, addressLine2: null, city: null, county: null, postcode: null, country: null, latitude: null, longitude: null, placeId: null, travelTimeMinutes: null, travelDistanceMetres: null, travelTimeCalculatedAt: null, travelMode: null, notes: null, greetingName: 'Sophie', primaryRole: 'CUSTOMER', parkingInfo: null, accessInfo: null, equipmentAvailable: null, website: null, commissionArrangement: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z' },
  venueId: null, venue: null, bookingAgentId: null, bookingAgent: null,
  sets: [], packages: [],
  activeContract: null, depositReceivedAt: null, portalToken: 'tok_test',
  hasMusicFormConfig: false, hasMusicFormResponse: false,
  seriesId: null, series: null,
  logistics: null,
};

const patchHandler = http.patch('/api/bookings/bd1', () => HttpResponse.json({ ...baseBooking }));

const meta = {
  component: OnTheDayEditor,
  tags: ['ai-generated'],
  parameters: { msw: { handlers: [patchHandler] } },
  args: {
    booking: baseBooking,
    isOpen: true,
  },
} satisfies Meta<typeof OnTheDayEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('On the day')).toBeVisible();
    await expect(canvas.getByLabelText('Arrival time')).toBeVisible();
    await expect(canvas.getByLabelText('Soundcheck time')).toBeVisible();
    await expect(canvas.getByLabelText('Finish time')).toBeVisible();
  },
};

export const WithExistingData: Story = {
  args: {
    booking: {
      ...baseBooking,
      logistics: {
        arrivalTime:    { value: '14:00', shareWithBand: true,  shareWithClient: false },
        soundCheckTime: { value: '15:00', shareWithBand: true,  shareWithClient: false },
        finishTime:     { value: '23:00', shareWithBand: false, shareWithClient: false },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Arrival time')).toHaveValue('14:00');
    await expect(canvas.getByLabelText('Soundcheck time')).toHaveValue('15:00');
    await expect(canvas.getByLabelText('Finish time')).toHaveValue('23:00');
  },
};

export const SaveFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const arrivalInput = canvas.getByLabelText('Arrival time');
    await userEvent.clear(arrivalInput);
    await userEvent.type(arrivalInput, '14:30');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};
