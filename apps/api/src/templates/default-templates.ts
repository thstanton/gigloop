export type BuiltInTemplateType =
  | 'quote'
  | 'confirmation'
  | 'contract_cover'
  | 'contract_and_deposit_cover'
  | 'deposit_invoice_cover'
  | 'balance_invoice_cover'
  | 'music_form_invite'
  | 'thank_you'
  | 'contract_received'
  | 'deposit_received'
  | 'contract';

export const TEMPLATE_DEFAULT_SUBJECTS: Record<string, string> = {
  quote: 'Your quote from {{musicianName}}',
  confirmation: 'Booking confirmation — {{bookingDate}}',
  contract_cover: 'Your contract — {{bookingDate}}',
  contract_and_deposit_cover: 'Your contract and deposit invoice — {{bookingDate}}',
  deposit_invoice_cover: 'Your deposit invoice — {{bookingDate}}',
  balance_invoice_cover: 'Your balance invoice — {{bookingDate}}',
  contract_received: 'Contract received — thank you',
  deposit_received: 'Deposit received — thank you',
  music_form_invite: 'Your music request form — {{bookingDate}}',
  thank_you: 'Thank you — it was a pleasure',
};

// Fallback display text used when a variable is null/empty during rendering.
// Keys that appear here are tracked in missingVariables when the fallback is used.
export const VARIABLE_FALLBACKS: Partial<Record<string, string>> = {
  bookingDate: 'your event',
  venueName: 'the venue',
  customerName: 'your client',
  greetingName: 'there',
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
};

export const BUILT_IN_EMAIL_TYPES: BuiltInTemplateType[] = [
  'quote',
  'confirmation',
  'contract_cover',
  'contract_and_deposit_cover',
  'deposit_invoice_cover',
  'balance_invoice_cover',
  'contract_received',
  'deposit_received',
  'music_form_invite',
  'thank_you',
];

export const BUILT_IN_DOCUMENT_TYPES: BuiltInTemplateType[] = [
  'contract',
];

export const ALL_BUILT_IN_TYPES: BuiltInTemplateType[] = [
  ...BUILT_IN_EMAIL_TYPES,
  ...BUILT_IN_DOCUMENT_TYPES,
];

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

export const BUILT_IN_NAMES: Record<BuiltInTemplateType, string> = {
  quote: 'Quote',
  confirmation: 'Booking confirmation',
  contract_cover: 'Contract email',
  contract_and_deposit_cover: 'Contract & deposit email',
  deposit_invoice_cover: 'Deposit invoice email',
  balance_invoice_cover: 'Balance invoice email',
  contract_received: 'Contract received',
  deposit_received: 'Deposit received',
  music_form_invite: 'Music form invitation',
  thank_you: 'Thank you',
  contract: 'Contract',
};

export function getDefaultContent(type: BuiltInTemplateType): Record<string, unknown> {
  return ((DEFAULTS[type] ?? DOCUMENT_DEFAULTS[type]) ?? doc(blank())) as Record<string, unknown>;
}
