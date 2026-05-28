import { PrismaClient } from '@prisma/client';
import { CHECKLIST_DEFAULTS, computeDueDate, type ChecklistDefaultItem } from '../src/bookings/checklist-defaults';

const prisma = new PrismaClient();
const USER_ID = 'user_3E0gEsNgpVB2KnlKfWD6vFw6G7d';

// Simplified evaluator for seed — replicates core state machine without NestJS DI
function seedChecklistStates(
  defaults: ChecklistDefaultItem[],
  opts: {
    bookingStatus: string;
    hasDepositInvoice: boolean;
    hasBalanceInvoice: boolean;
    hasContract: boolean;
    contractSigned: boolean;
    depositReceived: boolean;
    hasMusicFormResponse: boolean;
    commBuiltInTypes: string[];
  },
): Array<{ item: ChecklistDefaultItem; state: string }> {
  const SKIP_RULES: Record<string, string[]> = {
    send_quote: ['CONFIRMED', 'READY', 'COMPLETE'],
    contract_signed: ['READY', 'COMPLETE'],
  };
  const stateMap = new Map<string, string>();

  for (const item of defaults) {
    const skipAt = SKIP_RULES[item.key];
    if (skipAt?.includes(opts.bookingStatus)) {
      stateMap.set(item.key, 'SKIPPED');
      continue;
    }

    const depsComplete = item.dependsOn.every((dep) => stateMap.get(dep) === 'COMPLETE');
    if (!depsComplete) {
      stateMap.set(item.key, 'BLOCKED');
      continue;
    }

    let complete = false;
    if (item.autoCompleteRule) {
      const rule = item.autoCompleteRule as Record<string, unknown>;
      switch (rule.type) {
        case 'bookingField':
          if (rule.field === 'depositReceivedAt') complete = opts.depositReceived;
          else if (rule.field === 'activeContract') complete = opts.hasContract;
          break;
        case 'invoiceExists':
          complete = rule.isDeposit ? opts.hasDepositInvoice : opts.hasBalanceInvoice;
          break;
        case 'communicationSent':
          complete = (rule.templateTypes as string[]).some((t) => opts.commBuiltInTypes.includes(t));
          break;
        case 'contractSigned':
          complete = opts.contractSigned;
          break;
        case 'musicFormResponse':
          complete = opts.hasMusicFormResponse;
          break;
      }
    }
    stateMap.set(item.key, complete ? 'COMPLETE' : 'PENDING');
  }

  return defaults.map((item) => ({ item, state: stateMap.get(item.key) ?? 'PENDING' }));
}

async function seedChecklist(
  bookingId: string,
  bookingDate: Date,
  bookingCreatedAt: Date,
  opts: Parameters<typeof seedChecklistStates>[1],
) {
  const states = seedChecklistStates(CHECKLIST_DEFAULTS, opts);
  const data = states.map(({ item, state }, idx) => ({
    userId: USER_ID,
    bookingId,
    key: item.key,
    label: item.label,
    completedBy: item.completedBy,
    state,
    order: idx + 1,
    dependsOn: item.dependsOn,
    ...(item.autoCompleteRule !== null ? { autoCompleteRule: item.autoCompleteRule as object } : {}),
    requiredForStatus: item.requiredForStatus,
    dueDate: computeDueDate(item.dueDateRule, bookingDate, bookingCreatedAt),
    ...(item.dueDateRule !== null ? { dueDateRule: item.dueDateRule as object } : {}),
    completedAt: state === 'COMPLETE' ? new Date() : null,
  }));
  await prisma.bookingChecklistItem.createMany({ data });
}

function doc(...paragraphs: string[]) {
  return {
    type: 'doc',
    content: paragraphs.map((text) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    })),
  };
}

