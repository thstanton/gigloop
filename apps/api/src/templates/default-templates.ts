export type BuiltInTemplateType =
  | 'quote'
  | 'confirmation'
  | 'contract_cover'
  | 'contract_and_deposit_cover'
  | 'deposit_invoice_cover'
  | 'balance_invoice_cover'
  | 'series_invoice_cover'
  | 'music_form_invite'
  | 'thank_you'
  | 'contract_received'
  | 'deposit_received'
  | 'contract'
  | 'band_invite'
  | 'band_invite_message'
  | 'band_call_sheet'
  | 'band_call_sheet_message'
  | 'band_final_details'
  | 'band_final_details_message';

type BuiltInTemplateMeta = {
  value: BuiltInTemplateType;
  group: 'email' | 'document' | 'message';
  format: 'rich' | 'plain';
  name: string;
  description: string;
  featureFlag?: 'BAND_MEMBERS';
};

// The canonical API-side declaration of built-in template types. Lists and names below are
// derived from this ordered table; the coverage guard catches a type union member omitted here.
export const BUILT_IN_TEMPLATE_META = [
  { value: 'quote', group: 'email', format: 'rich', name: 'Quote', description: 'Sent when providing a price quote for a new enquiry' },
  { value: 'confirmation', group: 'email', format: 'rich', name: 'Booking confirmation', description: 'Sent to confirm an accepted booking' },
  { value: 'contract_cover', group: 'email', format: 'rich', name: 'Contract email', description: 'Email body when sending only the contract link' },
  { value: 'contract_and_deposit_cover', group: 'email', format: 'rich', name: 'Contract & deposit email', description: 'Email body when sending the contract link with a deposit invoice' },
  { value: 'deposit_invoice_cover', group: 'email', format: 'rich', name: 'Deposit invoice email', description: 'Email body when sending the deposit invoice' },
  { value: 'balance_invoice_cover', group: 'email', format: 'rich', name: 'Balance invoice email', description: 'Email body when sending the final balance invoice' },
  { value: 'series_invoice_cover', group: 'email', format: 'rich', name: 'Series invoice email', description: 'Email body when sending the invoice for a series of bookings' },
  { value: 'contract_received', group: 'email', format: 'rich', name: 'Contract received', description: 'Confirmation sent when the client signs the contract' },
  { value: 'deposit_received', group: 'email', format: 'rich', name: 'Deposit received', description: 'Confirmation sent when the deposit payment arrives' },
  { value: 'music_form_invite', group: 'email', format: 'rich', name: 'Music form invitation', description: 'Sent when inviting the client to fill in their music preferences' },
  { value: 'thank_you', group: 'email', format: 'rich', name: 'Thank you', description: 'Sent after the performance to thank the client' },
  { value: 'contract', group: 'document', format: 'rich', name: 'Contract', description: 'Performance agreement sent to clients for signing' },
  { value: 'band_invite', group: 'email', format: 'rich', name: 'Band invitation email', description: 'Email body when inviting a band member to play at a booking', featureFlag: 'BAND_MEMBERS' },
  { value: 'band_invite_message', group: 'message', format: 'plain', name: 'Band invitation message', description: 'Copy-paste invitation message for a band member', featureFlag: 'BAND_MEMBERS' },
  { value: 'band_call_sheet', group: 'email', format: 'rich', name: 'Band call sheet email', description: 'Email body when sending a band member their call sheet', featureFlag: 'BAND_MEMBERS' },
  { value: 'band_call_sheet_message', group: 'message', format: 'plain', name: 'Band call sheet message', description: 'Copy-paste call sheet link for a band member', featureFlag: 'BAND_MEMBERS' },
  { value: 'band_final_details', group: 'email', format: 'rich', name: 'Band final details email', description: 'Email body when sending final booking details to a band member', featureFlag: 'BAND_MEMBERS' },
  { value: 'band_final_details_message', group: 'message', format: 'plain', name: 'Band final details message', description: 'Copy-paste final details link for a band member', featureFlag: 'BAND_MEMBERS' },
] as const satisfies readonly BuiltInTemplateMeta[];

