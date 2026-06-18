import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';
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
      const is409 = error instanceof Response && error.status === 409;
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
  bookingId: string;
  invoice?: Invoice;
  hasDepositInvoice: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: { isDeposit: boolean; amount?: number; description?: string };
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
  onAfterIssue,
}: Props) {
  const isEdit = !!invoice;
  const { isLoaded } = useAuth();
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

  useEffect(() => {
    if (open) {
      reset(buildDefaults(invoice, prefill));
      setConfirmOpen(false);
      setPendingFormValues(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

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
      onOpenChange(false);
      toast({ title: 'Draft saved' });
    },
  });

  // Create DRAFT then immediately issue (DRAFT → ISSUED), then open compose sheet
  const createAndIssueMutation = useInvoiceAction({
    mutationFn: async (values) => {
      const draft = await apiPost<Invoice>(`/bookings/${bookingId}/invoices`, buildCreatePayload(values));
      return apiPost<Invoice>(`/bookings/${bookingId}/invoices/${draft.id}/issue`, {});
    },
    fallbackErrorTitle: 'Failed to create invoice',
    onSuccess: (issuedInvoice) => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingDocuments', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      onOpenChange(false);
      onAfterIssue?.(issuedInvoice);
    },
  });

  const editMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!invoice) return;

      const originalById = Object.fromEntries(invoice.lineItems.map((i) => [i.id, i]));
      const keptServerIds = new Set(values.lineItems.map((i) => i.serverId).filter(Boolean));

      const toDelete = invoice.lineItems.filter((i) => !keptServerIds.has(i.id));
      const toCreate = values.lineItems.filter((i) => !i.serverId);
      const toUpdate = values.lineItems.filter(
        (i) => i.serverId && hasChanged(i, originalById[i.serverId]),
      );

      await Promise.all([
        ...toDelete.map((i) =>
          apiDelete(`/bookings/${bookingId}/invoices/${invoice.id}/line-items/${i.id}`),
        ),
        ...toCreate.map((item, idx) =>
          apiPost(`/bookings/${bookingId}/invoices/${invoice.id}/line-items`, {
            description: item.description,
            amount: parseFloat(item.amount),
            order: values.lineItems.indexOf(item) + idx,
          }),
        ),
        ...toUpdate.map((item) =>
          apiPatch(
            `/bookings/${bookingId}/invoices/${invoice.id}/line-items/${item.serverId}`,
            {
              description: item.description,
              amount: parseFloat(item.amount),
            },
          ),
        ),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      onOpenChange(false);
      toast({ title: 'Invoice updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update invoice', variant: 'destructive' });
    },
  });

  function onCreateInvoice(values: FormValues) {
    setPendingFormValues(values);
    setConfirmOpen(true);
  }

  function onConfirmIssue() {
    if (!pendingFormValues) return;
    setConfirmOpen(false);
    createAndIssueMutation.mutate(pendingFormValues);
  }

  const showDepositToggle = !isEdit && !hasDepositInvoice;
  const isBusy = saveDraftMutation.isPending || createAndIssueMutation.isPending || isSubmitting;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
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
              <p className="text-sm text-muted-foreground">
                {numberPreview.willReuse
                  ? `Invoice number ${numberPreview.invoiceNumber} (from a voided invoice) will be re-used`
                  : `When issued, this will be invoice ${numberPreview.invoiceNumber}`}
              </p>
            )}

            {/* Actions */}
            {isEdit ? (
              <Button
                type="button"
                disabled={isBusy}
                className="w-full"
                onClick={handleSubmit((v) => editMutation.mutate(v))}
              >
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  disabled={isBusy}
                  className="w-full"
                  onClick={handleSubmit(onCreateInvoice)}
                >
                  {createAndIssueMutation.isPending ? 'Creating…' : 'Create invoice'}
                </Button>
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

      {/* Issue confirmation: warns that issuing is irreversible, states the concrete number */}
      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom" aria-describedby="confirm-desc">
          <SheetHeader>
            <SheetTitle>Create and lock this invoice?</SheetTitle>
            <SheetDescription id="confirm-desc">
              {buildConfirmText(numberPreview)}{' '}A PDF will be generated.
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={createAndIssueMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmIssue}
              disabled={createAndIssueMutation.isPending}
            >
              {createAndIssueMutation.isPending ? 'Creating…' : 'Create invoice'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
