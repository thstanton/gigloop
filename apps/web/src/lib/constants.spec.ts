import { describe, it, expect } from 'vitest';
import {
  BOOKING_STATUS_LABELS,
  CREATABLE_BOOKING_STATUSES,
  FORWARD_STATUSES,
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
