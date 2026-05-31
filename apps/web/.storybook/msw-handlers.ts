import { http, HttpResponse } from 'msw';

const contacts = [
  {
    id: 'c1',
    userId: 'user_storybook_test',
    name: 'The Grand Hotel',
    email: 'events@grandhotel.com',
    phone: '+44 7700 900123',
    website: null,
    address: '1 High Street, London',
    notes: null,
    greetingName: null,
    primaryRole: 'VENUE',
    parkingInfo: null,
    accessInfo: null,
    equipmentAvailable: null,
    commissionArrangement: null,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'c2',
    userId: 'user_storybook_test',
    name: 'Sophie Hartley',
    email: 'sophie@example.com',
    phone: '+44 7700 900456',
    website: null,
    address: null,
    notes: 'Repeat customer',
    greetingName: 'Sophie',
    primaryRole: 'CUSTOMER',
    parkingInfo: null,
    accessInfo: null,
    equipmentAvailable: null,
    commissionArrangement: null,
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-02-01T09:00:00Z',
  },
  {
    id: 'c3',
    userId: 'user_storybook_test',
    name: 'Premier Events Agency',
    email: 'bookings@premierevents.com',
    phone: null,
    website: 'https://premierevents.com',
    address: null,
    notes: null,
    greetingName: null,
    primaryRole: 'BOOKING_AGENT',
    parkingInfo: null,
    accessInfo: null,
    equipmentAvailable: null,
    commissionArrangement: '15%',
    createdAt: '2024-03-10T14:00:00Z',
    updatedAt: '2024-03-10T14:00:00Z',
  },
];

const bookings = [
  {
    id: 'b1',
    createdAt: '2024-04-01T10:00:00Z',
    updatedAt: '2024-04-01T10:00:00Z',
    status: 'CONFIRMED',
    eventType: 'CORPORATE',
    date: '2030-07-15T19:00:00Z',
    title: 'Grand Hotel Summer Ball',
    fee: '1500.00',
    notes: null,
    customerId: 'c1',
    customer: { id: 'c1', name: 'The Grand Hotel', email: 'events@grandhotel.com' },
    venueId: 'c1',
    venue: { id: 'c1', name: 'The Grand Hotel', email: null },
    bookingAgentId: null,
    bookingAgent: null,
    sets: [{ startTime: '19:00' }],
  },
  {
    id: 'b2',
    createdAt: '2024-04-05T11:00:00Z',
    updatedAt: '2024-04-05T11:00:00Z',
    status: 'PROVISIONAL',
    eventType: 'PRIVATE',
    date: '2030-06-22T18:00:00Z',
    title: "Sophie's Birthday Party",
    fee: '800.00',
    notes: null,
    customerId: 'c2',
    customer: { id: 'c2', name: 'Sophie Hartley', email: 'sophie@example.com' },
    venueId: null,
    venue: null,
    bookingAgentId: null,
    bookingAgent: null,
    sets: [],
  },
  {
    id: 'b3',
    createdAt: '2024-04-08T09:00:00Z',
    updatedAt: '2024-04-08T09:00:00Z',
    status: 'ENQUIRY',
    eventType: 'CORPORATE',
    date: '2030-05-10T19:30:00Z',
    title: 'Corporate Awards Dinner',
    fee: '2000.00',
    notes: null,
    customerId: 'c3',
    customer: { id: 'c3', name: 'Premier Events Agency', email: 'bookings@premierevents.com' },
    venueId: null,
    venue: null,
    bookingAgentId: 'c3',
    bookingAgent: { id: 'c3', name: 'Premier Events Agency', email: null },
    sets: [{ startTime: '19:30' }, { startTime: '21:00' }],
  },
];

