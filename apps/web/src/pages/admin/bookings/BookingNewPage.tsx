import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/common/PageHeader';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckSquare, Square, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookingFormFields,
  bookingFormSchema,
  type BookingFormValues,
} from '@/features/bookings/BookingFormFields';
import { apiGet, apiPost } from '@/lib/api';
import type {
  BookingDetail,
  BookingStatus,
  ChecklistDefaultItem,
  EventType,
  Package,
  UserProfile,
} from '@/types/api';

const STAGE_LABELS: Record<string, string> = {
  PROVISIONAL: 'Provisional',
  CONFIRMED: 'Confirmed',
  READY: 'Ready',
  COMPLETE: 'Complete',
};

const STAGE_ORDER: Array<BookingStatus | null> = [
  null, 'ENQUIRY', 'PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE',
];
const STATUS_TO_STAGE: Record<string, BookingStatus | null> = {
  ENQUIRY: null, PROVISIONAL: 'PROVISIONAL', CONFIRMED: 'CONFIRMED',
  READY: 'READY', COMPLETE: 'COMPLETE', CANCELLED: 'COMPLETE',
};

function filterByStartingStatus(
  items: ChecklistDefaultItem[],
  startingStatus: BookingStatus,
): ChecklistDefaultItem[] {
  const startStage = STATUS_TO_STAGE[startingStatus] ?? null;
  const startIdx = STAGE_ORDER.indexOf(startStage);
  return items.filter((item) => {
    if (item.requiredForStatus === null) return true;
    return STAGE_ORDER.indexOf(item.requiredForStatus) > startIdx;
  });
}

