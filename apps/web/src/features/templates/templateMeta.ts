import type { BuiltInTemplateType } from '@/types/api';

export interface TemplateVariable {
  name: string;
  label: string;
}

// The one declaration of the template-variable vocabulary. ALL_VARIABLES and VAR_LABELS are
// derived from it, never written alongside it (CLAUDE.md → One declaration per vocabulary).
const VAR_NAMES = {
  customerName:   { name: 'customerName',   label: 'Customer name'    },
  bookingDate:    { name: 'bookingDate',     label: 'Booking date'     },
  venueName:      { name: 'venueName',       label: 'Venue name'       },
  bookingFee:     { name: 'bookingFee',      label: 'Booking fee'      },
  setsSchedule:   { name: 'setsSchedule',    label: 'Sets schedule'    },
  musicianName:   { name: 'musicianName',   label: 'Musician name'    },
  musicianEmail:  { name: 'musicianEmail',  label: 'Musician email'   },
  portalLink:     { name: 'portalLink',     label: 'Portal link'      },
  invoiceNumber:  { name: 'invoiceNumber',  label: 'Invoice number'   },
  issueDate:      { name: 'issueDate',      label: 'Issue date'       },
  invoiceTotal:   { name: 'invoiceTotal',   label: 'Invoice total'    },
  invoiceDueDate: { name: 'invoiceDueDate', label: 'Invoice due date' },
  seriesLabel:    { name: 'seriesLabel',    label: 'Series name'      },
  datesCovered:   { name: 'datesCovered',   label: 'Dates covered'    },
  bandMemberName: { name: 'bandMemberName', label: 'Band member name' },
} as const;

export const ALL_VARIABLES: TemplateVariable[] = Object.values(VAR_NAMES);

// Human-readable labels keyed by variable name, used in missing-variable warnings.
export const VAR_LABELS: Record<string, string> = Object.fromEntries(
  ALL_VARIABLES.map((v) => [v.name, v.label]),
);

const { customerName, bookingDate, venueName, bookingFee, setsSchedule,
        musicianName, musicianEmail, portalLink,
        invoiceTotal, invoiceDueDate, seriesLabel, datesCovered, bandMemberName } = VAR_NAMES;

type TemplateMetaRow = {
  value: BuiltInTemplateType;
  group: 'email' | 'document' | 'message';
  name: string;
  description: string;
  format: 'rich' | 'plain';
  variables: readonly TemplateVariable[];
  featureFlag?: 'BAND_MEMBERS';
};

