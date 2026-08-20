import { describe, it, expect } from 'vitest';
import {
  BOOKING_STATUS_LABELS,
  CREATABLE_BOOKING_STATUSES,
  FORWARD_STATUSES,
  INVOICE_OVERDUE_TOKENS,
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_ORDER,
  INVOICE_STATUS_TOKENS,
  STATUS_ACCENT_BG,
  STATUS_DESCRIPTIONS,
  STATUS_ORDER,
  STATUS_TOKENS,
  statusBefore,
  statusGte,
} from './constants';
import type { BookingStatus } from '@/types/api';

// Shape, never values (CLAUDE.md: one declaration per vocabulary). Asserting that
// ENQUIRY's label is 'Enquiry' would make this file a second declaration of the
// vocabulary — the exact drift the table exists to prevent — and it would fail on
// every legitimate copy edit. What the type system CANNOT see is a fat-fingered
// Tailwind token: 'bg-status-readyy' is a perfectly good string that silently renders
// an unstyled pill. That is what these tests are for.

const TOKEN_PATTERN = /^(bg|text|border-l)-status-[a-z]+(\/\d+)?$/;

describe('booking status table', () => {
  it('covers every status exactly once, in lifecycle order', () => {
    expect(STATUS_ORDER).toHaveLength(6);
    expect(new Set(STATUS_ORDER).size).toBe(STATUS_ORDER.length);
    // CANCELLED is the off-ramp, not a sixth forward stage — it must sit last, or
    // FORWARD_STATUSES and every statusGte comparison shift under it.
    expect(STATUS_ORDER[STATUS_ORDER.length - 1]).toBe('CANCELLED');
  });

  it.each([
    ['labels', BOOKING_STATUS_LABELS],
    ['descriptions', STATUS_DESCRIPTIONS],
    ['accent backgrounds', STATUS_ACCENT_BG],
  ])('derives a total, non-empty map of %s', (_name, map) => {
    expect(Object.keys(map)).toHaveLength(STATUS_ORDER.length);
    for (const status of STATUS_ORDER) {
      expect(map[status]?.trim()).toBeTruthy();
    }
  });

  it('derives colour tokens that Tailwind can actually see', () => {
    for (const status of STATUS_ORDER) {
      const tokens = STATUS_TOKENS[status];
      expect(Object.values(tokens)).toHaveLength(4);
      for (const token of Object.values(tokens)) {
        expect(token).toMatch(TOKEN_PATTERN);
      }
      // All four tokens are the same colour stem — a copy/paste slip between rows
      // (READY's row carrying CONFIRMED's tint) passes the pattern but not this.
      const stems = Object.values(tokens).map((t) => t.replace(/^(bg|text|border-l)-/, '').split('/')[0]);
      expect(new Set(stems).size).toBe(1);
    }
    expect(STATUS_TOKENS[STATUS_ORDER[0]].accent).toBe(STATUS_ACCENT_BG[STATUS_ORDER[0]]);
  });

  // The other invisible-token failure mode, and the one that shipped: an opacity modifier
  // outside Tailwind's scale (multiples of 5). `bg-status-ready/12` is a well-formed string
  // that matches TOKEN_PATTERN and type-checks, but Tailwind generates no utility for it at
  // all — so the tint is silently absent rather than merely wrong. Guards this table only;
  // a `/12` hand-written into a component is out of its reach. (#752)
  it('derives tints whose opacity modifier is in Tailwind’s scale', () => {
    for (const status of STATUS_ORDER) {
      for (const token of Object.values(STATUS_TOKENS[status])) {
        const [, modifier] = token.split('/');
        if (modifier === undefined) continue;
        expect(Number(modifier) % 5, `${token} is off Tailwind’s opacity scale`).toBe(0);
      }
    }
  });

  it('derives forward and creatable lists from the table, not by hand', () => {
    expect(FORWARD_STATUSES).not.toContain('CANCELLED');
    expect(FORWARD_STATUSES).toHaveLength(STATUS_ORDER.length - 1);
    expect(CREATABLE_BOOKING_STATUSES).not.toContain('CANCELLED');
    // Every creatable status must be a real, forward one — the two lists are allowed to
    // diverge (a future forward-but-not-creatable stage), but never to invent a member.
    for (const status of CREATABLE_BOOKING_STATUSES) {
      expect(FORWARD_STATUSES).toContain(status);
    }
  });
});

