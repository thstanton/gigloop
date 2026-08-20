import type { BuiltInTemplateType } from '@/types/api';

interface TemplateMetaRow {
  value: BuiltInTemplateType;
  kind: 'email' | 'document';
  name: string;
  description: string;
}

// The one declaration of the built-in-template vocabulary — one row per type, one column per
// attribute, matching the array-of-records + compile-time coverage pattern established in
// lib/constants.ts (CLAUDE.md → One declaration per vocabulary). BUILT_IN_EMAIL_TYPES,
// BUILT_IN_DOCUMENT_TYPES, ALL_BUILT_IN_TEMPLATE_TYPES and TEMPLATE_DISPLAY are all derived from
// it below, never written alongside it, so a type cannot be half-added.
const TEMPLATE_META = [
  { value: 'quote',                      kind: 'email',    name: 'Quote',                    description: 'Sent when providing a price quote for a new enquiry' },
  { value: 'confirmation',               kind: 'email',    name: 'Booking confirmation',     description: 'Sent to confirm an accepted booking' },
  { value: 'contract_cover',             kind: 'email',    name: 'Contract email',           description: 'Email body when sending only the contract link' },
  { value: 'contract_and_deposit_cover', kind: 'email',    name: 'Contract & deposit email', description: 'Email body when sending the contract link with a deposit invoice' },
  { value: 'deposit_invoice_cover',      kind: 'email',    name: 'Deposit invoice email',    description: 'Email body when sending the deposit invoice' },
  { value: 'balance_invoice_cover',      kind: 'email',    name: 'Balance invoice email',    description: 'Email body when sending the final balance invoice' },
  { value: 'series_invoice_cover',       kind: 'email',    name: 'Series invoice email',     description: 'Email body when sending the invoice for a series of bookings' },
  { value: 'contract_received',          kind: 'email',    name: 'Contract received',        description: 'Confirmation sent when the client signs the contract' },
  { value: 'deposit_received',           kind: 'email',    name: 'Deposit received',         description: 'Confirmation sent when the deposit payment arrives' },
  { value: 'music_form_invite',          kind: 'email',    name: 'Music form invitation',    description: 'Sent when inviting the client to fill in their music preferences' },
  { value: 'thank_you',                  kind: 'email',    name: 'Thank you',                description: 'Sent after the performance to thank the client' },
  { value: 'contract',                   kind: 'document', name: 'Contract',                 description: 'Performance agreement sent to clients for signing' },
] as const satisfies readonly TemplateMetaRow[];

// Compile-time coverage guard. If a type is added to BuiltInTemplateType and not to the table
// above, Exclude<> resolves to that member, which fails the `extends never` constraint here — so
// a type cannot be half-added (same mechanism as lib/constants.ts's _BookingStatusCoverage).
type AssertNever<T extends never> = T;
export type _TemplateMetaCoverage = AssertNever<
  Exclude<BuiltInTemplateType, (typeof TEMPLATE_META)[number]['value']>
>;

// Declaration order of every built-in template type — exported so specs can pin the derived
// lists' shape (partition, order) against the canonical table instead of against each other.
export const ALL_BUILT_IN_TEMPLATE_TYPES: BuiltInTemplateType[] = TEMPLATE_META.map((row) => row.value);

export const BUILT_IN_EMAIL_TYPES: BuiltInTemplateType[] = TEMPLATE_META
  .filter((row) => row.kind === 'email')
  .map((row) => row.value);

export const BUILT_IN_DOCUMENT_TYPES: BuiltInTemplateType[] = TEMPLATE_META
  .filter((row) => row.kind === 'document')
  .map((row) => row.value);

export const TEMPLATE_DISPLAY: Record<BuiltInTemplateType, Omit<TemplateMetaRow, 'value' | 'kind'>> =
  Object.fromEntries(
    TEMPLATE_META.map(({ value, name, description }) => [value, { name, description }]),
  ) as Record<BuiltInTemplateType, Omit<TemplateMetaRow, 'value' | 'kind'>>;