type AssertNever<T extends never> = T;
export type _BuiltInTemplateMetaCoverage = AssertNever<
  Exclude<BuiltInTemplateType, (typeof BUILT_IN_TEMPLATE_META)[number]['value']>
>;

export const ALL_BUILT_IN_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META.map(({ value }) => value);
export const BUILT_IN_EMAIL_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META
  .filter(({ group }) => group === 'email')
  .map(({ value }) => value);
export const BUILT_IN_DOCUMENT_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META
  .filter(({ group }) => group === 'document')
  .map(({ value }) => value);
export const BUILT_IN_MESSAGE_TYPES: BuiltInTemplateType[] = BUILT_IN_TEMPLATE_META
  .filter(({ group }) => group === 'message')
  .map(({ value }) => value);
export const BUILT_IN_NAMES: Record<BuiltInTemplateType, string> = Object.fromEntries(
  BUILT_IN_TEMPLATE_META.map(({ value, name }) => [value, name]),
) as Record<BuiltInTemplateType, string>;

export const TEMPLATE_DEFAULT_SUBJECTS: Record<string, string> = {
  quote: 'Your quote from {{musicianName}}',
  confirmation: 'Booking confirmation — {{bookingDate}}',
  contract_cover: 'Your contract — {{bookingDate}}',
  contract_and_deposit_cover: 'Your contract and deposit invoice — {{bookingDate}}',
  deposit_invoice_cover: 'Your deposit invoice — {{bookingDate}}',
  balance_invoice_cover: 'Your balance invoice — {{bookingDate}}',
  series_invoice_cover: 'Your invoice for {{seriesLabel}}',
  contract_received: 'Contract received — thank you',
  deposit_received: 'Deposit received — thank you',
  music_form_invite: 'Your music request form — {{bookingDate}}',
  thank_you: 'Thank you — it was a pleasure',
  band_invite: 'You’re invited to play — {{bookingDate}}',
  band_call_sheet: 'Your call sheet — {{bookingDate}}',
  band_final_details: 'Final details — {{bookingDate}}',
};

// Fallback display text used when a variable is null/empty during rendering.
// Keys that appear here are tracked in missingVariables when the fallback is used.
export const VARIABLE_FALLBACKS: Partial<Record<string, string>> = {
  bookingDate: 'your event',
  venueName: 'the venue',
  customerName: 'your client',
  greetingName: 'there',
  seriesLabel: 'your booking series',
  datesCovered: 'the dates in this series',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type TNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: TNode[];
};

