import type { BuiltInTemplateType } from '@/types/api';

export const BUILT_IN_EMAIL_TYPES: BuiltInTemplateType[] = [
  'quote',
  'confirmation',
  'contract_cover',
  'contract_and_invoice_cover',
  'invoice_cover',
  'contract_received',
  'deposit_received',
  'music_form_invite',
  'thank_you',
];

export const TEMPLATE_DISPLAY: Record<BuiltInTemplateType, { name: string; description: string }> = {
  quote:                       { name: 'Quote',                    description: 'Sent when providing a price quote for a new enquiry' },
  confirmation:                { name: 'Booking confirmation',     description: 'Sent to confirm an accepted booking' },
  contract_cover:              { name: 'Contract email',           description: 'Email body when sending only the contract link' },
  contract_and_invoice_cover:  { name: 'Contract & deposit email', description: 'Email body when sending the contract link with a deposit invoice' },
  invoice_cover:               { name: 'Invoice email',            description: 'Email body when sending a standalone invoice' },
  contract_received:           { name: 'Contract received',        description: 'Confirmation sent when the client signs the contract' },
  deposit_received:            { name: 'Deposit received',         description: 'Confirmation sent when the deposit payment arrives' },
  music_form_invite:           { name: 'Music form invitation',    description: 'Sent when inviting the client to fill in their music preferences' },
  thank_you:                   { name: 'Thank you',                description: 'Sent after the performance to thank the client' },
  contract:                    { name: 'Contract',                 description: 'Contract document' },
};

// ─── Variable definitions ─────────────────────────────────────────────────────

export interface TemplateVariable {
  name: string;
  label: string;
}

export const ALL_VARIABLES: TemplateVariable[] = [
  { name: 'customerName',   label: 'Customer name'   },
  { name: 'bookingDate',    label: 'Booking date'    },
  { name: 'venueName',      label: 'Venue name'      },
  { name: 'bookingFee',     label: 'Booking fee'     },
  { name: 'setsSchedule',   label: 'Sets schedule'   },
  { name: 'musicianName',   label: 'Musician name'   },
  { name: 'musicianEmail',  label: 'Musician email'  },
  { name: 'portalLink',     label: 'Portal link'     },
  { name: 'invoiceTotal',   label: 'Invoice total'   },
  { name: 'invoiceDueDate', label: 'Invoice due date' },
];

const VAR_NAMES = {
  customerName:   { name: 'customerName',   label: 'Customer name'    },
  bookingDate:    { name: 'bookingDate',     label: 'Booking date'     },
  venueName:      { name: 'venueName',       label: 'Venue name'       },
  bookingFee:     { name: 'bookingFee',      label: 'Booking fee'      },
  setsSchedule:   { name: 'setsSchedule',    label: 'Sets schedule'    },
  musicianName:   { name: 'musicianName',    label: 'Musician name'    },
  musicianEmail:  { name: 'musicianEmail',   label: 'Musician email'   },
  portalLink:     { name: 'portalLink',      label: 'Portal link'      },
  invoiceTotal:   { name: 'invoiceTotal',    label: 'Invoice total'    },
  invoiceDueDate: { name: 'invoiceDueDate',  label: 'Invoice due date' },
} as const;

const { customerName, bookingDate, venueName, bookingFee, setsSchedule,
        musicianName, musicianEmail, portalLink, invoiceTotal, invoiceDueDate } = VAR_NAMES;

export const TEMPLATE_VARIABLES: Record<BuiltInTemplateType, TemplateVariable[]> = {
  quote:                      [customerName, bookingDate, venueName, bookingFee, portalLink, musicianName, musicianEmail],
  confirmation:               [customerName, bookingDate, venueName, bookingFee, setsSchedule, portalLink, musicianName, musicianEmail],
  contract_cover:             [customerName, bookingDate, venueName, portalLink, musicianName, musicianEmail],
  contract_and_invoice_cover: [customerName, bookingDate, venueName, portalLink, invoiceTotal, invoiceDueDate, musicianName, musicianEmail],
  invoice_cover:              [customerName, bookingDate, invoiceTotal, invoiceDueDate, portalLink, musicianName, musicianEmail],
  contract_received:          [customerName, bookingDate, portalLink, musicianName, musicianEmail],
  deposit_received:           [customerName, bookingDate, portalLink, musicianName, musicianEmail],
  music_form_invite:          [customerName, bookingDate, venueName, portalLink, musicianName, musicianEmail],
  thank_you:                  [customerName, bookingDate, portalLink, musicianName, musicianEmail],
  contract:                   [],
};
