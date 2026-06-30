import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Control } from 'react-hook-form';
import BookingNewPage from './BookingNewPage';
import type { BookingFormValues } from '@/features/bookings/BookingFormFields';
import * as api from '@/lib/api';
import type {
  BookingDetail,
  BookingStatus,
  ChecklistDefaultItem,
  Contact,
  ReminderPreview,
  UserProfile,
} from '@/types/api';

// Characterization test for the New Booking page's *orchestration* (the part being refactored):
// the two-step flow, the atomic create payload, the resolvedIds retry-dedup, and the profile
// defaults effect. The three heavy children are mocked so the test pins the page's wiring rather
// than re-testing BookingFormFields / ChecklistStep / CreatedCheckpoint (each covered separately).
// The BookingFormFields double is wired to the *real* form control, so picking an existing vs a
// new customer drives the genuine eager-create path.

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));

// The reminder selection ChecklistStep would hand back — the page forwards it verbatim as the
// create payload's checklistItems, so the test asserts on exactly this array.
const { CANNED_ITEMS } = vi.hoisted(() => ({
  CANNED_ITEMS: [
    {
      key: 'send_quote',
      label: 'Send the quote',
      completedBy: 'USER',
      autoCompleteRule: null,
      requiredForStatus: 'PROVISIONAL',
      dueDateRule: null,
    },
  ] as ChecklistDefaultItem[],
}));

vi.mock('@clerk/react', () => ({ useAuth: () => ({ isLoaded: true }) }));

vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

vi.mock('@/lib/api');

// Keep the real schema (the page's zodResolver depends on it); swap only the component for a double
// wired to the live form control so the test can choose an existing or a new customer.
vi.mock('@/features/bookings/BookingFormFields', async (importActual) => {
  const actual = await importActual<typeof import('@/features/bookings/BookingFormFields')>();
  const { useController, useWatch } = await import('react-hook-form');
  return {
    ...actual,
    BookingFormFields: ({ control }: { control: Control<BookingFormValues> }) => {
      const { field } = useController({ control, name: 'customer' });
      const status = useWatch({ control, name: 'status' });
      return (
        <div>
          <span data-testid="form-status">{status}</span>
          <button
            type="button"
            onClick={() => field.onChange({ kind: 'existing', contactId: 'cust-existing' })}
          >
            pick-existing-customer
          </button>
          <button
            type="button"
            onClick={() => field.onChange({ kind: 'new', contact: { name: 'New Client' } })}
          >
            pick-new-customer
          </button>
        </div>
      );
    },
  };
});

vi.mock('@/features/bookings/ChecklistStep', () => ({
  ChecklistStep: ({
    startingStatus,
    preview,
    isCreating,
    isError,
    onBack,
    onCreate,
  }: {
    startingStatus: BookingStatus;
    preview: ReminderPreview[];
    isCreating: boolean;
    isError: boolean;
    onBack: () => void;
    onCreate: (items: ChecklistDefaultItem[]) => void;
  }) => (
    <div data-testid="checklist-step">
      <span data-testid="starting-status">{startingStatus}</span>
      <span data-testid="preview-count">{preview.length}</span>
      {isCreating && <span data-testid="creating">creating</span>}
      {isError && <span data-testid="create-error">error</span>}
      <button type="button" onClick={onBack}>
        go-back
      </button>
      <button type="button" onClick={() => onCreate(CANNED_ITEMS)}>
        do-create
      </button>
    </div>
  ),
}));

vi.mock('@/features/bookings/CreatedCheckpoint', () => ({
  CreatedCheckpoint: ({
    title,
    onFinish,
    onContinue,
  }: {
    title: string;
    onFinish: () => void;
    onContinue: () => void;
  }) => (
    <div>
      <span data-testid="created-checkpoint">{title}</span>
      <button type="button" onClick={onFinish}>
        finish
      </button>
      <button type="button" onClick={onContinue}>
        continue
      </button>
    </div>
  ),
}));

const userProfile = {
  id: 'profile-1',
  songRequestFormEnabled: true,
  preferences: { defaultBookingStatus: 'CONFIRMED', checklistDefaults: [] },
} as unknown as UserProfile;

const createdBooking = {
  id: 'bk-1',
  title: 'My Gig',
  eventType: 'WEDDING',
} as unknown as BookingDetail;

function mockGet() {
  vi.mocked(api.apiGet).mockImplementation((url: string) => {
    if (url === '/me') return Promise.resolve(userProfile);
    if (url === '/packages') return Promise.resolve([]);
    if (url === '/series') return Promise.resolve([]);
    if (url.startsWith('/bookings/checklist/reminders/preview')) return Promise.resolve([]);
    return Promise.reject(new Error(`Unexpected GET: ${url}`));
  });
}

function renderPage() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter initialEntries={[{ pathname: '/admin/bookings/new', state: { date: '2025-06-01' } }]}>
        <BookingNewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Wait until the profile-default effect has seeded the status (so step 2 / the payload carry it).