const songs = [
  { id: 's1', userId: 'user_storybook_test', title: 'Fly Me to the Moon', artist: 'Frank Sinatra', key: 'C', tempo: 'Medium', notes: null, createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 's2', userId: 'user_storybook_test', title: 'Autumn Leaves', artist: 'Eva Cassidy', key: 'G minor', tempo: 'Slow', notes: null, createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
  { id: 's3', userId: 'user_storybook_test', title: 'La Vie en Rose', artist: 'Édith Piaf', key: 'F', tempo: 'Slow', notes: 'French lyrics', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-03T00:00:00Z' },
];

const dashboardActions: unknown[] = [];

const packages = [
  {
    id: 'pkg1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    label: 'Wedding Package', category: 'WEDDING', icon: 'heart',
    keyMoments: [], defaultGenreSelection: [], notes: null,
    isSystemDefault: false, enabled: true,
    slots: [
      { id: 'sl1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', label: 'Ceremony', durationMinutes: 60 },
      { id: 'sl2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', label: 'Reception', durationMinutes: 180 },
    ],
  },
  {
    id: 'pkg2', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z',
    label: 'Corporate Dinner', category: 'CORPORATE', icon: 'briefcase',
    keyMoments: [], defaultGenreSelection: [], notes: null,
    isSystemDefault: false, enabled: true,
    slots: [
      { id: 'sl3', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z', label: 'Welcome drinks', durationMinutes: 45 },
    ],
  },
];

const templates = [
  {
    id: 't1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
    name: 'My confirmation', content: { type: 'doc', content: [] }, builtInType: 'confirmation',
  },
  {
    id: 't2', createdAt: '2024-01-02T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z',
    name: 'My quote', content: { type: 'doc', content: [] }, builtInType: 'quote',
  },
];

const customer = {
  id: 'c2', name: 'Sophie Hartley', email: 'sophie@example.com', phone: '+44 7700 900456',
  address: null, notes: null, greetingName: 'Sophie', primaryRole: 'CUSTOMER',
  parkingInfo: null, accessInfo: null, equipmentAvailable: null,
  website: null, commissionArrangement: null,
};

const venue = {
  id: 'c1', name: 'The Grand Hotel', email: 'events@grandhotel.com', phone: '+44 7700 900123',
  address: '1 High Street, London', notes: null, greetingName: null, primaryRole: 'VENUE',
  parkingInfo: 'Use hotel car park.', accessInfo: null, equipmentAvailable: 'Grand piano.',
  website: null, commissionArrangement: null,
};

const weddingPackage = {
  id: 'bp1', order: 0, packageId: 'pkg1',
  package: { id: 'pkg1', label: 'Wedding Package', icon: 'heart', keyMoments: ['First dance'], defaultGenreSelection: ['JAZZ'] },
};

const baseDetail = {
  id: 'bd1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z',
  eventType: 'WEDDING', date: '2030-09-15T15:00:00Z',
  title: "Sophie's Wedding", fee: '2000.00', notes: null,
  customerId: 'c2', customer,
  venueId: 'c1', venue,
  bookingAgentId: null, bookingAgent: null,
  sets: [{ id: 's1', order: 0, duration: 60, startTime: '15:30', label: 'Ceremony', packageId: 'pkg1' }],
  packages: [weddingPackage],
  activeContract: null, depositReceivedAt: null,
  portalToken: 'tok_storybook',
  hasMusicFormConfig: false, hasMusicFormResponse: false,
};

const sentContract = {
  id: 'con1', createdAt: '2030-04-10T10:00:00Z', updatedAt: '2030-04-11T10:00:00Z',
  status: 'SENT', content: { type: 'doc', content: [] }, signedAt: null,
};

const signedContract = {
  id: 'con1', createdAt: '2030-04-10T10:00:00Z', updatedAt: '2030-04-15T10:00:00Z',
  status: 'SIGNED', content: { type: 'doc', content: [] }, signedAt: '2030-04-15T10:00:00Z',
};

const lineItem = (amount: string) => ({ id: 'li1', createdAt: '2030-04-01T00:00:00Z', updatedAt: '2030-04-01T00:00:00Z', description: 'Performance fee', amount, order: 0 });

const depositSent = { id: 'inv1', createdAt: '2030-04-12T10:00:00Z', updatedAt: '2030-04-12T10:00:00Z', status: 'SENT', isDeposit: true, invoiceNumber: 'INV-001', issueDate: '2030-04-12', dueDate: '2030-05-12', paidAt: null, bookingId: 'bd1', billToContactId: 'c2', billToContact: customer, lineItems: [lineItem('600.00')] };
const depositPaid = { ...depositSent, status: 'PAID', paidAt: '2030-05-10T10:00:00Z' };
const balanceSent = { id: 'inv2', createdAt: '2030-07-01T10:00:00Z', updatedAt: '2030-07-01T10:00:00Z', status: 'SENT', isDeposit: false, invoiceNumber: 'INV-002', issueDate: '2030-07-01', dueDate: '2030-08-01', paidAt: null, bookingId: 'bd1', billToContactId: 'c2', billToContact: customer, lineItems: [lineItem('1400.00')] };
const balancePaid = { ...balanceSent, status: 'PAID', paidAt: '2030-08-05T10:00:00Z' };

export const bookingDetails: Record<string, object> = {
  NewEnquiry: { ...baseDetail, status: 'ENQUIRY', venueId: null, venue: null, activeContract: null },
  ConfirmedWithContract: { ...baseDetail, status: 'CONFIRMED', activeContract: sentContract },
  ReadyToGo: { ...baseDetail, status: 'READY', activeContract: signedContract, depositReceivedAt: '2030-05-10T10:00:00Z' },
  Complete: { ...baseDetail, status: 'COMPLETE', activeContract: signedContract, depositReceivedAt: '2030-05-10T10:00:00Z' },
  Cancelled: { ...baseDetail, status: 'CANCELLED', activeContract: null },
};

export const checklistFixtures: Record<string, unknown[]> = {
  NewEnquiry: [
    { id: 'ci1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z', bookingId: 'bd1', key: 'send_quote', label: 'Send quote', completedBy: 'USER', state: 'PENDING', order: 0, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'PROVISIONAL', completedAt: null, dueDate: null, dueDateRule: null },
    { id: 'ci2', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z', bookingId: 'bd1', key: 'create_contract', label: 'Create contract', completedBy: 'USER', state: 'BLOCKED', order: 1, dependsOn: ['ci1'], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', completedAt: null, dueDate: null, dueDateRule: null },
  ],
  ConfirmedWithContract: [
    { id: 'ci1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-10T10:00:00Z', bookingId: 'bd1', key: 'send_quote', label: 'Send quote', completedBy: 'USER', state: 'COMPLETE', order: 0, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'PROVISIONAL', completedAt: '2030-04-10T10:00:00Z', dueDate: null, dueDateRule: null },
    { id: 'ci2', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-10T10:00:00Z', bookingId: 'bd1', key: 'create_contract', label: 'Create contract', completedBy: 'USER', state: 'COMPLETE', order: 1, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', completedAt: '2030-04-10T10:00:00Z', dueDate: null, dueDateRule: null },
    { id: 'ci3', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z', bookingId: 'bd1', key: 'contract_signed', label: 'Contract signed', completedBy: 'USER', state: 'PENDING', order: 2, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', completedAt: null, dueDate: null, dueDateRule: null },
    { id: 'ci4', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z', bookingId: 'bd1', key: 'deposit_received', label: 'Deposit received', completedBy: 'USER', state: 'PENDING', order: 3, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', completedAt: null, dueDate: null, dueDateRule: null },
  ],
  ReadyToGo: [
    { id: 'ci1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-10T10:00:00Z', bookingId: 'bd1', key: 'send_quote', label: 'Send quote', completedBy: 'USER', state: 'COMPLETE', order: 0, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'PROVISIONAL', completedAt: '2030-04-10T10:00:00Z', dueDate: null, dueDateRule: null },
    { id: 'ci2', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-15T10:00:00Z', bookingId: 'bd1', key: 'contract_signed', label: 'Contract signed', completedBy: 'USER', state: 'COMPLETE', order: 1, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', completedAt: '2030-04-15T10:00:00Z', dueDate: null, dueDateRule: null },
    { id: 'ci3', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-05-10T10:00:00Z', bookingId: 'bd1', key: 'deposit_received', label: 'Deposit received', completedBy: 'USER', state: 'COMPLETE', order: 2, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'CONFIRMED', completedAt: '2030-05-10T10:00:00Z', dueDate: null, dueDateRule: null },
    { id: 'ci4', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-04-01T10:00:00Z', bookingId: 'bd1', key: 'music_form_invite', label: 'Send music form invite', completedBy: 'USER', state: 'PENDING', order: 3, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'READY', completedAt: null, dueDate: null, dueDateRule: null },
  ],
  Complete: [
    { id: 'ci1', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-09-16T10:00:00Z', bookingId: 'bd1', key: 'play_the_gig', label: 'Play the gig', completedBy: 'USER', state: 'COMPLETE', order: 0, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'COMPLETE', completedAt: '2030-09-16T10:00:00Z', dueDate: null, dueDateRule: null },
    { id: 'ci2', createdAt: '2030-04-01T10:00:00Z', updatedAt: '2030-09-17T10:00:00Z', bookingId: 'bd1', key: 'send_thank_you', label: 'Send thank you', completedBy: 'USER', state: 'COMPLETE', order: 1, dependsOn: [], autoCompleteRule: null, requiredForStatus: 'COMPLETE', completedAt: '2030-09-17T10:00:00Z', dueDate: null, dueDateRule: null },
  ],
  Cancelled: [],
};

export const invoiceFixtures: Record<string, unknown[]> = {
  NewEnquiry: [],
  ConfirmedWithContract: [depositSent],
  ReadyToGo: [depositPaid, balanceSent],
  Complete: [depositPaid, balancePaid],
  Cancelled: [],
};

export const communicationFixtures: Record<string, unknown[]> = {
  NewEnquiry: [],
  ConfirmedWithContract: [
    { id: 'cm1', createdAt: '2030-04-10T10:00:00Z', updatedAt: '2030-04-10T10:00:00Z', direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT', subject: 'Your booking confirmation', body: '<p>Dear Sophie, we are delighted to confirm your booking.</p>', sentAt: '2030-04-10T10:00:00Z', bookingId: 'bd1', contactId: 'c2', contact: customer, templateId: null, template: null },
  ],
  ReadyToGo: [
    { id: 'cm1', createdAt: '2030-04-10T10:00:00Z', updatedAt: '2030-04-10T10:00:00Z', direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT', subject: 'Contract for your review', body: '<p>Please find the contract attached.</p>', sentAt: '2030-04-10T10:00:00Z', bookingId: 'bd1', contactId: 'c2', contact: customer, templateId: null, template: null },
  ],
  Complete: [
    { id: 'cm1', createdAt: '2030-09-17T10:00:00Z', updatedAt: '2030-09-17T10:00:00Z', direction: 'OUTBOUND', channel: 'EMAIL', status: 'SENT', subject: 'Thank you for a wonderful evening', body: '<p>It was such a pleasure to perform at your wedding.</p>', sentAt: '2030-09-17T10:00:00Z', bookingId: 'bd1', contactId: 'c2', contact: customer, templateId: null, template: null },
  ],
  Cancelled: [],
};

const userProfile = {
  id: 'up1', userId: 'user_storybook_test',
  businessName: 'Tim Stanton Music', vatNumber: null, vatRate: 20,
  depositPercentage: 30, defaultPaymentTermsDays: 30,
  createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z',
};

export function makeBookingDetailHandlers(scenario: string) {
  return [
    http.get('/api/bookings/bd1', () => HttpResponse.json(bookingDetails[scenario])),
    http.get('/api/bookings/bd1/checklist', () => HttpResponse.json(checklistFixtures[scenario] ?? [])),
    http.get('/api/bookings/bd1/invoices', () => HttpResponse.json(invoiceFixtures[scenario] ?? [])),
    http.get('/api/bookings/bd1/documents', () => HttpResponse.json([])),
    http.get('/api/bookings/bd1/communications', () => HttpResponse.json(communicationFixtures[scenario] ?? [])),
    http.get('/api/me', () => HttpResponse.json(userProfile)),
    http.get('/api/templates', () => HttpResponse.json(templates)),
  ];
}

export const mswHandlers = {
  contacts: [
    http.get('/api/contacts', () => HttpResponse.json(contacts)),
    http.get('/api/contacts/:id', ({ params }) => {
      const c = contacts.find((x) => x.id === params.id);
      return c ? HttpResponse.json(c) : new HttpResponse(null, { status: 404 });
    }),
  ],
  bookings: [
    http.get('/api/bookings', () => HttpResponse.json(bookings)),
    http.get('/api/bookings/:id', ({ params }) => {
      const b = bookings.find((x) => x.id === params.id);
      return b ? HttpResponse.json(b) : new HttpResponse(null, { status: 404 });
    }),
  ],
  songs: [
    http.get('/api/songs', () => HttpResponse.json(songs)),
  ],
  dashboard: [
    http.get('/api/bookings/actions', () => HttpResponse.json(dashboardActions)),
  ],
  packages: [
    http.get('/api/packages', () => HttpResponse.json(packages)),
  ],
  templates: [
    http.get('/api/templates', () => HttpResponse.json(templates)),
  ],
};

export const allHandlers = [
  ...mswHandlers.contacts,
  ...mswHandlers.bookings,
  ...mswHandlers.songs,
  ...mswHandlers.dashboard,
  ...mswHandlers.packages,
  ...mswHandlers.templates,
];
