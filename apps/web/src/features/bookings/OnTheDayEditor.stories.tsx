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
const meHandler = http.get('/api/me', () => HttpResponse.json({
  preferences: { customDressCodeOptions: ['Lounge Suit'] },
}));
const mePatchHandler = http.patch('/api/me', () => HttpResponse.json({
  preferences: { customDressCodeOptions: ['Lounge Suit', 'Beach Formal'] },
}));

const meta = {
  component: OnTheDayEditor,
  tags: ['ai-generated'],
  parameters: { msw: { handlers: [patchHandler, meHandler, mePatchHandler] } },
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
    await expect(canvas.getByText('Itinerary')).toBeVisible();
    await expect(canvas.getByText('Details')).toBeVisible();
    await expect(canvas.getByLabelText('Arrival time')).toBeVisible();
    await expect(canvas.getByLabelText('Soundcheck time')).toBeVisible();
    await expect(canvas.getByLabelText('Finish time')).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Dress code' })).toBeVisible();
    await expect(canvas.getByLabelText('Performance space')).toBeVisible();
    await expect(canvas.getByLabelText('Equipment required')).toBeVisible();
  },
};

export const AddCustomDressCode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('combobox', { name: 'Dress code' }));
    const body = within(document.body);
    const searchInput = await body.findByPlaceholderText('Search or add new…');
    await userEvent.type(searchInput, 'Beach Formal');
    await userEvent.click(body.getByText('Add "Beach Formal"'));
  },
};

export const WithExistingData: Story = {
  args: {
    booking: {
      ...baseBooking,
      logistics: {
        arrivalTime:       { value: '14:00', shareWithBand: true,  shareWithClient: false },
        soundCheckTime:    { value: '15:00', shareWithBand: true,  shareWithClient: false },
        finishTime:        { value: '23:00', shareWithBand: false, shareWithClient: false },
        dressCode:         { value: 'Black Tie', shareWithBand: false, shareWithClient: true },
        performanceSpace:  { value: 'Grand ballroom', shareWithBand: false, shareWithClient: false },
        foodProvided:      { value: 'Full dinner', shareWithBand: false, shareWithClient: false },
        greenRoom:         { value: 'Room 12', shareWithBand: false, shareWithClient: false },
        equipmentRequired: { value: 'PA system', shareWithBand: false, shareWithClient: false },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText('Arrival time')).toHaveValue('14:00');
    await expect(canvas.getByLabelText('Soundcheck time')).toHaveValue('15:00');
    await expect(canvas.getByLabelText('Finish time')).toHaveValue('23:00');
    await expect(canvas.getByLabelText('Performance space')).toHaveValue('Grand ballroom');
    await expect(canvas.getByLabelText('Equipment required')).toHaveValue('PA system');
  },
};

export const SaveFlow: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const arrivalInput = canvas.getByLabelText('Arrival time');
    await userEvent.clear(arrivalInput);
    await userEvent.type(arrivalInput, '14:30');
    const spaceInput = canvas.getByLabelText('Performance space');
    await userEvent.type(spaceInput, 'Main stage');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(canvas.getByText('Saved')).toBeVisible();
  },
};

export const AddCustomField: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Add field' }));
    const labelInput = await canvas.findByLabelText('Field label');
    await expect(labelInput).toBeVisible();
    await userEvent.type(labelInput, 'Stage width');
    const valueInput = canvas.getByLabelText('Field value');
    await userEvent.type(valueInput, '6m');
    await userEvent.click(canvas.getByRole('button', { name: 'Done' }));
    await expect(canvas.getByText('Stage width')).toBeVisible();
    await expect(canvas.getByText('6m')).toBeVisible();
  },
};

export const WithExistingCustomFields: Story = {
  args: {
    booking: {
      ...baseBooking,
      logistics: {
        dressCode: { value: 'Black Tie', shareWithBand: false, shareWithClient: true },
        customField1: { value: 'Stage width 6m', label: 'Stage dimensions', shareWithBand: true, shareWithClient: false },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Stage dimensions')).toBeVisible();
    await expect(canvas.getByText('6m', { exact: false })).toBeVisible();
  },
};
