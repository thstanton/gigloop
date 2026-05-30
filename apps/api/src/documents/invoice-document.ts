import type { TDocumentDefinitions, Content } from 'pdfmake/interfaces';

export interface InvoiceLineItemData {
  description: string;
  amount: string;
}

export interface InvoicePdfData {
  businessName: string;
  musicianName: string;
  email: string;
  address: string | null;
  bankDetails: string | null;
  vatNumber: string | null;
  vatRate: number | null;
  logoUrl: string | null;

  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  isDeposit: boolean;

  clientName: string;
  lineItems: InvoiceLineItemData[];
  depositTotal: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(amount: string): string {
  const n = parseFloat(amount);
  return isNaN(n) ? amount : `£${n.toFixed(2)}`;
}

function sumLineItems(items: InvoiceLineItemData[]): number {
  return items.reduce((sum, i) => sum + parseFloat(i.amount || '0'), 0);
}

function metaRow(label: string, value: string): Content {
  return {
    columns: [
      { text: label, style: 'metaLabel', width: 72 },
      { text: value, alignment: 'right', width: 80 },
    ],
    columnGap: 0,
    margin: [0, 0, 0, 2],
  };
}

// ─── Document definition ──────────────────────────────────────────────────────

export function buildInvoiceDefinition(data: InvoicePdfData): TDocumentDefinitions {
  const subtotal = sumLineItems(data.lineItems);
  const depositAmount = data.depositTotal ? parseFloat(data.depositTotal) : null;
  const balanceDue = depositAmount !== null ? subtotal - depositAmount : subtotal;
  const showDepositDeduction = !data.isDeposit && depositAmount !== null;
  const invoiceTypeLabel = data.isDeposit ? 'Deposit Invoice' : 'Invoice';

  const addressLines: Content[] = (data.address ?? '').split('\n').filter(Boolean).map((line) => ({
    text: line,
    style: 'muted',
  }));

  // ── Header ────────────────────────────────────────────────────────────────
  const businessInfoStack: Content[] = [
    ...(data.logoUrl ? [{ text: data.businessName, style: 'businessNameRight' as string }] : []),
    ...(data.email ? [{ text: data.email, style: 'muted' as string }] : []),
    ...addressLines,
    ...(data.vatNumber ? [{ text: `VAT: ${data.vatNumber}`, style: 'muted' as string }] : []),
  ];

  const headerLeft: Content = data.logoUrl
    ? { image: data.logoUrl, width: 120, fit: [120, 40] }
    : { text: data.businessName, style: 'businessNameLeft' };

  // ── Meta rows ─────────────────────────────────────────────────────────────
  const metaRows: Content[] = [
    metaRow('Number', data.invoiceNumber),
    metaRow('Issue date', data.issueDate),
    ...(data.dueDate ? [metaRow('Due date', data.dueDate)] : []),
  ];

  // ── Line items table body ─────────────────────────────────────────────────
  const tableBody: Content[][] = [
    [
      { text: 'Description', style: 'tableHeader' },
      { text: 'Amount', style: 'tableHeader', alignment: 'right' },
    ],
    ...data.lineItems.map((item) => [
      { text: item.description },
      { text: formatCurrency(item.amount), alignment: 'right' as const },
    ]),
  ];

  // ── Totals ────────────────────────────────────────────────────────────────
  const vatAmount = data.vatRate !== null ? (subtotal * data.vatRate) / 100 : 0;
  const showVat = data.vatRate !== null;
  const separator: Content = { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], alignment: 'right', margin: [0, 0, 0, 4] };

  function totalRow(label: string, value: string, style?: string): Content {
    return {
      columns: [
        { text: label, style: style ?? 'totalLabel', width: '*', alignment: 'right' },
        { text: value, style: style, width: 80, alignment: 'right' },
      ],
      margin: [0, 0, 0, 3],
    };
  }