export default function BookingNewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isLoaded } = useAuth();

  const [step, setStep] = useState<1 | 2>(1);
  const [pendingValues, setPendingValues] = useState<BookingFormValues | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [customItems, setCustomItems] = useState<Array<{ label: string; stage: string }>>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newStage, setNewStage] = useState('CONFIRMED');

  const locationState = location.state as { customerId?: string; venueId?: string; bookingAgentId?: string; date?: string } | null;

  const { data: userProfile } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet<UserProfile>('/me'),
    enabled: isLoaded,
  });

  const { data: formats } = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiGet<Package[]>('/packages'),
    enabled: isLoaded && (userProfile?.songRequestFormEnabled ?? false),
  });

  const { register, control, handleSubmit, setValue, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      eventType: 'WEDDING',
      date: locationState?.date ?? '',
      status: 'PROVISIONAL',
      title: '',
      fee: '',
      notes: '',
      customerId: locationState?.customerId ?? '',
      venueId: locationState?.venueId ?? null,
      bookingAgentId: locationState?.bookingAgentId ?? null,
      formatIds: [],
    },
  });

  useEffect(() => {
    if (locationState?.customerId) setValue('customerId', locationState.customerId);
    if (locationState?.venueId) setValue('venueId', locationState.venueId);
    if (locationState?.bookingAgentId) setValue('bookingAgentId', locationState.bookingAgentId);
    if (locationState?.date) setValue('date', locationState.date);
  }, [locationState?.customerId, locationState?.venueId, locationState?.bookingAgentId, locationState?.date, setValue]);

  useEffect(() => {
    if (!userProfile) return;
    const pref = (userProfile.preferences as { defaultBookingStatus?: string } | undefined)?.defaultBookingStatus ?? 'PROVISIONAL';
    setValue('status', pref as BookingFormValues['status']);
  }, [userProfile?.id, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (payload: { values: BookingFormValues; checklistItems: ChecklistDefaultItem[] }) => {
      const { values, checklistItems } = payload;
      return apiPost<BookingDetail>('/bookings', {
        eventType: values.eventType as EventType,
        date: values.date,
        customerId: values.customerId,
        status: values.status as BookingStatus,
        title: values.title || undefined,
        fee: values.fee ? parseFloat(values.fee) : undefined,
        notes: values.notes || undefined,
        venueId: values.venueId ?? undefined,
        bookingAgentId: values.bookingAgentId ?? undefined,
        formatIds: values.formatIds.length ? values.formatIds : undefined,
        checklistItems,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(`/admin/bookings/${created.id}`);
    },
  });

  function advanceToStep2(values: BookingFormValues) {
    const defaults = userProfile?.preferences?.checklistDefaults ?? [];
    const filtered = filterByStartingStatus(defaults, values.status as BookingStatus);
    setPendingValues(values);
    // Pre-select enabled items only; disabled items appear unchecked (opt-in per booking)
    setSelectedIndices(new Set(filtered.map((_, i) => i).filter((i) => filtered[i].enabled !== false)));
    setCustomItems([]);
    setStep(2);
  }

  function toggleIndex(idx: number) {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function addCustomItem() {
    if (!newLabel.trim()) return;
    setCustomItems((prev) => [...prev, { label: newLabel.trim(), stage: newStage }]);
    setNewLabel('');
  }

  function handleCreate() {
    if (!pendingValues) return;
    const defaults = userProfile?.preferences?.checklistDefaults ?? [];
    const filtered = filterByStartingStatus(defaults, pendingValues.status as BookingStatus);
    const selected = filtered.filter((_, i) => selectedIndices.has(i));
    const custom: ChecklistDefaultItem[] = customItems
      .filter((ci) => ci.label.trim())
      .map((ci) => ({
        key: null,
        label: ci.label.trim(),
        completedBy: 'USER' as const,
        dependsOn: [],
        autoCompleteRule: null,
        requiredForStatus: ci.stage as ChecklistDefaultItem['requiredForStatus'],
        dueDateRule: null,
      }));
    mutation.mutate({ values: pendingValues, checklistItems: [...selected, ...custom] });
  }

  // ─── Step 2: Checklist customisation ─────────────────────────────────────────

  if (step === 2 && pendingValues) {
    const defaults = userProfile?.preferences?.checklistDefaults ?? [];
    const filtered = filterByStartingStatus(defaults, pendingValues.status as BookingStatus);
    const grouped = (['PROVISIONAL', 'CONFIRMED', 'READY', 'COMPLETE'] as const)
      .map((stage) => ({
        stage,
        entries: filtered
          .map((item, idx) => ({ item, idx }))
          .filter(({ item }) => item.requiredForStatus === stage),
      }))
      .filter(({ entries }) => entries.length > 0);

    return (
      <div className="px-6 py-8 max-w-3xl mx-auto">
        <PageHeader title="Checklist" onBack={() => setStep(1)} backLabel="Back" />
        <p className="text-sm text-muted -mt-4 mb-6">
          Choose which items to include. You can adjust these on the booking page later.
        </p>

        {grouped.length > 0 ? (
          <div className="space-y-5 mb-6">
            {grouped.map(({ stage, entries }) => (
              <div key={stage}>
                <p className="text-xs font-medium text-muted uppercase tracking-wide border-b border-border pb-1 mb-2">
                  {STAGE_LABELS[stage]}
                </p>
                <div className="space-y-1">
                  {entries.map(({ item, idx }) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleIndex(idx)}
                      className="flex items-center gap-2.5 w-full text-left py-1 group"
                    >
                      {selectedIndices.has(idx) ? (
                        <CheckSquare size={16} className="flex-shrink-0 text-primary" />
                      ) : (
                        <Square size={16} className="flex-shrink-0 text-muted" />
                      )}
                      <span className={`text-sm ${selectedIndices.has(idx) ? 'text-foreground' : 'text-muted'}`}>
                        {item.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted mb-6">No default checklist items for this booking stage.</p>
        )}

        {/* Custom items */}
        <div className="border-t border-border pt-4 mb-6">
          <p className="text-xs font-medium text-muted uppercase tracking-wide mb-3">Add a custom item</p>
          <div className="flex gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Item label"
              className="flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomItem(); } }}
            />
            <Select value={newStage} onValueChange={setNewStage}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PROVISIONAL">Provisional</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="COMPLETE">Complete</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={addCustomItem} disabled={!newLabel.trim()}>
              Add
            </Button>
          </div>
          {customItems.length > 0 && (
            <div className="mt-2 space-y-1">
              {customItems.map((ci, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <CheckSquare size={16} className="flex-shrink-0 text-primary" />
                  <span className="text-sm text-foreground flex-1">{ci.label}</span>
                  <span className="text-xs text-muted">{STAGE_LABELS[ci.stage] ?? ci.stage}</span>
                  <button
                    type="button"
                    onClick={() => setCustomItems((prev) => prev.filter((_, j) => j !== i))}
                    className="text-muted hover:text-foreground transition-colors"
                    aria-label="Remove item"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-status-cancelled mb-4">Failed to create booking. Please try again.</p>
        )}

        <div className="flex gap-3">
          <Button onClick={handleCreate} disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create booking'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/bookings')}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // ─── Step 1: Booking form ─────────────────────────────────────────────────────

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <PageHeader title="New booking" backHref="/admin/bookings" backLabel="Bookings" />

      <form onSubmit={handleSubmit(advanceToStep2)} className="space-y-6">
        <BookingFormFields
          control={control}
          register={register}
          errors={errors}
          songRequestFormEnabled={userProfile?.songRequestFormEnabled}
          formats={formats}
        />

        <div className="flex gap-3">
          <Button type="submit">
            Next: Checklist
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/bookings')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