describe('lifecycle comparisons', () => {
  it('orders every status against every other by table position', () => {
    STATUS_ORDER.forEach((a, i) => {
      STATUS_ORDER.forEach((b, j) => {
        expect(statusGte(a, b)).toBe(i >= j);
      });
    });
  });

  it('walks back one forward stage, stopping at the first', () => {
    expect(statusBefore(FORWARD_STATUSES[0])).toBeNull();
    FORWARD_STATUSES.slice(1).forEach((status, i) => {
      expect(statusBefore(status)).toBe(FORWARD_STATUSES[i]);
    });
  });

  it('reports no preceding stage for the off-ramp', () => {
    // CANCELLED is absent from FORWARD_STATUSES, so indexOf is -1. Guarding this
    // pins the behaviour rather than leaving it to indexOf's fallback.
    expect(statusBefore('CANCELLED' as BookingStatus)).toBeNull();
  });
});

// Shape, never values — same rationale as the booking status table above. VOID sits
// off the `status-<slug>` stem (bg-muted/text-muted/border-l-muted), so the pattern
// here also accepts a bare `muted` stem.
const INVOICE_TOKEN_PATTERN = /^(bg|text|border-l)-(status-[a-z]+|muted)(\/\d+)?$/;

describe('invoice status table', () => {
  it('covers every status exactly once', () => {
    expect(INVOICE_STATUS_ORDER).toHaveLength(5);
    expect(new Set(INVOICE_STATUS_ORDER).size).toBe(INVOICE_STATUS_ORDER.length);
  });

  it('derives a total, non-empty map of labels', () => {
    expect(Object.keys(INVOICE_STATUS_LABELS)).toHaveLength(INVOICE_STATUS_ORDER.length);
    for (const status of INVOICE_STATUS_ORDER) {
      expect(INVOICE_STATUS_LABELS[status]?.trim()).toBeTruthy();
    }
  });

  it('derives colour tokens that Tailwind can actually see', () => {
    for (const status of INVOICE_STATUS_ORDER) {
      const tokens = INVOICE_STATUS_TOKENS[status];
      expect(Object.values(tokens)).toHaveLength(3);
      for (const token of Object.values(tokens)) {
        expect(token).toMatch(INVOICE_TOKEN_PATTERN);
      }
      // All three tokens share the same colour stem — a copy/paste slip between rows
      // passes the pattern but not this.
      const stems = Object.values(tokens).map((t) => t.replace(/^(bg|text|border-l)-/, '').split('/')[0]);
      expect(new Set(stems).size).toBe(1);
    }
  });

  it('derives tints whose opacity modifier is in Tailwind’s scale', () => {
    for (const status of INVOICE_STATUS_ORDER) {
      for (const token of Object.values(INVOICE_STATUS_TOKENS[status])) {
        const [, modifier] = token.split('/');
        if (modifier === undefined) continue;
        expect(Number(modifier) % 5, `${token} is off Tailwind’s opacity scale`).toBe(0);
      }
    }
  });

  // OVERDUE is not an InvoiceStatus, so it cannot live in the coverage-guarded table
  // (InvoiceStatusRow.value only accepts real union members — this is enforced by the
  // type system, not this test). It gets its own named tokens instead.
  it('gives the overdue override its own valid, non-empty tokens', () => {
    expect(INVOICE_OVERDUE_TOKENS.label.trim()).toBeTruthy();
    const tokens = [INVOICE_OVERDUE_TOKENS.tint, INVOICE_OVERDUE_TOKENS.text, INVOICE_OVERDUE_TOKENS.borderL];
    for (const token of tokens) {
      expect(token).toMatch(INVOICE_TOKEN_PATTERN);
    }
    const stems = tokens.map((t) => t.replace(/^(bg|text|border-l)-/, '').split('/')[0]);
    expect(new Set(stems).size).toBe(1);
  });
});
