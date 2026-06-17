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

/** A voided invoice whose slot is being reused: its number and the year it was issued. */
export interface VoidedInvoiceRef {
  invoiceNumber: string;
  year: number;
}

/**
 * Extract the sequence integer from a previously-built invoice number. buildInvoiceNumber
 * always joins parts with '-' and places the zero-padded sequence last, so the final token
 * is the sequence regardless of the user's prefix. Returns null if it isn't numeric.
 */
function parseSequence(invoiceNumber: string): number | null {
  const token = invoiceNumber.split('-').pop();
  if (!token || !/^\d+$/.test(token)) return null;
  return Number(token);
}

/**
 * Extract the year embedded in a previously-built invoice number. When includeYear was on,
 * buildInvoiceNumber places the 4-digit year directly before the sequence, so the
 * second-to-last token is the year. Returns null if the number had no year segment.
 */
function parseYear(invoiceNumber: string): number | null {
  const tokens = invoiceNumber.split('-');
  if (tokens.length < 2) return null;
  const candidate = tokens[tokens.length - 2];
  return /^\d{4}$/.test(candidate) ? Number(candidate) : null;
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
  voided?: VoidedInvoiceRef | null,
): AllocationResult {
  if (voided) {
    // Reuse the voided slot's sequence but re-render it with the *current* template, so a
    // number issued under an old numbering style adopts the user's current style. The year
    // comes from the original number's own year segment (what it was actually issued as);
    // voided.year is only a fallback for numbers that never had a year segment. The counter
    // is not advanced. Fall back to the verbatim number if the sequence can't be parsed.
    const seq = parseSequence(voided.invoiceNumber);
    const year = parseYear(voided.invoiceNumber) ?? voided.year;
    const invoiceNumber =
      seq == null ? voided.invoiceNumber : buildInvoiceNumber(seq, year, resolveFormat(prefs));
    return { invoiceNumber, nextSeq: currentSeq, nextYear: seqYear };
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
