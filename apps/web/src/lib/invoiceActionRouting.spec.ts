import { describe, it, expect } from 'vitest';
import { invoiceOwnerRoute, type InvoiceAction } from './invoiceActionRouting';

const bookingInvoice = { bookingId: 'b1', seriesId: null };
const seriesInvoice = { bookingId: null, seriesId: 's1' };
const ALL_ACTIONS: InvoiceAction[] = ['issue', 'markSent', 'markPaid', 'void', 'delete'];

describe('invoiceOwnerRoute', () => {
  describe('booking invoice', () => {
    it('routes to the owner-agnostic invoices endpoint', () => {
      expect(invoiceOwnerRoute(bookingInvoice, 'issue').prefix).toBe('/invoices');
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
    it('routes to the same owner-agnostic invoices endpoint as a booking invoice', () => {
      expect(invoiceOwnerRoute(seriesInvoice, 'void').prefix).toBe('/invoices');
    });

    // #830: the stored-document key mirrors the booking side's `bookingDocuments` on issue —
    // issuing creates the PDF (Download appears), voiding/deleting retires it. Without this the
    // Download action's arrival depends solely on the document query's enabled-gate flipping.
    it('invalidates the series invoice and its stored-document cache for every action', () => {
      for (const action of ALL_ACTIONS) {
        expect(invoiceOwnerRoute(seriesInvoice, action).keys).toEqual([
          ['seriesInvoice', 's1'],
          ['seriesInvoiceDocument', 's1'],
        ]);
      }
    });
  });
});
