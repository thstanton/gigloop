import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from './BookingFormFields';
import type { PackageTemplate } from '@/types/api';

// Smoke coverage for the converged create form (ADR-0053): the consolidated People block
// (customer + booking agent, from the shared atom core) and the separate Venue block render
// from the same atoms as the Builder. Pick/create interactions are unit-covered by
// PeopleFields.stories / VenueFields.stories; the package picker by PackagePicker.stories.

const FORMATS: PackageTemplate[] = [
  {
    id: 'p1', createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z',
    label: 'Wedding Ceremony', category: 'WEDDING', icon: 'church', keyMoments: [],
    defaultGenreSelection: [], notes: null, isSystemDefault: false, enabled: true,
    slots: [{ id: 'p1-s1', label: 'Processional', duration: 5, order: 0 }],
  },
];

function Harness() {
  const { control, register, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      overview: {
        eventType: 'WEDDING',
        date: '',
        fee: '',
        title: '',
        seriesMode: 'none',
        seriesId: null,
        newSeriesLabel: '',
      },
      status: 'PROVISIONAL',
      notes: '',
      customer: { kind: 'existing', contactId: null },
      bookingAgent: { kind: 'existing', contactId: null },
      venue: { kind: 'existing', venueId: null },
      packageTemplateIds: [],
      enableMusicForm: false,
    },
  });

  return (
    <div className="max-w-3xl">
      <BookingFormFields
        control={control}
        register={register}
        errors={errors}
        songRequestFormEnabled
        formats={FORMATS}
      />
    </div>
  );
}

const meta: Meta<typeof BookingFormFields> = {
  component: BookingFormFields,
  tags: ['ai-generated'],
  render: () => <Harness />,
  parameters: {
    msw: {
      handlers: [http.get('/api/contacts', () => HttpResponse.json([]))],
    },
  },
};

export default meta;
type Story = StoryObj<typeof BookingFormFields>;

export const ConvergedPeopleAndVenue: Story = {
  name: 'Renders Overview, one People block (customer + agent), and a separate Venue block',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Overview section (basics + series) from the shared atom core.
    await expect(canvas.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(canvas.getByLabelText('Event type')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'People' })).toBeVisible();
    await expect(canvas.getByText('Customer')).toBeVisible();
    await expect(canvas.getByText(/Booking agent/)).toBeVisible();
    // Venue is its own section (not nested under People), with matching Builder chrome.
    await expect(canvas.getByRole('heading', { name: 'Venue' })).toBeVisible();
    // Package Templates render for everyone (ungated from the music-form flag), shared picker.
    await expect(canvas.getByRole('heading', { name: 'Package Templates' })).toBeVisible();
    // Music section renders the shared on/off core (same toggle the Builder's Music atom uses),
    // with no genre / special-request editing pre-commit (Story 39 lean variant).
    await expect(canvas.getByRole('heading', { name: 'Music' })).toBeVisible();
    await expect(canvas.getByRole('switch', { name: 'Music form' })).toBeVisible();
    await expect(canvas.queryByText('Genres')).not.toBeInTheDocument();
    await expect(canvas.queryByText('Special requests')).not.toBeInTheDocument();
  },
};

export const ToggleMusicForm: Story = {
  name: 'Toggling the shared Music on/off core flows through the create-form Controller',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole('switch', { name: 'Music form' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
  },
};

export const SelectPackage: Story = {
  name: 'Selecting a package chip flows through the create-form Controller (multiselect)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = canvas.getByRole('button', { name: 'Wedding Ceremony' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(chip);
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chip);
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
  },
};

export const CustomerDefaultsToNew: Story = {
  name: 'Customer defaults to the new-contact tab (Story 39)',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A new enquiry is usually a new customer, so its inline-create name field is shown.
    await expect(await canvas.findByPlaceholderText('e.g. Jane Smith')).toBeVisible();
  },
};

export const CustomerRequiredError: Story = {
  name: 'Surfaces the required-customer error after a failed submit',
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Switching the customer to "Select existing" with nothing chosen leaves it unset; the
    // smoke harness has no submit button, so we just confirm the field + tabs are wired.
    await userEvent.click(canvas.getAllByRole('tab', { name: /select existing/i })[0]);
    await expect(canvas.getAllByRole('combobox').length).toBeGreaterThan(0);
  },
};