async function main() {
  console.log('Cleaning existing seed data...');

  await prisma.musicFormResponse.deleteMany({ where: { userId: USER_ID } });
  await prisma.musicFormConfig.deleteMany({ where: { userId: USER_ID } });
  await prisma.communication.deleteMany({ where: { userId: USER_ID } });
  await prisma.document.deleteMany({ where: { userId: USER_ID } });
  await prisma.invoiceLineItem.deleteMany({ where: { userId: USER_ID } });
  await prisma.invoice.deleteMany({ where: { userId: USER_ID } });
  await prisma.bookingChecklistItem.deleteMany({ where: { userId: USER_ID } });
  await prisma.performanceSet.deleteMany({ where: { userId: USER_ID } });
  await prisma.bookingPerformanceFormat.deleteMany({ where: { userId: USER_ID } });
  await prisma.booking.deleteMany({ where: { userId: USER_ID } });
  await prisma.performanceFormat.deleteMany({ where: { userId: USER_ID } });
  await prisma.contact.deleteMany({ where: { userId: USER_ID } });
  await prisma.song.deleteMany({ where: { userId: USER_ID } });
  await prisma.template.deleteMany({ where: { userId: USER_ID } });
  await prisma.publicProfile.deleteMany({ where: { userId: USER_ID } });
  await prisma.userProfile.deleteMany({ where: { userId: USER_ID } });

  console.log('Seeding profiles...');

  await prisma.publicProfile.create({
    data: {
      userId: USER_ID,
      businessName: 'Tim Stanton Music',
      displayName: 'Tim Stanton',
      bio: 'Professional pianist and vocalist with over 15 years of experience performing at weddings, corporate events, and private functions across the UK.',
      email: 'tim@timstantonmusic.co.uk',
      phone: '07700 900123',
      brandColour: '#2D3748',
      portalTheme: 'LIGHT_ROMANTIC',
      website: 'https://timstantonmusic.co.uk',
      socials: {
        instagram: 'https://instagram.com/timstantonmusic',
        facebook: 'https://facebook.com/timstantonmusic',
      },
    },
  });

  await prisma.userProfile.create({
    data: {
      userId: USER_ID,
      address: '42 Maple Street, London, SE1 4PP',
      vatNumber: 'GB123456789',
      defaultPaymentTermsDays: 14,
      invoiceNumberSequence: 7,
      invoiceSequenceYear: 2026,
      depositTrackingMode: 'INVOICE',
      digestEmailEnabled: true,
      songRequestFormEnabled: true,
    },
  });

  console.log('Seeding contacts...');

  const [emma, sophie, charlotte, meridian, harrington, barnsleyHouse, theNed, stMarys, cellarSociety] =
    await Promise.all([
      // Customers
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Emma & James Whitfield',
          email: 'emma.whitfield@gmail.com',
          phone: '07700 900201',
          address: '14 Rose Lane, Guildford, GU1 3AB',
          notes: 'Met at a tasting evening at Barnsley House. Very organised, prefer email.',
        },
      }),
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Sophie & Daniel Okafor',
          email: 'sophie.okafor@outlook.com',
          phone: '07700 900202',
          notes: 'Referred by Cellar Society. Want a mix of contemporary and classical.',
        },
      }),
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Charlotte & Oliver Barnes',
          email: 'cbarnes@gmail.com',
          phone: '07700 900203',
          address: '7 The Avenue, Oxford, OX2 6HT',
          notes: 'Small intimate ceremony, max 40 guests. Acoustic only.',
        },
      }),
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Meridian Financial Group',
          email: 'events@meridianfg.co.uk',
          phone: '020 7946 0301',
          notes: 'Annual summer party. Contact is Sarah Holt, events manager.',
        },
      }),
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Harrington & Co Solicitors',
          email: 'p.harrington@harringtonco.co.uk',
          phone: '020 7946 0401',
          notes: 'Christmas party, ~80 guests. Very formal brief.',
        },
      }),
      // Venues
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Barnsley House Hotel',
          email: 'events@barnsleyhouse.com',
          phone: '01285 740000',
          address: 'Barnsley, Cirencester, GL7 5EE',
          parkingInfo: 'Free parking on site — enter via the east gate and ask for the events team.',
          accessInfo: 'Piano is in the Potager Room. Load-in from the side entrance on Barn Lane.',
          equipmentAvailable: 'Yamaha upright piano (tuned monthly). Small PA available on request.',
          notes: 'Coordinator is Fiona Marsh. Excellent venue, very musician-friendly.',
        },
      }),
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'The Ned, London',
          email: 'events@thened.com',
          phone: '020 3828 2000',
          address: '27 Poultry, London, EC2R 8AJ',
          parkingInfo: 'No on-site parking. Nearest NCP is on Queen Street.',
          accessInfo: 'Load-in via the Poultry entrance — ask for AV team. Lift to lower ground floor.',
          equipmentAvailable: 'Full PA system provided. Grand piano in the main hall.',
          notes: 'High-spec venue. Security check required on arrival — bring ID.',
        },
      }),
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: "St Mary's Church, Oxfordshire",
          email: 'vicar@stmarysoxford.org.uk',
          phone: '01865 557530',
          address: 'Church Lane, Great Milton, Oxford, OX44 7PB',
          accessInfo: 'Must be set up before 09:00. Side entrance via the vestry.',
          notes: 'Acoustic only — no amplification permitted inside the church.',
        },
      }),
      // Referrer
      prisma.contact.create({
        data: {
          userId: USER_ID,
          name: 'Cellar Society Events',
          email: 'bookings@cellarsociety.co.uk',
          phone: '020 7946 0801',
          website: 'https://cellarsociety.co.uk',
          commissionArrangement: '10% of fee, invoiced monthly. Contact: Marcus Webb.',
          notes: 'Reliable agency, primarily corporate and private events in London.',
        },
      }),
    ]);

  console.log('Seeding songs...');

  await prisma.song.createMany({
    data: [
      { userId: USER_ID, title: 'Thinking Out Loud', artist: 'Ed Sheeran', genre: 'CONTEMPORARY', active: true, tags: ['romantic', 'popular'] },
      { userId: USER_ID, title: 'All of Me', artist: 'John Legend', genre: 'CONTEMPORARY', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'A Thousand Years', artist: 'Christina Perri', genre: 'CONTEMPORARY', active: true, tags: ['romantic', 'wedding'] },
      { userId: USER_ID, title: 'Perfect', artist: 'Ed Sheeran', genre: 'CONTEMPORARY', active: true, tags: ['romantic', 'popular'] },
      { userId: USER_ID, title: "Can't Help Falling in Love", artist: 'Elvis Presley', genre: 'CONTEMPORARY', active: true, tags: ['classic', 'romantic'] },
      { userId: USER_ID, title: 'Make You Feel My Love', artist: 'Bob Dylan', genre: 'CONTEMPORARY', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'The Scientist', artist: 'Coldplay', genre: 'CONTEMPORARY', active: true, tags: [] },
      { userId: USER_ID, title: 'Your Song', artist: 'Elton John', genre: 'CONTEMPORARY', active: true, tags: ['classic', 'romantic'] },
      { userId: USER_ID, title: 'Canon in D', artist: 'Pachelbel', genre: 'CLASSICAL', active: true, tags: ['processional', 'ceremony'] },
      { userId: USER_ID, title: 'Clair de Lune', artist: 'Debussy', genre: 'CLASSICAL', active: true, tags: ['instrumental'] },
      { userId: USER_ID, title: 'Air on the G String', artist: 'Bach', genre: 'CLASSICAL', active: true, tags: ['processional', 'ceremony'] },
      { userId: USER_ID, title: 'Gymnopédie No. 1', artist: 'Satie', genre: 'CLASSICAL', active: true, tags: ['instrumental', 'ambient'] },
      { userId: USER_ID, title: 'Moonlight Sonata', artist: 'Beethoven', genre: 'CLASSICAL', active: true, tags: ['instrumental'] },
      { userId: USER_ID, title: 'Hallelujah', artist: 'Leonard Cohen (arr. classical)', genre: 'CLASSICAL', active: true, tags: ['ceremony'] },
      { userId: USER_ID, title: 'Fly Me to the Moon', artist: 'Frank Sinatra', genre: 'JAZZ', active: true, tags: ['upbeat', 'popular'] },
      { userId: USER_ID, title: 'The Way You Look Tonight', artist: 'Frank Sinatra', genre: 'JAZZ', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'Autumn Leaves', artist: 'Standard', genre: 'JAZZ', active: true, tags: [] },
      { userId: USER_ID, title: 'Misty', artist: 'Erroll Garner', genre: 'JAZZ', active: true, tags: [] },
      { userId: USER_ID, title: 'At Last', artist: 'Etta James', genre: 'JAZZ', active: true, tags: ['romantic', 'first dance'] },
      { userId: USER_ID, title: 'Summertime', artist: 'Gershwin', genre: 'JAZZ', active: true, tags: [] },
      { userId: USER_ID, title: 'What a Wonderful World', artist: 'Louis Armstrong', genre: 'JAZZ', active: true, tags: ['popular'] },
      { userId: USER_ID, title: 'A Whole New World', artist: 'Aladdin', genre: 'FILM_TV_MUSICALS', active: true, tags: ['popular'] },
      { userId: USER_ID, title: 'Beauty and the Beast', artist: 'Disney', genre: 'FILM_TV_MUSICALS', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'Somewhere Over the Rainbow', artist: 'Wizard of Oz', genre: 'FILM_TV_MUSICALS', active: true, tags: ['classic'] },
      { userId: USER_ID, title: 'My Heart Will Go On', artist: 'Celine Dion', genre: 'FILM_TV_MUSICALS', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'Can You Feel the Love Tonight', artist: 'The Lion King', genre: 'FILM_TV_MUSICALS', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'Tujh Mein Rab Dikhta Hai', artist: 'Rab Ne Bana Di Jodi', genre: 'BOLLYWOOD', active: true, tags: ['romantic'] },
      { userId: USER_ID, title: 'Kabhi Khushi Kabhie Gham', artist: 'Film Soundtrack', genre: 'BOLLYWOOD', active: true, tags: [] },
      { userId: USER_ID, title: 'Dil Se Re', artist: 'AR Rahman', genre: 'BOLLYWOOD', active: true, tags: [] },
      { userId: USER_ID, title: 'White Christmas', artist: 'Bing Crosby', genre: 'CHRISTMAS', active: true, tags: ['classic'] },
      { userId: USER_ID, title: 'Have Yourself a Merry Little Christmas', artist: 'Traditional', genre: 'CHRISTMAS', active: true, tags: [] },
      { userId: USER_ID, title: 'The Christmas Song', artist: 'Nat King Cole', genre: 'CHRISTMAS', active: true, tags: ['classic'] },
      { userId: USER_ID, title: 'O Holy Night', artist: 'Traditional', genre: 'CHRISTMAS', active: true, tags: [] },
    ],
  });

  console.log('Seeding templates...');

  const [, , contractAndInvoiceTpl, invoiceCoverTpl, musicFormTpl, thankYouTpl] = await Promise.all([
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Quote',
        builtInType: 'quote',
        content: doc(
          'Dear {{customerName}},',
          "Thank you so much for getting in touch — it would be a privilege to perform at your event.",
          "My fee for {{bookingDate}} would be {{bookingFee}}. I'd love to discuss your requirements in more detail.",
          "Please don't hesitate to get in touch with any questions.",
          'Warm regards,\n{{musicianName}}',
        ),
      },
    }),
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Confirmation',
        builtInType: 'confirmation',
        content: doc(
          'Dear {{customerName}},',
          "I'm delighted to confirm your booking for {{bookingDate}}.",
          "Please find attached your contract for review. I've also included a deposit invoice — once both are sorted we'll be all set.",
          'Looking forward to being part of your special day.',
          'Warm regards,\n{{musicianName}}',
        ),
      },
    }),
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Contract & Invoice Cover Email',
        builtInType: 'contract_and_invoice_cover',
        content: doc(
          'Dear {{customerName}},',
          "I'm so pleased to confirm your booking for {{bookingDate}}.",
          'Please find your contract at the link below — once signed, we\'re officially booked in:\n\n{{portalLink}}',
          "I've also attached your deposit invoice ({{invoiceTotal}}, due {{invoiceDueDate}}). Once both are sorted we're all set.",
          "Please don't hesitate to get in touch with any questions.",
          'Warm regards,\n{{musicianName}}',
        ),
      },
    }),
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Invoice Cover Email',
        builtInType: 'invoice_cover',
        content: doc(
          'Dear {{customerName}},',
          'Please find attached your invoice for {{bookingDate}} ({{invoiceTotal}}, due {{invoiceDueDate}}).',
          "Payment details are included on the invoice. Please don't hesitate to get in touch with any questions.",
          'Warm regards,\n{{musicianName}}',
        ),
      },
    }),
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Music Request Form Invite',
        builtInType: 'music_form_invite',
        content: doc(
          'Dear {{customerName}},',
          "As your big day approaches, I'd love to start tailoring the music to make it truly personal.",
          'Please use the link below to let me know your song preferences and any special requests:\n\n{{portalLink}}',
          'Take your time — there are no wrong answers!',
          'Warm regards,\n{{musicianName}}',
        ),
      },
    }),
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Thank You',
        builtInType: 'thank_you',
        content: doc(
          'Dear {{customerName}},',
          'It was an absolute pleasure performing at your event on {{bookingDate}}. I hope it was everything you had hoped for.',
          'Thank you for choosing me to be part of your special day — it really meant a lot.',
          'With warmest wishes,\n{{musicianName}}',
        ),
      },
    }),
    prisma.template.create({
      data: {
        userId: USER_ID,
        name: 'Contract',
        builtInType: 'contract',
        content: {
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Performance Agreement' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'This agreement is between {{musicianName}} ("the Musician") and {{customerName}} ("the Client").' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Event Details' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Date: {{bookingDate}}' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Venue: {{venueName}}' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'Performance schedule: {{setsSchedule}}' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Fee' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'The agreed fee for this engagement is {{bookingFee}}.' }] },
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Terms & Conditions' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'A non-refundable deposit of 25% is required to secure the booking. The balance is due 30 days before the event date.' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'In the unlikely event that the Musician is unable to fulfil the booking due to serious illness or injury, a full refund will be issued.' }] },
            { type: 'paragraph', content: [{ type: 'text', text: 'The Client agrees to provide reasonable facilities for the Musician including adequate setup time, a safe performance space, and appropriate breaks for performances exceeding two hours.' }] },
          ],
        },
      },
    }),
  ]);

  console.log('Seeding performance formats...');

  const DEFAULT_GENRES = ['CONTEMPORARY', 'CLASSICAL', 'JAZZ', 'FILM_TV_MUSICALS'];
  const formatDefs = [
    { label: 'Wedding Ceremony',  category: 'WEDDING',    icon: 'heart',       keyMoments: ['Processional', 'Signing of the Register (Song 1)', 'Signing of the Register (Song 2)', 'Signing of the Register (Song 3)', 'Recessional'], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Ceremony', duration: 30, order: 1 }] },
    { label: 'Drinks Reception',  category: 'WEDDING',    icon: 'glass-water', keyMoments: [], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Drinks Reception', duration: 90, order: 1 }] },
    { label: 'Wedding Breakfast', category: 'WEDDING',    icon: 'utensils',    keyMoments: [], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Wedding Breakfast', duration: 90, order: 1 }] },
    { label: 'Evening Reception', category: 'WEDDING',    icon: 'moon',        keyMoments: ['First Dance'], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Evening Reception', duration: 45, order: 1 }, { label: 'Evening Reception', duration: 45, order: 2 }] },
    { label: 'Corporate Dinner',  category: 'CORPORATE',  icon: 'briefcase',   keyMoments: [], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Drinks', duration: 60, order: 1 }, { label: 'Dinner', duration: 90, order: 2 }] },
    { label: 'Background Music',  category: null,          icon: 'music',       keyMoments: [], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Background Music', duration: 60, order: 1 }] },
    { label: 'Solo Piano',        category: null,          icon: 'music-2',     keyMoments: [], defaultGenreSelection: DEFAULT_GENRES, slots: [{ label: 'Solo Piano', duration: 60, order: 1 }] },
  ];

  for (const fmt of formatDefs) {
    await prisma.performanceFormat.create({
      data: {
        userId: USER_ID,
        label: fmt.label,
        category: fmt.category ?? undefined,
        icon: fmt.icon,
        keyMoments: fmt.keyMoments,
        defaultGenreSelection: fmt.defaultGenreSelection,
        slots: { create: fmt.slots.map((s) => ({ ...s, userId: USER_ID })) },
        notes: null,
      },
    });
  }

  const allFormats = await prisma.performanceFormat.findMany({ where: { userId: USER_ID } });
  const fmt = Object.fromEntries(allFormats.map((f) => [f.label, f.id]));

  console.log('Seeding bookings...');

  // 1. ENQUIRY — Sophie & Daniel, no venue yet, nothing done
  const booking1 = await prisma.booking.create({
    data: {
      userId: USER_ID,
      status: 'ENQUIRY',
      eventType: 'WEDDING',
      date: new Date('2026-09-12T14:00:00'),
      fee: 1800,
      customerId: sophie.id,
      notes: 'Outdoor ceremony if weather permits. Will confirm venue by end of month.',
    },
  });
  await seedChecklist(booking1.id, booking1.date, booking1.createdAt, {
    bookingStatus: 'ENQUIRY',
    hasDepositInvoice: false,
    hasBalanceInvoice: false,
    hasContract: false,
    contractSigned: false,
    depositReceived: false,
    hasMusicFormResponse: false,
    commBuiltInTypes: [],
  });

  // 2. CONFIRMED — Emma & James at Barnsley House
  //    Contract & deposit invoice sent, neither signed/paid yet
  const booking2 = await prisma.booking.create({
    data: {
      userId: USER_ID,
      status: 'CONFIRMED',
      eventType: 'WEDDING',
      date: new Date('2026-08-23T13:00:00'),
      fee: 2200,
      customerId: emma.id,
      venueId: barnsleyHouse.id,
      referrerId: cellarSociety.id,
      notes: 'Ceremony 1pm, drinks reception 2–4pm, dinner from 6pm.',
    },
  });

  await prisma.performanceSet.createMany({
    data: [
      { userId: USER_ID, bookingId: booking2.id, order: 1, duration: 45, startTime: '13:00', label: 'Ceremony',         performanceFormatId: fmt['Wedding Ceremony'] },
      { userId: USER_ID, bookingId: booking2.id, order: 2, duration: 90, startTime: '14:00', label: 'Drinks Reception', performanceFormatId: fmt['Drinks Reception'] },
      { userId: USER_ID, bookingId: booking2.id, order: 3, duration: 60, startTime: '19:00', label: 'Dinner',           performanceFormatId: fmt['Wedding Breakfast'] },
    ],
  });
  await prisma.bookingPerformanceFormat.createMany({
    data: [
      { userId: USER_ID, bookingId: booking2.id, performanceFormatId: fmt['Wedding Ceremony'],  order: 1 },
      { userId: USER_ID, bookingId: booking2.id, performanceFormatId: fmt['Drinks Reception'],  order: 2 },
      { userId: USER_ID, bookingId: booking2.id, performanceFormatId: fmt['Wedding Breakfast'], order: 3 },
    ],
  });

  await prisma.invoice.create({
    data: {
      userId: USER_ID,
      bookingId: booking2.id,
      billToContactId: emma.id,
      status: 'SENT',
      isDeposit: true,
      issueDate: new Date('2026-05-10'),
      dueDate: new Date('2026-05-24'),
      lineItems: {
        create: [{ userId: USER_ID, description: 'Deposit — Wedding performance (25%)', amount: 550, order: 1 }],
      },
    },
  });

  await prisma.communication.create({
    data: {
      userId: USER_ID,
      bookingId: booking2.id,
      contactId: emma.id,
      templateId: contractAndInvoiceTpl.id,
      direction: 'OUTBOUND',
      channel: 'EMAIL',
      subject: 'Your booking confirmation & contract — Emma & James, 23 August 2026',
      body: '<p>Dear Emma & James,</p><p>I\'m so pleased to confirm your booking for 23 August 2026...</p>',
      sentAt: new Date('2026-05-10T10:30:00'),
    },
  });
  await seedChecklist(booking2.id, booking2.date, booking2.createdAt, {
    bookingStatus: 'CONFIRMED',
    hasDepositInvoice: true,
    hasBalanceInvoice: false,
    hasContract: false,
    contractSigned: false,
    depositReceived: false,
    hasMusicFormResponse: false,
    commBuiltInTypes: ['contract_and_invoice_cover'],
  });

  // 3. CONFIRMED — Charlotte & Oliver at St Mary's
  //    Contract signed, deposit paid, music form sent, awaiting song requests
  const booking3 = await prisma.booking.create({
    data: {
      userId: USER_ID,
      status: 'CONFIRMED',
      eventType: 'WEDDING',
      date: new Date('2026-07-05T12:00:00'),
      fee: 1500,
      customerId: charlotte.id,
      venueId: stMarys.id,
      depositReceivedAt: new Date('2026-04-22'),
      notes: 'Acoustic only. Wants Canon in D for the processional.',
    },
  });

  await prisma.performanceSet.createMany({
    data: [
      { userId: USER_ID, bookingId: booking3.id, order: 1, duration: 30, startTime: '11:30', label: 'Pre-ceremony', performanceFormatId: fmt['Wedding Ceremony'] },
      { userId: USER_ID, bookingId: booking3.id, order: 2, duration: 25, startTime: '12:00', label: 'Ceremony',     performanceFormatId: fmt['Wedding Ceremony'] },
    ],
  });
  await prisma.bookingPerformanceFormat.createMany({
    data: [
      { userId: USER_ID, bookingId: booking3.id, performanceFormatId: fmt['Wedding Ceremony'], order: 1 },
    ],
  });

  await prisma.contract.create({
    data: {
      userId: USER_ID,
      bookingId: booking3.id,
      status: 'SIGNED',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contract for Charlotte & Oliver.' }] }] },
      signedAt: new Date('2026-04-20T14:22:00'),
    },
  });

  await prisma.invoice.create({
    data: {
      userId: USER_ID,
      bookingId: booking3.id,
      billToContactId: charlotte.id,
      status: 'PAID',
      isDeposit: true,
      issueDate: new Date('2026-04-15'),
      dueDate: new Date('2026-04-29'),
      lineItems: {
        create: [{ userId: USER_ID, description: 'Deposit — Wedding ceremony performance (25%)', amount: 375, order: 1 }],
      },
    },
  });

  await prisma.musicFormConfig.create({
    data: {
      userId: USER_ID,
      bookingId: booking3.id,
      enabledGenres: ['CONTEMPORARY', 'CLASSICAL', 'JAZZ'],
      keyMoments: [
        { label: 'Processional', section: 'Ceremony' },
        { label: 'Signing of the Register (Song 1)', section: 'Signing of the Register' },
        { label: 'Signing of the Register (Song 2)', section: 'Signing of the Register' },
        { label: 'Signing of the Register (Song 3)', section: 'Signing of the Register' },
        { label: 'Recessional', section: 'Ceremony' },
      ],
    },
  });

  await prisma.communication.create({
    data: {
      userId: USER_ID,
      bookingId: booking3.id,
      contactId: charlotte.id,
      templateId: musicFormTpl.id,
      direction: 'OUTBOUND',
      channel: 'EMAIL',
      subject: 'Your music preferences — Charlotte & Oliver, 5 July 2026',
      body: "<p>Dear Charlotte & Oliver,</p><p>As your big day approaches, I'd love to start tailoring the music...</p>",
      sentAt: new Date('2026-05-01T09:15:00'),
    },
  });
  await seedChecklist(booking3.id, booking3.date, booking3.createdAt, {
    bookingStatus: 'CONFIRMED',
    hasDepositInvoice: true,
    hasBalanceInvoice: false,
    hasContract: true,
    contractSigned: true,
    depositReceived: true,
    hasMusicFormResponse: false,
    commBuiltInTypes: ['music_form_invite'],
  });

  // 4. INVOICED — Meridian Financial summer party at The Ned
  //    Contract signed, deposit paid, balance invoice sent
  const booking4 = await prisma.booking.create({
    data: {
      userId: USER_ID,
      status: 'CONFIRMED',
      eventType: 'CORPORATE',
      title: 'Meridian Summer Party 2026',
      date: new Date('2026-07-18T19:00:00'),
      fee: 1200,
      customerId: meridian.id,
      venueId: theNed.id,
      depositReceivedAt: new Date('2026-03-20'),
    },
  });

  await prisma.performanceSet.createMany({
    data: [
      { userId: USER_ID, bookingId: booking4.id, order: 1, duration: 60, startTime: '19:30', label: 'Drinks', performanceFormatId: fmt['Corporate Dinner'] },
      { userId: USER_ID, bookingId: booking4.id, order: 2, duration: 90, startTime: '21:00', label: 'Dinner', performanceFormatId: fmt['Corporate Dinner'] },
    ],
  });
  await prisma.bookingPerformanceFormat.createMany({
    data: [
      { userId: USER_ID, bookingId: booking4.id, performanceFormatId: fmt['Corporate Dinner'], order: 1 },
    ],
  });

  await prisma.contract.create({
    data: {
      userId: USER_ID,
      bookingId: booking4.id,
      status: 'SIGNED',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contract for Meridian Summer Party.' }] }] },
      signedAt: new Date('2026-03-15T11:00:00'),
    },
  });

  await prisma.invoice.create({
    data: {
      userId: USER_ID,
      bookingId: booking4.id,
      billToContactId: meridian.id,
      status: 'PAID',
      isDeposit: true,
      issueDate: new Date('2026-03-12'),
      dueDate: new Date('2026-03-26'),
      lineItems: {
        create: [{ userId: USER_ID, description: 'Deposit — Corporate event performance (25%)', amount: 300, order: 1 }],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      userId: USER_ID,
      bookingId: booking4.id,
      billToContactId: meridian.id,
      status: 'SENT',
      isDeposit: false,
      issueDate: new Date('2026-05-15'),
      dueDate: new Date('2026-06-18'),
      lineItems: {
        create: [
          { userId: USER_ID, description: 'Balance — Corporate event performance', amount: 900, order: 1 },
        ],
      },
    },
  });

  await prisma.communication.create({
    data: {
      userId: USER_ID,
      bookingId: booking4.id,
      contactId: meridian.id,
      templateId: invoiceCoverTpl.id,
      direction: 'OUTBOUND',
      channel: 'EMAIL',
      subject: 'Balance invoice — Meridian Summer Party, 18 July 2026',
      body: '<p>Dear Sarah,</p><p>Please find attached your balance invoice for the summer party...</p>',
      sentAt: new Date('2026-05-15T09:00:00'),
    },
  });
  await seedChecklist(booking4.id, booking4.date, booking4.createdAt, {
    bookingStatus: 'CONFIRMED',
    hasDepositInvoice: true,
    hasBalanceInvoice: true,
    hasContract: true,
    contractSigned: true,
    depositReceived: true,
    hasMusicFormResponse: false,
    commBuiltInTypes: ['invoice_cover'],
  });

  // 5. COMPLETED — past wedding, all wrapped up
  const booking5 = await prisma.booking.create({
    data: {
      userId: USER_ID,
      status: 'COMPLETE',
      eventType: 'WEDDING',
      date: new Date('2026-02-14T13:00:00'),
      fee: 1950,
      customerId: emma.id,
      venueId: barnsleyHouse.id,
      referrerId: cellarSociety.id,
      depositReceivedAt: new Date('2025-11-22'),
      notes: "Valentine's Day wedding. Went very well — great feedback from the couple.",
    },
  });

  await prisma.performanceSet.createMany({
    data: [
      { userId: USER_ID, bookingId: booking5.id, order: 1, duration: 30, startTime: '12:30', label: 'Pre-ceremony',    performanceFormatId: fmt['Wedding Ceremony'] },
      { userId: USER_ID, bookingId: booking5.id, order: 2, duration: 30, startTime: '13:00', label: 'Ceremony',        performanceFormatId: fmt['Wedding Ceremony'] },
      { userId: USER_ID, bookingId: booking5.id, order: 3, duration: 75, startTime: '14:30', label: 'Drinks Reception', performanceFormatId: fmt['Drinks Reception'] },
    ],
  });
  await prisma.bookingPerformanceFormat.createMany({
    data: [
      { userId: USER_ID, bookingId: booking5.id, performanceFormatId: fmt['Wedding Ceremony'], order: 1 },
      { userId: USER_ID, bookingId: booking5.id, performanceFormatId: fmt['Drinks Reception'], order: 2 },
    ],
  });

  await prisma.contract.create({
    data: {
      userId: USER_ID,
      bookingId: booking5.id,
      status: 'SIGNED',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: "Contract for Emma & Oliver's Valentine's Day Wedding." }] }] },
      signedAt: new Date('2025-11-20T15:40:00'),
    },
  });

  await prisma.invoice.create({
    data: {
      userId: USER_ID,
      bookingId: booking5.id,
      billToContactId: emma.id,
      status: 'PAID',
      isDeposit: true,
      issueDate: new Date('2025-11-21'),
      dueDate: new Date('2025-12-05'),
      lineItems: {
        create: [{ userId: USER_ID, description: 'Deposit — Wedding performance (25%)', amount: 487.5, order: 1 }],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      userId: USER_ID,
      bookingId: booking5.id,
      billToContactId: emma.id,
      status: 'PAID',
      isDeposit: false,
      issueDate: new Date('2026-01-10'),
      dueDate: new Date('2026-01-31'),
      lineItems: {
        create: [{ userId: USER_ID, description: 'Balance — Wedding performance', amount: 1462.5, order: 1 }],
      },
    },
  });

  await prisma.communication.create({
    data: {
      userId: USER_ID,
      bookingId: booking5.id,
      contactId: emma.id,
      templateId: thankYouTpl.id,
      direction: 'OUTBOUND',
      channel: 'EMAIL',
      subject: 'Thank you — Emma & James, 14 February 2026',
      body: "<p>Dear Emma & James,</p><p>It was an absolute pleasure performing at your wedding yesterday...</p>",
      sentAt: new Date('2026-02-15T10:00:00'),
    },
  });
  await seedChecklist(booking5.id, booking5.date, booking5.createdAt, {
    bookingStatus: 'COMPLETE',
    hasDepositInvoice: true,
    hasBalanceInvoice: true,
    hasContract: true,
    contractSigned: true,
    depositReceived: true,
    hasMusicFormResponse: false,
    commBuiltInTypes: ['thank_you'],
  });

  // 6. CANCELLED — Harrington Christmas party, fell through
  await prisma.booking.create({
    data: {
      userId: USER_ID,
      status: 'CANCELLED',
      eventType: 'CORPORATE',
      title: 'Harrington & Co Christmas Party 2025',
      date: new Date('2025-12-06T19:00:00'),
      fee: 1100,
      customerId: harrington.id,
      notes: 'Cancelled by client in October — venue fell through.',
    },
  });

  console.log('\n✓ Seed complete');
  console.log('  Contacts: 9');
  console.log('  Songs: 33');
  console.log('  Templates: 7 built-in');
  console.log('  Bookings: 6 (Enquiry, Confirmed ×2, Invoiced, Completed, Cancelled)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
