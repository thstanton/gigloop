import { describe, it, expect } from 'vitest';
import { invoiceOwnerRoute, type InvoiceAction } from './invoiceActionRouting';

const bookingInvoice = { bookingId: 'b1', seriesId: null };
const seriesInvoice = { bookingId: null, seriesId: 's1' };
const ALL_ACTIONS: InvoiceAction[] = ['issue', 'markSent', 'markPaid', 'void', 'delete'];

describe('invoiceOwnerRoute', () => {
  describe('booking invoice', () => {
    it('routes to the booking invoices endpoint', () => {
      expect(invoiceOwnerRoute(bookingInvoice, 'issue').prefix).toBe('/bookings/b1/invoices');
    });

    it('invalidates invoices, documents and checklist on issue', () => {
      expect(invoiceOwnerRoute(bookingInvoice, 'issue').keys).toEqual([
        ['bookingInvoices', 'b1'],
        ['bookingDocuments', 'b1'],
        ['bookingChecklist', 'b1'],
      ]);
    });

    it('invalidates invoices, booking and checklist on markPaid', () => {
      expect(invoiceOwnerRoute(bookingInvoice, 'markPaid').keys).toEqual([
        ['bookingInvoices', 'b1'],
        ['booking', 'b1'],
        ['bookingChecklist', 'b1'],
      ]);
    });

    it('invalidates invoices and checklist on void and markSent', () => {
      const expected = [['bookingInvoices', 'b1'], ['bookingChecklist', 'b1']];
      expect(invoiceOwnerRoute(bookingInvoice, 'void').keys).toEqual(expected);
      expect(invoiceOwnerRoute(bookingInvoice, 'markSent').keys).toEqual(expected);
    });

    it('invalidates only the invoices list on delete', () => {
      expect(invoiceOwnerRoute(bookingInvoice, 'delete').keys).toEqual([['bookingInvoices', 'b1']]);
    });
  });

  describe('series invoice', () => {
    it('routes to the series invoices endpoint', () => {
      expect(invoiceOwnerRoute(seriesInvoice, 'void').prefix).toBe('/series/s1/invoices');
    });

    it('invalidates only the series invoice cache for every action', () => {
      for (const action of ALL_ACTIONS) {
        expect(invoiceOwnerRoute(seriesInvoice, action).keys).toEqual([['seriesInvoice', 's1']]);
      }
    });
  });
});
