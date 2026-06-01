import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiPost, apiPatch, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import type { Invoice, InvoiceLineItem } from '@/types/api';

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

function hasChanged(item: FormValues['lineItems'][number], original: InvoiceLineItem): boolean {
  return (
    item.description !== original.description ||
    parseFloat(item.amount) !== parseFloat(original.amount)
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  bookingId: string;
  invoice?: Invoice;
  hasDepositInvoice: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: { isDeposit: boolean; amount?: number; description?: string };
}

export default function InvoiceSheet({
  bookingId,
  invoice,
  hasDepositInvoice,
  open,
  onOpenChange,
  prefill,
}: Props) {
  const isEdit = !!invoice;
  const queryClient = useQueryClient();

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
    if (open) reset(buildDefaults(invoice, prefill));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const lineItems = watch('lineItems');
  const total = lineItems.reduce((sum, item) => {
    const n = parseFloat(item.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      apiPost<Invoice>(`/bookings/${bookingId}/invoices`, {
        isDeposit: values.isDeposit,
        lineItems: values.lineItems.map((item, i) => ({
          description: item.description,
          amount: parseFloat(item.amount),
          order: i,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingInvoices', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['bookingChecklist', bookingId] });
      onOpenChange(false);
      toast({ title: 'Invoice created' });
    },
    onError: (error: unknown, variables: FormValues) => {
      const is409 = error instanceof Response && error.status === 409;
      const invoiceType = variables.isDeposit ? 'deposit' : 'balance';
      const title = is409
        ? `A ${invoiceType} invoice already exists — void it before creating a new one`
        : 'Failed to create invoice';
      toast({ title, variant: 'destructive' });
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

  function onSubmit(values: FormValues) {
    if (isEdit) {
      editMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  }

  const showDepositToggle = !isEdit && !hasDepositInvoice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? 'Edit Invoice' : 'New Invoice'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isEdit ? 'Save changes' : 'Create invoice'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