// One row per built-in type. The API type mirror is checked against this table; display metadata,
// editor formats, and variable pickers are all derived from the same declaration.
export const BUILT_IN_TEMPLATE_META = [
  { value: 'quote', group: 'email', name: 'Quote', description: 'Sent when providing a price quote for a new enquiry', format: 'rich', variables: [customerName, bookingDate, venueName, bookingFee, portalLink, musicianName, musicianEmail] },
  { value: 'confirmation', group: 'email', name: 'Booking confirmation', description: 'Sent to confirm an accepted booking', format: 'rich', variables: [customerName, bookingDate, venueName, bookingFee, setsSchedule, portalLink, musicianName, musicianEmail] },
  { value: 'contract_cover', group: 'email', name: 'Contract email', description: 'Email body when sending only the contract link', format: 'rich', variables: [customerName, bookingDate, venueName, portalLink, musicianName, musicianEmail] },
  { value: 'contract_and_deposit_cover', group: 'email', name: 'Contract & deposit email', description: 'Email body when sending the contract link with a deposit invoice', format: 'rich', variables: [customerName, bookingDate, venueName, portalLink, invoiceTotal, invoiceDueDate, musicianName, musicianEmail] },
  { value: 'deposit_invoice_cover', group: 'email', name: 'Deposit invoice email', description: 'Email body when sending the deposit invoice', format: 'rich', variables: [customerName, bookingDate, invoiceTotal, invoiceDueDate, portalLink, musicianName, musicianEmail] },
  { value: 'balance_invoice_cover', group: 'email', name: 'Balance invoice email', description: 'Email body when sending the final balance invoice', format: 'rich', variables: [customerName, bookingDate, invoiceTotal, invoiceDueDate, portalLink, musicianName, musicianEmail] },
  // A series invoice has no single event date or portal, so offer only series-shaped variables.
  { value: 'series_invoice_cover', group: 'email', name: 'Series invoice email', description: 'Email body when sending the invoice for a series of bookings', format: 'rich', variables: [customerName, seriesLabel, datesCovered, invoiceTotal, invoiceDueDate, musicianName, musicianEmail] },
  { value: 'contract_received', group: 'email', name: 'Contract received', description: 'Confirmation sent when the client signs the contract', format: 'rich', variables: [customerName, bookingDate, portalLink, musicianName, musicianEmail] },
  { value: 'deposit_received', group: 'email', name: 'Deposit received', description: 'Confirmation sent when the deposit payment arrives', format: 'rich', variables: [customerName, bookingDate, portalLink, musicianName, musicianEmail] },
  { value: 'music_form_invite', group: 'email', name: 'Music form invitation', description: 'Sent when inviting the client to fill in their music preferences', format: 'rich', variables: [customerName, bookingDate, venueName, portalLink, musicianName, musicianEmail] },
  { value: 'thank_you', group: 'email', name: 'Thank you', description: 'Sent after the performance to thank the client', format: 'rich', variables: [customerName, bookingDate, portalLink, musicianName, musicianEmail] },
  { value: 'contract', group: 'document', name: 'Contract', description: 'Performance agreement sent to clients for signing', format: 'rich', variables: [customerName, bookingDate, venueName, bookingFee, setsSchedule, musicianName, musicianEmail] },
  { value: 'band_invite', group: 'email', name: 'Band invitation email', description: 'Email body when inviting a band member to play at a booking', format: 'rich', variables: [bandMemberName, bookingDate, venueName, portalLink, musicianName], featureFlag: 'BAND_MEMBERS' },
  { value: 'band_invite_message', group: 'message', name: 'Band invitation message', description: 'Copy-paste invitation message for a band member', format: 'plain', variables: [portalLink, bookingDate], featureFlag: 'BAND_MEMBERS' },
  { value: 'band_call_sheet', group: 'email', name: 'Band call sheet email', description: 'Email body when sending a band member their call sheet', format: 'rich', variables: [bandMemberName, bookingDate, portalLink, musicianName], featureFlag: 'BAND_MEMBERS' },
  { value: 'band_call_sheet_message', group: 'message', name: 'Band call sheet message', description: 'Copy-paste call sheet link for a band member', format: 'plain', variables: [portalLink, bookingDate], featureFlag: 'BAND_MEMBERS' },
  { value: 'band_final_details', group: 'email', name: 'Band final details email', description: 'Email body when sending final booking details to a band member', format: 'rich', variables: [bandMemberName, bookingDate, venueName, portalLink, musicianName], featureFlag: 'BAND_MEMBERS' },
  { value: 'band_final_details_message', group: 'message', name: 'Band final details message', description: 'Copy-paste final details link for a band member', format: 'plain', variables: [portalLink, bookingDate], featureFlag: 'BAND_MEMBERS' },
] as const satisfies readonly TemplateMetaRow[];

// Compile-time coverage guard: a BuiltInTemplateType missing from the catalog fails the build.
type AssertNever<T extends never> = T;
export type _TemplateMetaCoverage = AssertNever<
  Exclude<BuiltInTemplateType, (typeof BUILT_IN_TEMPLATE_META)[number]['value']>
>;

export const ALL_BUILT_IN_TEMPLATE_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META.map(({ value }) => value);
export const BUILT_IN_EMAIL_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META
  .filter(({ group }) => group === 'email')
  .map(({ value }) => value);
export const BUILT_IN_DOCUMENT_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META
  .filter(({ group }) => group === 'document')
  .map(({ value }) => value);
export const BUILT_IN_MESSAGE_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META
  .filter(({ group }) => group === 'message')
  .map(({ value }) => value);

export const TEMPLATE_DISPLAY = Object.fromEntries(
  BUILT_IN_TEMPLATE_META.map(({ value, name, description }) => [value, { name, description }]),
) as Record<BuiltInTemplateType, { name: string; description: string }>;

export const TEMPLATE_FORMAT = Object.fromEntries(
  BUILT_IN_TEMPLATE_META.map(({ value, format }) => [value, format]),
) as Record<BuiltInTemplateType, 'rich' | 'plain'>;

// Object.fromEntries loses the literal keys; the coverage guard above pins this assertion to the
// complete BuiltInTemplateType union and the source rows are all derived from the canonical table.
export const TEMPLATE_VARIABLES = Object.fromEntries(
  BUILT_IN_TEMPLATE_META.map(({ value, variables }) => [value, variables]),
) as unknown as Record<BuiltInTemplateType, readonly TemplateVariable[]>;
