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
