import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { http, HttpResponse } from 'msw';
import { ChecklistDefaultsConfigurator } from './ChecklistDefaultsConfigurator';
import type { ChecklistDefaultItem, ChecklistDefaultStep, UserProfile } from '@/types/api';

function step(o: Partial<ChecklistDefaultStep> & { key: string; label: string }): ChecklistDefaultStep {
  return { kind: 'MILESTONE', completeMode: 'ACTION', completedBy: 'USER', autoCompleteRule: null, ...o };
}

// A multi-step goal (deposit billing) that gates CONFIRMED, so it groups into the Provisional card and
// shows a read-only steps disclosure; an atomic goal (add venue, READY → Confirmed card); and a
// stage-less custom reminder that lives in the Anytime card as a plain todo.
const DEFAULTS: ChecklistDefaultItem[] = [
  {
    key: 'get_deposit_paid',
    label: 'Get the deposit paid',
    completedBy: 'USER',
    autoCompleteRule: null,
    requiredForStatus: 'CONFIRMED',
    dueDateRule: { basis: 'bookingDate', offsetDays: -30 },
    steps: [
      step({ key: 'set_fee_deposit', label: 'Set the booking fee', kind: 'PRECONDITION' }),
      step({ key: 'add_email_deposit', label: "Add the client's email", kind: 'PRECONDITION' }),
      step({ key: 'create_deposit_invoice', label: 'Create deposit invoice' }),
      step({ key: 'deposit_received', label: 'Deposit received', completeMode: 'AWAITED' }),
    ],
  },
  {
    key: 'add_venue',
    label: 'Add venue',
    completedBy: 'USER',
    autoCompleteRule: { type: 'completeness', concern: 'venue' },
    requiredForStatus: 'READY',
    dueDateRule: null,
  },
  {
    key: null,
    label: 'Confirm parking with the venue',
    completedBy: 'USER',
    autoCompleteRule: null,
    requiredForStatus: null,
    dueDateRule: null,
    concern: 'venue',
  },
];

function makeProfile(defaults: ChecklistDefaultItem[]): UserProfile {
  return {
    id: 'u1',
    createdAt: '2030-01-01T00:00:00Z',
    updatedAt: '2030-01-01T00:00:00Z',
    addressLine1: null,
    addressLine2: null,
    city: null,
    county: null,
    postcode: null,
    country: null,
    latitude: null,
    longitude: null,
    placeId: null,
    bankDetails: null,
    vatNumber: null,
    vatRate: 0,
    defaultPaymentTermsDays: 14,
    invoiceNumberSequence: 1,
    invoiceSequenceYear: 2030,
    depositPercentage: null,
    digestEmailEnabled: true,
    songRequestFormEnabled: true,
    preferences: { checklistDefaults: defaults },
    onboardingCompletedAt: '2030-01-01T00:00:00Z',
  };
}

const meta = {
  component: ChecklistDefaultsConfigurator,
  tags: ['ai-generated'],
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/me/preferences/checklist-defaults', () =>
          HttpResponse.json(makeProfile(DEFAULTS)),
        ),
      ],
    },
  },
  args: {
    profile: makeProfile(DEFAULTS),
    songFormEnabled: true,
  },
} satisfies Meta<typeof ChecklistDefaultsConfigurator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// The primary path (ADR-0024 feature interaction): a multi-step goal reveals its read-only steps, a
// goal toggles off, and a custom item renders as a plain todo in the Anytime card.
export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Multi-step goal is present with its plain-English summary.
    await expect(await canvas.findByText('Get the deposit paid')).toBeVisible();

    // Reveal its read-only steps on disclosure — a milestone step becomes visible.
    const disclosure = await canvas.findByRole('button', { name: /Steps \(4\)/ });
    await userEvent.click(disclosure);
    await expect(await canvas.findByText('Create deposit invoice')).toBeVisible();
    await expect(canvas.getByText('Deposit received')).toBeVisible();

    // Toggle the goal off — the switch's accessible state flips to disabled.
    const toggle = canvas.getByRole('switch', { name: 'Get the deposit paid: enabled' });
    await userEvent.click(toggle);
    await expect(canvas.getByRole('switch', { name: 'Get the deposit paid: disabled' })).toBeVisible();

    // A custom item renders as a plain todo with its "Custom" tag — no step machinery.
    await expect(canvas.getByText('Confirm parking with the venue')).toBeVisible();
    await expect(canvas.getByText('Custom')).toBeVisible();
  },
};