async function renderWithLoadedProfile() {
  renderPage();
  await waitFor(() => expect(screen.getByTestId('form-status')).toHaveTextContent('CONFIRMED'));
}

const bookingPayload = () =>
  vi.mocked(api.apiPost).mock.calls.find(([url]) => url === '/bookings')?.[1] as Record<string, unknown>;

const contactsCalls = () =>
  vi.mocked(api.apiPost).mock.calls.filter(([url]) => url === '/contacts');

describe('BookingNewPage — orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet();
  });

  it('advances from the form to the reminders step and back, preserving the seeded form', async () => {
    vi.mocked(api.apiPost).mockResolvedValue(createdBooking);
    await renderWithLoadedProfile();

    await userEvent.click(screen.getByRole('button', { name: 'pick-existing-customer' }));
    await userEvent.click(screen.getByRole('button', { name: /next: checklist/i }));

    expect(screen.getByTestId('checklist-step')).toBeInTheDocument();
    // The step is previewed for the profile-defaulted starting status.
    expect(screen.getByTestId('starting-status')).toHaveTextContent('CONFIRMED');

    await userEvent.click(screen.getByRole('button', { name: 'go-back' }));

    // Back returns to step 1 and the form is not remounted, so its seeded status survives. (The
    // mounted-but-hidden wrapper also protects RoleField's *uncontrolled* typed-new-contact state,
    // but that lives in the real atom — not this control-wired double — so it isn't pinned here.)
    expect(screen.queryByTestId('checklist-step')).not.toBeInTheDocument();
    expect(screen.getByTestId('form-status')).toHaveTextContent('CONFIRMED');
  });

  it('creates an FK-only booking seeded from the profile, then lands on the checkpoint', async () => {
    vi.mocked(api.apiPost).mockResolvedValue(createdBooking);
    await renderWithLoadedProfile();

    await userEvent.click(screen.getByRole('button', { name: 'pick-existing-customer' }));
    await userEvent.click(screen.getByRole('button', { name: /next: checklist/i }));
    await userEvent.click(screen.getByRole('button', { name: 'do-create' }));

    await waitFor(() => expect(screen.getByTestId('created-checkpoint')).toBeInTheDocument());

    // Existing customer → no eager /contacts create; the booking POST is FK-only.
    expect(contactsCalls()).toHaveLength(0);
    expect(bookingPayload()).toEqual(
      expect.objectContaining({
        customerId: 'cust-existing',
        eventType: 'WEDDING',
        date: '2025-06-01',
        status: 'CONFIRMED', // from preferences.defaultBookingStatus
        enableMusicForm: true, // from songRequestFormEnabled
        checklistItems: CANNED_ITEMS,
      }),
    );

    // The checkpoint's Finish navigates to the created booking.
    expect(screen.getByTestId('created-checkpoint')).toHaveTextContent('My Gig');
    await userEvent.click(screen.getByRole('button', { name: 'finish' }));
    expect(navigateSpy).toHaveBeenCalledWith('/admin/bookings/bk-1');
  });

  it('does not re-create the new contact when a failed create is retried', async () => {
    // Eager contact create succeeds; the first booking POST fails, the retry succeeds.
    let bookingAttempts = 0;
    vi.mocked(api.apiPost).mockImplementation((url: string) => {
      if (url === '/contacts') return Promise.resolve({ id: 'new-cust-1' } as Contact);
      if (url === '/bookings') {
        bookingAttempts += 1;
        return bookingAttempts === 1
          ? Promise.reject(new Error('boom'))
          : Promise.resolve(createdBooking);
      }
      return Promise.reject(new Error(`Unexpected POST: ${url}`));
    });

    await renderWithLoadedProfile();
    await userEvent.click(screen.getByRole('button', { name: 'pick-new-customer' }));
    await userEvent.click(screen.getByRole('button', { name: /next: checklist/i }));

    // First attempt fails — error surfaces, no checkpoint yet.
    await userEvent.click(screen.getByRole('button', { name: 'do-create' }));
    await waitFor(() => expect(screen.getByTestId('create-error')).toBeInTheDocument());

    // Retry succeeds and lands on the checkpoint.
    await userEvent.click(screen.getByRole('button', { name: 'do-create' }));
    await waitFor(() => expect(screen.getByTestId('created-checkpoint')).toBeInTheDocument());

    // The crown-jewel invariant: the new contact was created exactly once across both attempts.
    expect(contactsCalls()).toHaveLength(1);
    expect(contactsCalls()[0][1]).toEqual(
      expect.objectContaining({ name: 'New Client', primaryRole: 'CUSTOMER' }),
    );
    expect(bookingAttempts).toBe(2);
    expect(bookingPayload()).toEqual(expect.objectContaining({ customerId: 'new-cust-1' }));
  });
});
