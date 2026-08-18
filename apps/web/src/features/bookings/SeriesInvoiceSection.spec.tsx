import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SeriesInvoiceSection, type SeriesInvoiceSectionProps } from './InvoiceSection';
import type { Invoice } from '@/types/api';

// #830 regression guard.
//
// SeriesInvoiceSection used to hard-code `pdfUrl={null}` and `onPreview: () => {}`. The PDF was
// generated, stored and emailed to the client at issue time, but InvoiceRow gates every download
// on `if (pdfUrl)` — so the musician was never offered one, and "Preview draft" was a button that
// did nothing. These tests fail if either literal comes back.
//
// The actions live behind RowActions. jsdom applies no Tailwind, so the `md:hidden` mobile
// trigger is clickable here; it opens the Sheet, which portals into document.body — hence
// `screen` rather than a container-scoped query.

function seriesInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv1',
    status: 'ISSUED',
    isDeposit: false,
    invoiceNumber: 'INV-2026-001',
    issueDate: '2030-04-01',
    dueDate: '2030-05-01',
    paidAt: null,
    bookingId: null,
    seriesId: 'ser1',
    lineItems: [{ id: 'li1', description: 'May residency', amount: '1500.00', order: 0, sourceBookingId: 'b1' }],
    ...overrides,
  } as unknown as Invoice;
}

function renderSection(overrides: Partial<SeriesInvoiceSectionProps> = {}) {
  const props: SeriesInvoiceSectionProps = {
    seriesLabel: 'Hotel X — May 2026',
    invoice: seriesInvoice(),
    isLoading: false,
    pdfUrl: '/documents/doc1/download',
    onCreateInvoice: vi.fn(),
    onEdit: vi.fn(),
    onPreview: vi.fn(),
    onIssue: vi.fn(),
    onDelete: vi.fn(),
    onSend: vi.fn(),
    onMarkSent: vi.fn(),
    onMarkPaid: vi.fn(),
    onEditPayment: vi.fn(),
    onVoid: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <SeriesInvoiceSection {...props} />
    </MemoryRouter>,
  );
  return props;
}

async function openActions() {
  await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
}

describe('SeriesInvoiceSection PDF access (#830)', () => {
  it('offers Download for an ISSUED series invoice that has a stored PDF', async () => {
    renderSection({ invoice: seriesInvoice({ status: 'ISSUED' }) });
    await openActions();

    expect(await screen.findByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('offers Download for a PAID series invoice', async () => {
    renderSection({ invoice: seriesInvoice({ status: 'PAID', paidAt: '2030-05-02' }) });
    await openActions();

    expect(await screen.findByRole('button', { name: /download/i })).toBeInTheDocument();
  });

  it('withholds Download when no stored PDF exists yet', async () => {
    renderSection({ invoice: seriesInvoice({ status: 'ISSUED' }), pdfUrl: null });
    await openActions();

    // The sheet is open — Void proves it — but Download is absent, which is correct only
    // because there is genuinely no artifact to download.
    expect(await screen.findByRole('button', { name: /void/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
  });

  it('wires Preview draft to onPreview for a DRAFT', async () => {
    const invoice = seriesInvoice({ status: 'DRAFT', invoiceNumber: null, issueDate: null, dueDate: null });
    // A draft has no stored PDF — preview regenerates it, which is the whole point of the hook.
    const props = renderSection({ invoice, pdfUrl: null });
    await openActions();

    await userEvent.click(await screen.findByRole('button', { name: /preview draft/i }));

    expect(props.onPreview).toHaveBeenCalledWith(invoice);
  });
});