  const totalsContent: Content[] = showDepositDeduction
    ? [
        totalRow('Subtotal', formatCurrency(subtotal.toFixed(2))),
        totalRow('Less deposit', `-${formatCurrency(depositAmount!.toFixed(2))}`),
        separator,
        ...(showVat
          ? [
              totalRow('Balance', formatCurrency(balanceDue.toFixed(2))),
              totalRow(`VAT @ ${data.vatRate}%`, formatCurrency(vatAmount.toFixed(2))),
              separator,
              totalRow('Total inc. VAT', formatCurrency((balanceDue + vatAmount).toFixed(2)), 'totalDueValue') as Content,
            ]
          : [totalRow('Balance due', formatCurrency(balanceDue.toFixed(2)), 'totalDueValue') as Content]),
      ]
    : [
        separator,
        ...(showVat
          ? [
              totalRow('Subtotal', formatCurrency(subtotal.toFixed(2))),
              totalRow(`VAT @ ${data.vatRate}%`, formatCurrency(vatAmount.toFixed(2))),
              separator,
              totalRow('Total inc. VAT', formatCurrency((subtotal + vatAmount).toFixed(2)), 'totalDueValue') as Content,
            ]
          : [totalRow('Total due', formatCurrency(subtotal.toFixed(2)), 'totalDueValue') as Content]),
      ];

  // ── Payment details ───────────────────────────────────────────────────────
  const paymentContent: Content[] = data.bankDetails
    ? [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], margin: [0, 16, 0, 12] },
        { text: 'Payment details', style: 'sectionLabel', margin: [0, 0, 0, 4] },
        ...data.bankDetails.split('\n').map((line): Content => ({ text: line, style: 'paymentText' })),
        {
          text: `Please use invoice number ${data.invoiceNumber} as your payment reference.`,
          style: 'paymentText',
          margin: [0, 4, 0, 0],
        },
      ]
    : [];

  // ── Document ──────────────────────────────────────────────────────────────
  return {
    pageSize: 'A4',
    pageMargins: [54, 48, 54, 60],
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1a1a1a' },

    content: [
      // Header
      {
        columns: [
          headerLeft,
          { stack: businessInfoStack, alignment: 'right' },
        ],
        margin: [0, 0, 0, 36],
      },

      // Title + meta
      {
        columns: [
          { text: invoiceTypeLabel, style: 'title' },
          { stack: metaRows, alignment: 'right' },
        ],
        margin: [0, 0, 0, 12],
      },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 487, y2: 0, lineWidth: 0.5, lineColor: '#e5e5e5' }], margin: [0, 0, 0, 20] },

      // Bill to
      { text: 'Bill to', style: 'sectionLabel', margin: [0, 0, 0, 4] },
      { text: data.clientName, style: 'clientName', margin: [0, 0, 0, 24] },

      // Line items
      {
        table: {
          widths: ['*', 80],
          headerRows: 1,
          body: tableBody,
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0,
          hLineColor: (i: number) => (i <= 1 ? '#e5e5e5' : '#f0f0f0'),
          fillColor: (i: number) => (i === 0 ? '#f5f5f5' : null),
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      // Totals
      ...totalsContent,

      // Payment details
      ...paymentContent,
    ],

    styles: {
      title: { fontSize: 22, bold: true },
      businessNameLeft: { fontSize: 14, bold: true },
      businessNameRight: { fontSize: 12, bold: true, margin: [0, 0, 0, 2] },
      muted: { color: '#666666' },
      metaLabel: { color: '#666666' },
      sectionLabel: { fontSize: 8, bold: true, color: '#888888', characterSpacing: 0.8 },
      clientName: { fontSize: 11, bold: true },
      tableHeader: { fontSize: 8, bold: true, color: '#888888', characterSpacing: 0.6 },
      totalLabel: { color: '#666666' },
      totalDueLabel: { bold: true },
      totalDueValue: { bold: true, fontSize: 11 },
      paymentText: { color: '#444444', lineHeight: 1.4 },
    },
  };
}
