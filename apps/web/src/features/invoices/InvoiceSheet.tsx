import { useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineHint } from '@/components/common/InlineHint';
import { useDismissibleHint } from '@/lib/hooks/useDismissibleHint';
import { ApiError, apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
import { invoiceOwnerRoute } from '@/lib/invoiceActionRouting';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice, InvoiceLineItem, InvoiceNumberPreview } from '@/types/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

const lineItemSchema = z.object({
  serverId: z.string().optional(),
  description: z.string().min(1, 'Required'),
  amount: z
    .string()
    .min(1, 'Required')
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid amount (e.g. 1500 or 1500.00)'),
});

const schema = z.object({
  isDeposit: z.boolean(),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaults(invoice?: Invoice, prefill?: Props['prefill']): FormValues {
  if (!invoice) {
    const description = prefill?.description ?? '';
    const amount = prefill?.amount != null ? prefill.amount.toFixed(2) : '';
    return {
      isDeposit: prefill?.isDeposit ?? false,
      lineItems: [{ serverId: undefined, description, amount }],
    };
  }
  return {
    isDeposit: invoice.isDeposit,
    lineItems: invoice.lineItems.map((item) => ({
      serverId: item.id,
      description: item.description,
      amount: parseFloat(item.amount).toString(),
    })),
  };
}

function buildConfirmText(preview: InvoiceNumberPreview | undefined): string {
  if (!preview) return "Once issued, this invoice is locked. To make changes, you'll need to void it and create a new one.";
  if (preview.willReuse) return `This invoice will be issued as ${preview.invoiceNumber} (re-used from a voided invoice). Once issued, it is locked — void it to make changes.`;
  return `This invoice will be issued as ${preview.invoiceNumber}. Once issued, it is locked — void it to make changes.`;
}

function hasChanged(item: FormValues['lineItems'][number], original: InvoiceLineItem): boolean {
  return (
    item.description !== original.description ||
    parseFloat(item.amount) !== parseFloat(original.amount)
  );
}

function buildCreatePayload(values: FormValues) {
  return {
    isDeposit: values.isDeposit,
    lineItems: values.lineItems.map((item, i) => ({
      description: item.description,
      amount: parseFloat(item.amount),
      order: i,
    })),
  };
}

// Diff the form's line items against the saved invoice and persist the changes (create/update/
// delete). Does not close the sheet or toast — callers compose it. A no-op when nothing changed.
//
// Writes go to the owner-agnostic `/invoices/:id` family (ADR-0069). They were hard-wired to
// `/bookings/${bookingId}/invoices/...` until #845, which is why a series invoice's line items
// had never been editable: it has no owning booking, so every one of these calls named a
// resource that could not exist.
async function persistLineItemEdits(invoice: Invoice, values: FormValues) {
  const originalById = Object.fromEntries(invoice.lineItems.map((i) => [i.id, i]));
  const keptServerIds = new Set(values.lineItems.map((i) => i.serverId).filter(Boolean));

  const toDelete = invoice.lineItems.filter((i) => !keptServerIds.has(i.id));
  const toCreate = values.lineItems.filter((i) => !i.serverId);
  const toUpdate = values.lineItems.filter(
    (i) => i.serverId && hasChanged(i, originalById[i.serverId]),
  );

  await Promise.all([
    ...toDelete.map((i) =>
      apiDelete(`/invoices/${invoice.id}/line-items/${i.id}`),
    ),
    ...toCreate.map((item) =>
      apiPost(`/invoices/${invoice.id}/line-items`, {
        description: item.description,
        amount: parseFloat(item.amount),
        order: values.lineItems.indexOf(item),
      }),
    ),
    ...toUpdate.map((item) =>
      apiPatch(`/invoices/${invoice.id}/line-items/${item.serverId}`, {
        description: item.description,
        amount: parseFloat(item.amount),
      }),
    ),
  ]);
}

// Shared wrapper for the invoice create/issue mutations: callers supply mutationFn + onSuccess; the 409-aware error toast is identical and lives here.
function useInvoiceAction<TResult>(opts: {
  mutationFn: (values: FormValues) => Promise<TResult>;
  fallbackErrorTitle: string;
  onSuccess: (result: TResult) => void;
}) {
  return useMutation({
    mutationFn: opts.mutationFn,
    onSuccess: opts.onSuccess,
    onError: (error: unknown, variables: FormValues) => {
      const is409 = error instanceof ApiError && error.status === 409;
      const invoiceType = variables.isDeposit ? 'deposit' : 'balance';
      toast({
        title: is409
          ? `A ${invoiceType} invoice already exists — void it before creating a new one`
          : opts.fallbackErrorTitle,
        variant: 'destructive',
      });
    },
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  /**
   * Create mode only — the owner an invoice is created *for*. Every write on an invoice that
   * already exists is owner-agnostic (ADR-0069) and derives its route from the invoice itself,
   * so this is not consulted when editing. Creation genuinely differs per owner and stays
   * owner-scoped; a series invoice is created from `SeriesInvoiceCard`, not here.
   */
  bookingId: string;
  invoice?: Invoice;
  hasDepositInvoice: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: { isDeposit: boolean; amount?: number; description?: string };
  /**
   * True when the booking has a positive fee but no default deposit percentage is set, so the
   * deposit amount could not be pre-filled (#758). The container owns this because neither the
   * fee nor the profile setting is in the sheet's scope. The sheet decides *whether* to show the
   * hint (create mode + the deposit toggle on).
   */
  depositPercentageHintEligible?: boolean;
  /** Called after create+issue completes — use to open the compose sheet for the new invoice. */
  onAfterIssue?: (invoice: Invoice) => void;
}

export default function InvoiceSheet({
  bookingId,
  invoice,
  hasDepositInvoice,
  open,
  onOpenChange,
  prefill,
  depositPercentageHintEligible = false,
  onAfterIssue,
}: Props) {
  const isEdit = !!invoice;
  const { isLoaded } = useAuth();
  const { isDismissed: depositHintDismissed, dismiss: dismissDepositHint } =
    useDismissibleHint('deposit-percentage-default');
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingFormValues, setPendingFormValues] = useState<FormValues | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: buildDefaults(invoice),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lineItems' });

  // Which edit target ('create', or an invoice id) the form was last seeded for. Cleared only on
  // a genuine close (see handleOpenChange) — never implicitly by the `open` prop alone.
  //
  // `open` is computed by the parent as `sheet === 'invoice' && (!sheetInvoiceId || !!editingInvoice)`
  // (BookingDetailSheets) — it is deliberately held `false` while the edit target hasn't resolved
  // yet, so it can transiently flip false→true again for the *same* invoice while this sheet is
  // conceptually still open to the user (e.g. a background refetch of the invoice briefly clears
  // `data`). Resetting on every such flip silently discarded in-progress edits (#855): a user could
  // type a new amount, add a line, and have the amount edit vanish before Save was even clicked.
  // Keying the reset on the resolved edit target — and only re-arming it on a close this component
  // itself acknowledged — means a spurious flip for the same target is a no-op, while a genuine
  // open (new target, or reopening after a real close) still seeds fresh.
  const seededKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const key = invoice?.id ?? 'create';
    if (seededKeyRef.current === key) return;
    seededKeyRef.current = key;
    reset(buildDefaults(invoice, prefill));
    setConfirmOpen(false);
    setPendingFormValues(null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every close this component itself drives (Sheet chrome, or a mutation's onSuccess) goes
  // through here so the next genuine open re-seeds. A spurious open→false→true flip that this
  // component never asked for (see seededKeyRef above) never calls this, so it is not affected.
  function handleOpenChange(next: boolean) {
    if (!next) seededKeyRef.current = null;
    onOpenChange(next);
  }

  const isDeposit = watch('isDeposit');
  const lineItems = watch('lineItems');
  const total = lineItems.reduce((sum, item) => {
    const n = parseFloat(item.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const { data: numberPreview } = useQuery<InvoiceNumberPreview>({
    queryKey: ['invoiceNumberPreview', bookingId, isDeposit],
    queryFn: () => apiGet<InvoiceNumberPreview>(`/bookings/${bookingId}/invoices/preview-number?isDeposit=${isDeposit}`),
    enabled: isLoaded && !isEdit,
    staleTime: 30_000,
  });

  const saveDraftMutation = useInvoiceAction({
    mutationFn: (values) => apiPost<Invoice>(`/bookings/${bookingId}/invoices`, buildCreatePayload(values)),
    fallbackErrorTitle: 'Failed to save draft',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      handleOpenChange(false);
      toast({ title: 'Draft saved' });
    },
  });

  // Create DRAFT then immediately issue (DRAFT → ISSUED), then open compose sheet
  const createAndIssueMutation = useInvoiceAction({
    mutationFn: async (values) => {
      const draft = await apiPost<Invoice>(`/bookings/${bookingId}/invoices`, buildCreatePayload(values));
      return apiPost<Invoice>(`/invoices/${draft.id}/issue`, {});
    },
    fallbackErrorTitle: 'Failed to create invoice',
    onSuccess: (issuedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingDocuments', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      handleOpenChange(false);
      onAfterIssue?.(issuedInvoice);
    },
  });

  // Owner-correct cache invalidation: a series invoice has no `bookingInvoices` list to
  // refresh, and a booking invoice has no `seriesInvoice` query. Plus the by-id read #844
  // introduced, which any open sheet is holding.
  function invalidateFor(inv: Invoice, action: 'edit' | 'issue') {
    for (const queryKey of invoiceOwnerRoute(inv, action).keys) {
      queryClient.invalidateQueries({ queryKey });
    }
    queryClient.invalidateQueries({ queryKey: ['invoice', inv.id] });
  }

  const editMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!invoice) return;
      await persistLineItemEdits(invoice, values);
    },
    onSuccess: () => {
      if (invoice) invalidateFor(invoice, 'edit');
      handleOpenChange(false);
      toast({ title: 'Invoice updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update invoice', variant: 'destructive' });
    },
  });

  // Issue an existing DRAFT: persist the current form edits first (WYSIWYG — issuing locks the
  // invoice, so what the user sees must be what gets locked), then DRAFT → ISSUED, then compose.
  const issueDraftMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!invoice) throw new Error('No invoice to issue');
      await persistLineItemEdits(invoice, values);
      return apiPost<Invoice>(`/invoices/${invoice.id}/issue`, {});
    },
    onSuccess: (issuedInvoice) => {
      if (invoice) invalidateFor(invoice, 'issue');
      handleOpenChange(false);
      onAfterIssue?.(issuedInvoice);
    },
    onError: () => toast({ title: 'Failed to issue invoice', variant: 'destructive' }),
  });

  // Validate + capture the form values, then open the irreversible-issue confirmation.
  function onRequestIssue(values: FormValues) {
    setPendingFormValues(values);
    setConfirmOpen(true);
  }

  const isDraft = invoice?.status === 'DRAFT';

  function onConfirmIssue() {
    setConfirmOpen(false);
    if (!pendingFormValues) return;
    // Edit-mode on a DRAFT: save edits then issue. Create-mode: create-then-issue.
    if (isEdit && isDraft) {
      issueDraftMutation.mutate(pendingFormValues);
      return;
    }
    createAndIssueMutation.mutate(pendingFormValues);
  }

  const showDepositToggle = !isEdit && !hasDepositInvoice;
  // #758: only when the user is actually creating a deposit invoice (toggle on) and the default
  // percentage that would have pre-filled the amount is missing. Forward-looking — following the
  // link abandons this half-made invoice, so the copy promises the next time, not this one.
  const showDepositPercentageHint =
    !isEdit && isDeposit && depositPercentageHintEligible && !depositHintDismissed;
  const isIssuing = createAndIssueMutation.isPending || issueDraftMutation.isPending;
  // Issue is the single committing verb across create and draft-edit (ADR-0056).
  const confirmButtonLabel = isIssuing ? 'Issuing…' : 'Issue invoice';
  const isBusy =
    saveDraftMutation.isPending ||
    editMutation.isPending ||
    isIssuing ||
    isSubmitting;

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>{isEdit ? 'Edit Invoice' : 'New Invoice'}</SheetTitle>
          </SheetHeader>

          <form className="space-y-6">
            {/* Deposit toggle — create mode only, hidden if booking already has one */}
            {showDepositToggle && (
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('isDeposit')}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span className="text-sm font-medium text-foreground">Deposit invoice</span>
              </label>
            )}

            {/* #758: nudge to set a default deposit percentage so future deposits pre-fill. */}
            {showDepositPercentageHint && (
              <InlineHint
                actionLabel="Set it in Settings"
                href="/admin/settings"
                onDismiss={dismissDepositHint}
              >
                Set a default deposit percentage and we&rsquo;ll work this out for you next time.
              </InlineHint>
            )}

            {/* Edit mode: show deposit badge (not editable) */}
            {isEdit && invoice?.isDeposit && (
              <p className="text-sm text-muted">
                This is the deposit invoice.
              </p>
            )}

            {/* Line items */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Line items</p>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <Input
                      placeholder="Description"
                      {...register(`lineItems.${index}.description`)}
                    />
                    {errors.lineItems?.[index]?.description && (
                      <p className="text-sm text-status-cancelled">
                        {errors.lineItems[index].description?.message}
                      </p>
                    )}
                  </div>
                  <div className="w-28 space-y-1">
                    <Input
                      placeholder="0.00"
                      inputMode="decimal"
                      {...register(`lineItems.${index}.amount`)}
                    />
                    {errors.lineItems?.[index]?.amount && (
                      <p className="text-sm text-status-cancelled">
                        {errors.lineItems[index].amount?.message}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="mt-0.5 flex-shrink-0"
                    aria-label="Remove line item"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))}

              {errors.lineItems?.root && (
                <p className="text-sm text-status-cancelled">{errors.lineItems.root.message}</p>
              )}

              {errors.lineItems?.message && (
                <p className="text-sm text-status-cancelled">{errors.lineItems.message}</p>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ serverId: undefined, description: '', amount: '' })}
              >
                <Plus size={14} className="mr-1.5" />
                Add line item
              </Button>
            </div>

            {/* Total */}
            {total > 0 && (
              <div className="flex justify-between items-center border-t border-border pt-3">
                <span className="text-sm font-medium text-foreground">Total</span>
                <span className="text-sm font-semibold text-foreground">
                  {total.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })}
                </span>
              </div>
            )}

            {/* Invoice number preview (create mode only) */}
            {!isEdit && numberPreview && (
              <p className="text-sm text-muted">
                {numberPreview.willReuse
                  ? `Invoice number ${numberPreview.invoiceNumber} (from a voided invoice) will be re-used`
                  : `When issued, this will be invoice ${numberPreview.invoiceNumber}`}
              </p>
            )}

            {/* Actions — edit-on-a-draft: issue (primary) + save (secondary) */}
            {isDraft && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={isBusy}
                  className="w-full"
                  onClick={handleSubmit(onRequestIssue)}
                >
                  {issueDraftMutation.isPending ? 'Issuing…' : 'Issue invoice'}
                </Button>
                <p className="text-sm text-muted">
                  Generates the PDF ready to send to your client. You won&apos;t be able to edit it
                  after it&apos;s issued.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  className="w-full"
                  onClick={handleSubmit((v) => editMutation.mutate(v))}
                >
                  {editMutation.isPending ? 'Saving…' : 'Save draft'}
                </Button>
              </div>
            )}

            {/* Edit on a locked (non-draft) invoice: save only */}
            {isEdit && !isDraft && (
              <Button
                type="button"
                disabled={isBusy}
                className="w-full"
                onClick={handleSubmit((v) => editMutation.mutate(v))}
              >
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            )}

            {/* Create: issue (primary) + save draft (secondary) — same verbs as the draft-edit
                footer (ADR-0056). Issue here creates + issues in one step. */}
            {!isEdit && (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={isBusy}
                  className="w-full"
                  onClick={handleSubmit(onRequestIssue)}
                >
                  {createAndIssueMutation.isPending ? 'Issuing…' : 'Issue invoice'}
                </Button>
                <p className="text-sm text-muted">
                  Generates the PDF ready to send to your client. You won&apos;t be able to edit it
                  after it&apos;s issued.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={isBusy}
                  className="w-full"
                  onClick={handleSubmit((v) => saveDraftMutation.mutate(v))}
                >
                  {saveDraftMutation.isPending ? 'Saving…' : 'Save draft'}
                </Button>
              </div>
            )}
          </form>
        </SheetContent>
      </Sheet>

      {/* Issue confirmation: warns that issuing is irreversible, states the concrete number.
          ResponsiveDialog (ADR-0012) — centred dialog on desktop, bottom sheet on mobile. */}
      <ResponsiveDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveDialogContent aria-describedby="confirm-desc">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Issue and lock this invoice?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription id="confirm-desc">
              {buildConfirmText(numberPreview)}{' '}A PDF will be generated.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isIssuing}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmIssue}
              disabled={isIssuing}
            >
              {confirmButtonLabel}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
