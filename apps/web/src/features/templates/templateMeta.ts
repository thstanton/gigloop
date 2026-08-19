import type { BuiltInTemplateType } from '@/types/api';

export const BUILT_IN_EMAIL_TYPES: BuiltInTemplateType[] = [
  'quote',
  'confirmation',
  'contract_cover',
  'contract_and_deposit_cover',
  'deposit_invoice_cover',
  'balance_invoice_cover',
  'series_invoice_cover',
  'contract_received',
  'deposit_received',
  'music_form_invite',
  'thank_you',
];

export const BUILT_IN_DOCUMENT_TYPES: BuiltInTemplateType[] = [
  'contract',
];

export const TEMPLATE_DISPLAY: Record<BuiltInTemplateType, { name: string; description: string }> = {
  quote:                        { name: 'Quote',                    description: 'Sent when providing a price quote for a new enquiry' },
  confirmation:                 { name: 'Booking confirmation',     description: 'Sent to confirm an accepted booking' },
  contract_cover:               { name: 'Contract email',           description: 'Email body when sending only the contract link' },
  contract_and_deposit_cover:   { name: 'Contract & deposit email', description: 'Email body when sending the contract link with a deposit invoice' },
  deposit_invoice_cover:        { name: 'Deposit invoice email',    description: 'Email body when sending the deposit invoice' },
  balance_invoice_cover:        { name: 'Balance invoice email',    description: 'Email body when sending the final balance invoice' },
  series_invoice_cover:         { name: 'Series invoice email',     description: 'Email body when sending the invoice for a series of bookings' },
  contract_received:            { name: 'Contract received',        description: 'Confirmation sent when the client signs the contract' },
  deposit_received:             { name: 'Deposit received',         description: 'Confirmation sent when the deposit payment arrives' },
  music_form_invite:            { name: 'Music form invitation',    description: 'Sent when inviting the client to fill in their music preferences' },
  thank_you:                    { name: 'Thank you',                description: 'Sent after the performance to thank the client' },
  contract:                     { name: 'Contract',                 description: 'Performance agreement sent to clients for signing' },
};

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
