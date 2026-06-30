import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ChecklistSection from './ChecklistSection';
import type { ChecklistItem } from '@/types/api';

// useChecklistActions touches the booking/invoice/contract query graph — stub it; this
// spec only exercises the structural-item Builder deep-link (PRD #511 Story 25, slice #525).
vi.mock('@/lib/hooks/useChecklistActions', () => ({
  useChecklistActions: () => ({
    handleChecklistAction: vi.fn(),
    handleMarkDone: vi.fn(),
    isActionPending: false,
  }),
}));

// The embedded concept-card container fetches via useMe/useQueryClient — out of scope
// for this spec (it has its own coverage); stub it so ChecklistSection renders without providers.
vi.mock('./BookingConceptCardContainer', () => ({
  BookingConceptCardContainer: () => null,
}));

function item(partial: Partial<ChecklistItem> & { id: string; key: string | null }): ChecklistItem {
  return {
    id: partial.id,
    createdAt: '',
    updatedAt: '',
    bookingId: 'b1',
    key: partial.key,
    label: partial.label ?? partial.id,
    completedBy: 'USER',
    state: partial.state ?? 'PENDING',
    order: partial.order ?? 0,
    autoCompleteRule: null,
    requiredForStatus: partial.requiredForStatus ?? null,
    completedAt: null,
    dueDate: null,
    dueDateRule: null,
    concern: null,
    shortcutType: partial.shortcutType,
    shortcutTemplateType: partial.shortcutTemplateType,
  };
}

function LocationDisplay() {
  const loc = useLocation();
  return <div data-testid="location">{loc.pathname + loc.search}</div>;
}

function renderChecklist(items: ChecklistItem[]) {
  render(
    <MemoryRouter initialEntries={['/admin/bookings/b1']}>
      <Routes>
        <Route
          path="/admin/bookings/b1"
          element={
            <>
              <ChecklistSection
                bookingId="b1"
                items={items}
                isLoading={false}
                bookingStatus="CONFIRMED"
                onToggle={vi.fn()}
                onAddItem={vi.fn()}
              />
              <LocationDisplay />
            </>
          }
        />
        <Route path="/admin/bookings/b1/builder" element={<LocationDisplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ChecklistSection structural-item deep-links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('build_itinerary deep-links into the Builder at the itinerary step', async () => {
    renderChecklist([item({ id: 'i1', key: 'build_itinerary', label: 'Build itinerary', requiredForStatus: 'READY' })]);

    await userEvent.click(screen.getByRole('button', { name: 'Set up' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/bookings/b1/builder?section=itinerary');
  });

  it('add_venue deep-links into the Builder at the venue step', async () => {
    renderChecklist([item({ id: 'v1', key: 'add_venue', label: 'Add venue', requiredForStatus: 'READY' })]);

    await userEvent.click(screen.getByRole('button', { name: 'Set up' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/admin/bookings/b1/builder?section=venue');
  });

  it('a non-structural item keeps its plain "Mark done" action (no deep-link)', () => {
    renderChecklist([item({ id: 'c1', key: 'custom_item', label: 'Bring the PA', requiredForStatus: 'READY' })]);

    expect(screen.getByRole('button', { name: 'Mark done' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set up' })).not.toBeInTheDocument();
  });
});