// ─── Variable definitions ─────────────────────────────────────────────────────

export interface TemplateVariable {
  name: string;
  label: string;
}

// The one declaration of the template-variable vocabulary — one row per variable, one column
// per attribute. ALL_VARIABLES and VAR_LABELS are derived from it, never written alongside it,
// so a variable cannot be half-added (CLAUDE.md → One declaration per vocabulary).
const VAR_NAMES = {
  customerName:   { name: 'customerName',   label: 'Customer name'    },
  bookingDate:    { name: 'bookingDate',     label: 'Booking date'     },
  venueName:      { name: 'venueName',       label: 'Venue name'       },
  bookingFee:     { name: 'bookingFee',      label: 'Booking fee'      },
  setsSchedule:   { name: 'setsSchedule',    label: 'Sets schedule'    },
  musicianName:   { name: 'musicianName',    label: 'Musician name'    },
  musicianEmail:  { name: 'musicianEmail',   label: 'Musician email'   },
  portalLink:     { name: 'portalLink',      label: 'Portal link'      },
  invoiceNumber:  { name: 'invoiceNumber',   label: 'Invoice number'   },
  issueDate:      { name: 'issueDate',       label: 'Issue date'       },
  invoiceTotal:   { name: 'invoiceTotal',    label: 'Invoice total'    },
  invoiceDueDate: { name: 'invoiceDueDate',  label: 'Invoice due date' },
  seriesLabel:    { name: 'seriesLabel',     label: 'Series name'      },
  datesCovered:   { name: 'datesCovered',    label: 'Dates covered'    },
} as const;

export const ALL_VARIABLES: TemplateVariable[] = Object.values(VAR_NAMES);

// Human-readable labels keyed by variable name — used to render specific missing-variable warnings.
export const VAR_LABELS: Record<string, string> = Object.fromEntries(
  ALL_VARIABLES.map((v) => [v.name, v.label]),
);

const { customerName, bookingDate, venueName, bookingFee, setsSchedule,
        musicianName, musicianEmail, portalLink,
        invoiceTotal, invoiceDueDate, seriesLabel, datesCovered } = VAR_NAMES;

export const TEMPLATE_VARIABLES: Record<BuiltInTemplateType, TemplateVariable[]> = {
  quote:                       [customerName, bookingDate, venueName, bookingFee, portalLink, musicianName, musicianEmail],
  confirmation:                [customerName, bookingDate, venueName, bookingFee, setsSchedule, portalLink, musicianName, musicianEmail],
  contract_cover:              [customerName, bookingDate, venueName, portalLink, musicianName, musicianEmail],
  contract_and_deposit_cover:  [customerName, bookingDate, venueName, portalLink, invoiceTotal, invoiceDueDate, musicianName, musicianEmail],
  deposit_invoice_cover:       [customerName, bookingDate, invoiceTotal, invoiceDueDate, portalLink, musicianName, musicianEmail],
  balance_invoice_cover:       [customerName, bookingDate, invoiceTotal, invoiceDueDate, portalLink, musicianName, musicianEmail],
  // A series invoice bills the series customer for many dates — no bookingDate, venue or
  // portal link exists to offer here (#846, CONTEXT.md → BookingSeries).
  series_invoice_cover:        [customerName, seriesLabel, datesCovered, invoiceTotal, invoiceDueDate, musicianName, musicianEmail],
  contract_received:           [customerName, bookingDate, portalLink, musicianName, musicianEmail],
  deposit_received:            [customerName, bookingDate, portalLink, musicianName, musicianEmail],
  music_form_invite:           [customerName, bookingDate, venueName, portalLink, musicianName, musicianEmail],
  thank_you:                   [customerName, bookingDate, portalLink, musicianName, musicianEmail],
  contract:                    [customerName, bookingDate, venueName, bookingFee, setsSchedule, musicianName, musicianEmail],
};
