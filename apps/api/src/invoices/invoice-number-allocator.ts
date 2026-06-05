export type PaddingWidth = 1 | 3 | 4 | 6;

export interface InvoiceNumberFormat {
  prefix: string;
  includeYear: boolean;
  paddingWidth: PaddingWidth;
}

const FORMAT_DEFAULTS: InvoiceNumberFormat = { prefix: 'INV', includeYear: true, paddingWidth: 3 };

export interface AllocationResult {
  invoiceNumber: string;
  nextSeq: number;
  nextYear: number;
}

export function resolveFormat(preferences: Record<string, unknown>): InvoiceNumberFormat {
  const raw = preferences.invoiceNumberFormat as Partial<InvoiceNumberFormat> | undefined;
  if (!raw) return FORMAT_DEFAULTS;
  return {
    prefix: typeof raw.prefix === 'string' ? raw.prefix : FORMAT_DEFAULTS.prefix,
    includeYear: typeof raw.includeYear === 'boolean' ? raw.includeYear : FORMAT_DEFAULTS.includeYear,
    paddingWidth: ([1, 3, 4, 6] as PaddingWidth[]).includes(raw.paddingWidth as PaddingWidth)
      ? (raw.paddingWidth as PaddingWidth)
      : FORMAT_DEFAULTS.paddingWidth,
  };
}

export function buildInvoiceNumber(seq: number, year: number, format: InvoiceNumberFormat): string {
  const { prefix, includeYear, paddingWidth } = format;
  const seq_str = String(seq).padStart(paddingWidth, '0');
  const parts = [
    ...(prefix ? [prefix] : []),
    ...(includeYear ? [String(year)] : []),
    seq_str,
  ];
  return parts.join('-');
}

export function allocate(
  prefs: Record<string, unknown>,
  currentYear: number,
  currentSeq: number,
  seqYear: number,
  voidedNumber?: string | null,
): AllocationResult {
  if (voidedNumber) {
    return { invoiceNumber: voidedNumber, nextSeq: currentSeq, nextYear: seqYear };
  }

  const format = resolveFormat(prefs);
  const isNewYear = format.includeYear && seqYear !== currentYear;
  const nextSeq = isNewYear ? 1 : currentSeq + 1;

  return {
    invoiceNumber: buildInvoiceNumber(nextSeq, currentYear, format),
    nextSeq,
    nextYear: currentYear,
  };
}