const t = (text: string): TNode => ({ type: 'text', text });
const v = (name: string, label: string): TNode => ({ type: 'variable', attrs: { name, label } });
const p = (...content: TNode[]): TNode => ({ type: 'paragraph', content });
const blank = (): TNode => ({ type: 'paragraph' });
const doc = (...content: TNode[]): { type: string; content: TNode[] } => ({ type: 'doc', content });

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULTS: Partial<Record<BuiltInTemplateType, ReturnType<typeof doc>>> = {
  quote: doc(
    p(t('Hi '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Thank you for getting in touch! I would love to perform at your event on '), v('bookingDate', 'Booking date'), t('.')),
    blank(),
    p(t('My fee for this engagement is '), v('bookingFee', 'Booking fee'), t('.')),
    blank(),
    p(t('Please let me know if you have any questions — I\'d be happy to chat.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  confirmation: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('I\'m delighted to confirm your booking for '), v('bookingDate', 'Booking date'), t(' at '), v('venueName', 'Venue name'), t('.')),
    blank(),
    p(t('Performance schedule:')),
    p(v('setsSchedule', 'Sets schedule')),
    blank(),
    p(t('Agreed fee: '), v('bookingFee', 'Booking fee')),
    blank(),
    p(t('I look forward to being part of your special day!')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  contract_cover: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Thank you for confirming your booking for '), v('bookingDate', 'Booking date'), t('. Please find the contract via the link below.')),
    blank(),
    p(v('portalLink', 'Portal link')),
    blank(),
    p(t('Please review and sign at your earliest convenience. Don\'t hesitate to get in touch if you have any questions.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  contract_and_deposit_cover: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Thank you for confirming your booking for '), v('bookingDate', 'Booking date'), t('.')),
    blank(),
    p(t('Please find the contract via the link below:')),
    blank(),
    p(v('portalLink', 'Portal link')),
    blank(),
    p(t('I\'ve also attached the deposit invoice for '), v('invoiceTotal', 'Invoice total'), t(', due by '), v('invoiceDueDate', 'Invoice due date'), t('.')),
    blank(),
    p(t('Please sign the contract and arrange payment of the deposit to secure your date.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  deposit_invoice_cover: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Please find attached your deposit invoice for the booking on '), v('bookingDate', 'Booking date'), t('.')),
    blank(),
    p(t('Amount due: '), v('invoiceTotal', 'Invoice total')),
    p(t('Due date: '), v('invoiceDueDate', 'Invoice due date')),
    blank(),
    p(t('Please don\'t hesitate to get in touch if you have any questions.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  balance_invoice_cover: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Please find attached your final balance invoice for the booking on '), v('bookingDate', 'Booking date'), t('.')),
    blank(),
    p(t('Amount due: '), v('invoiceTotal', 'Invoice total')),
    p(t('Due date: '), v('invoiceDueDate', 'Invoice due date')),
    blank(),
    p(t('Please don\'t hesitate to get in touch if you have any questions.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  // Series invoices are billed to the series customer and cover many dates, so this body
  // names the series and its covered-dates summary. It must never say "deposit" or "balance"
  // (that axis is booking-only, CONTEXT.md) nor reach for a singular {{bookingDate}}.
  series_invoice_cover: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Please find attached your invoice for '), v('seriesLabel', 'Series name'), t('.')),
    blank(),
    p(t('Dates covered: '), v('datesCovered', 'Dates covered')),
    blank(),
    p(t('Amount due: '), v('invoiceTotal', 'Invoice total')),
    p(t('Due date: '), v('invoiceDueDate', 'Invoice due date')),
    blank(),
    p(t('Please don\'t hesitate to get in touch if you have any questions.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  music_form_invite: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('As your event on '), v('bookingDate', 'Booking date'), t(' approaches, I\'d love to hear your music preferences!')),
    blank(),
    p(t('Please take a few minutes to fill in the music request form:')),
    blank(),
    p(v('portalLink', 'Portal link')),
    blank(),
    p(t('Looking forward to making your day extra special.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  thank_you: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Thank you so much for having me perform at your event on '), v('bookingDate', 'Booking date'), t('. It was an absolute pleasure and a privilege.')),
    blank(),
    p(t('I hope the day was everything you\'d hoped for and more!')),
    blank(),
    p(t('Warmest wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  contract_received: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('Thank you — I\'ve received your signed contract for the booking on '), v('bookingDate', 'Booking date'), t('. Your date is now secured!')),
    blank(),
    p(t('I\'ll be in touch closer to the event. In the meantime, please don\'t hesitate to get in touch if you have any questions.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  deposit_received: doc(
    p(t('Dear '), v('customerName', 'Customer name'), t(',')),
    blank(),
    p(t('I\'m pleased to confirm that I\'ve received your deposit for the booking on '), v('bookingDate', 'Booking date'), t('. Thank you!')),
    blank(),
    p(t('Your booking is fully confirmed and your date is secured. I look forward to performing at your event.')),
    blank(),
    p(t('Best wishes,')),
    p(v('musicianName', 'Musician name')),
    p(v('musicianEmail', 'Musician email')),
  ),

  band_invite: doc(
    p(t('Hi '), v('bandMemberName', 'Band member name'), t(',')),
    blank(),
    p(t('I’d love you to play with me on '), v('bookingDate', 'Booking date'), t(' at '), v('venueName', 'Venue name'), t('.')),
    blank(),
    p(t('Please accept or decline in your band portal:')),
    p(v('portalLink', 'Portal link')),
    blank(),
    p(t('A calendar invitation is attached.')),
    blank(),
    p(t('Thanks,')),
    p(v('musicianName', 'Musician name')),
  ),

  band_invite_message: doc(
    p(t('Invitation: '), v('portalLink', 'Portal link')),
    p(t('For '), v('bookingDate', 'Booking date'), t(' — please reply there.')),
  ),

  band_call_sheet: doc(
    p(t('Hi '), v('bandMemberName', 'Band member name'), t(',')),
    blank(),
    p(t('Your call sheet for '), v('bookingDate', 'Booking date'), t(' is attached.')),
    blank(),
    p(t('Your call time and gig details are also in your band portal:')),
    p(v('portalLink', 'Portal link')),
    blank(),
    p(t('Thanks,')),
    p(v('musicianName', 'Musician name')),
  ),

  band_call_sheet_message: doc(
    p(t('Your call sheet: '), v('portalLink', 'Portal link')),
    p(t('For '), v('bookingDate', 'Booking date'), t('.')),
  ),

  band_final_details: doc(
    p(t('Hi '), v('bandMemberName', 'Band member name'), t(',')),
    blank(),
    p(t('Here are the final details for '), v('bookingDate', 'Booking date'), t(' at '), v('venueName', 'Venue name'), t(':')),
    blank(),
    p(v('portalLink', 'Portal link')),
    blank(),
    p(t('Thanks,')),
    p(v('musicianName', 'Musician name')),
  ),

  band_final_details_message: doc(
    p(t('Final details: '), v('portalLink', 'Portal link')),
    p(t('For '), v('bookingDate', 'Booking date'), t('.')),
  ),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

type THeadingNode = TNode & { attrs: { level: number } };
const h = (level: 2 | 3, ...content: TNode[]): THeadingNode => ({ type: 'heading', attrs: { level }, content });

// ─── Document defaults ────────────────────────────────────────────────────────

const DOCUMENT_DEFAULTS: Partial<Record<BuiltInTemplateType, ReturnType<typeof doc>>> = {
  contract: doc(
    h(2, t('Performance Agreement')),
    blank(),
    p(t('This agreement is entered into between '), v('musicianName', 'Musician name'), t(' ("the Musician") and '), v('customerName', 'Customer name'), t(' ("the Client").')),
    blank(),
    h(2, t('1. Event Details')),
    p(t('Date: '), v('bookingDate', 'Booking date')),
    p(t('Venue: '), v('venueName', 'Venue name')),
    blank(),
    h(2, t('2. Performance')),
    p(v('setsSchedule', 'Sets schedule')),
    blank(),
    h(2, t('3. Fee')),
    p(t('The agreed fee for this engagement is '), v('bookingFee', 'Booking fee'), t('.')),
    blank(),
    h(2, t('4. Payment Terms')),
    p(t('Payment details to be agreed between the parties.')),
    blank(),
    h(2, t('5. Cancellation')),
    p(t('Cancellation terms to be agreed between the parties.')),
    blank(),
    h(2, t('6. General')),
    p(t('This agreement constitutes the entire understanding between the parties. Any amendments must be agreed in writing.')),
    blank(),
    h(2, t('Signatures')),
    blank(),
    p(t('Musician: '), v('musicianName', 'Musician name')),
    p(t('Date: ____________________')),
    blank(),
    p(t('Client: '), v('customerName', 'Customer name')),
    p(t('Date: ____________________')),
  ),
};

export function getDefaultContent(type: BuiltInTemplateType): Record<string, unknown> {
  return ((DEFAULTS[type] ?? DOCUMENT_DEFAULTS[type]) ?? doc(blank())) as Record<string, unknown>;
}
