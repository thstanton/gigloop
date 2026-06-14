import { describe, it, expect } from 'vitest';
import { resolveListScope, ACTIVE_PIPELINE_STATUSES } from './bookingScope';

describe('resolveListScope', () => {
  describe('resting state (no tab, no search)', () => {
    it('returns the active pipeline statuses', () => {
      const { effectiveStatuses } = resolveListScope({});
      expect(effectiveStatuses).toEqual(ACTIVE_PIPELINE_STATUSES);
    });

    it('highlights the Active tab', () => {
      const { highlightedTab } = resolveListScope({});
      expect(highlightedTab).toBe('ACTIVE');
    });

    it('treats an empty q as resting (no search)', () => {
      const { highlightedTab } = resolveListScope({ q: '' });
      expect(highlightedTab).toBe('ACTIVE');
    });

    it('treats a single-character q as resting (below the 2-char threshold)', () => {
      const { highlightedTab } = resolveListScope({ q: 'a' });
      expect(highlightedTab).toBe('ACTIVE');
    });
  });

  describe('explicit status tab selected', () => {
    it('constrains to ENQUIRY and highlights it', () => {
      const scope = resolveListScope({ tab: 'ENQUIRY' });
      expect(scope.effectiveStatuses).toEqual(['ENQUIRY']);
      expect(scope.highlightedTab).toBe('ENQUIRY');
    });

    it('constrains to PROVISIONAL and highlights it', () => {
      const scope = resolveListScope({ tab: 'PROVISIONAL' });
      expect(scope.effectiveStatuses).toEqual(['PROVISIONAL']);
      expect(scope.highlightedTab).toBe('PROVISIONAL');
    });

    it('constrains to CONFIRMED and highlights it', () => {
      const scope = resolveListScope({ tab: 'CONFIRMED' });
      expect(scope.effectiveStatuses).toEqual(['CONFIRMED']);
      expect(scope.highlightedTab).toBe('CONFIRMED');
    });

    it('constrains to READY and highlights it', () => {
      const scope = resolveListScope({ tab: 'READY' });
      expect(scope.effectiveStatuses).toEqual(['READY']);
      expect(scope.highlightedTab).toBe('READY');
    });

    it('constrains to COMPLETE and highlights it', () => {
      const scope = resolveListScope({ tab: 'COMPLETE' });
      expect(scope.effectiveStatuses).toEqual(['COMPLETE']);
      expect(scope.highlightedTab).toBe('COMPLETE');
    });

    it('constrains to CANCELLED and highlights it', () => {
      const scope = resolveListScope({ tab: 'CANCELLED' });
      expect(scope.effectiveStatuses).toEqual(['CANCELLED']);
      expect(scope.highlightedTab).toBe('CANCELLED');
    });

    it('ignores search when an explicit tab is selected (explicit tab wins)', () => {
      // Searching from a status tab keeps that tab's constraint — no lift
      const scope = resolveListScope({ tab: 'COMPLETE', q: 'smith wedding' });
      expect(scope.effectiveStatuses).toEqual(['COMPLETE']);
      expect(scope.highlightedTab).toBe('COMPLETE');
    });
  });

  describe('lift-to-all-statuses branch (search active, no explicit tab)', () => {
    it('lifts to all statuses (empty array) when search is active', () => {
      const { effectiveStatuses } = resolveListScope({ q: 'smith' });
      expect(effectiveStatuses).toEqual([]);
    });

    it('clears the highlighted tab when lifted', () => {
      const { highlightedTab } = resolveListScope({ q: 'smith' });
      expect(highlightedTab).toBeNull();
    });

    it('lifts when query has multiple tokens', () => {
      const { effectiveStatuses, highlightedTab } = resolveListScope({ q: 'smith wedding' });
      expect(effectiveStatuses).toEqual([]);
      expect(highlightedTab).toBeNull();
    });

    it('lifts when query is exactly 2 characters', () => {
      const { highlightedTab } = resolveListScope({ q: 'ab' });
      expect(highlightedTab).toBeNull();
    });

    it('does not lift for whitespace-only query', () => {
      const { highlightedTab } = resolveListScope({ q: '  ' });
      expect(highlightedTab).toBe('ACTIVE');
    });
  });
});
