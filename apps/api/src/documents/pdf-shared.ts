import type { Content } from 'pdfmake/interfaces';

export interface PdfHeaderData {
  logoUrl?: string | null;
  businessName: string;
  email?: string | null;
  phone?: string | null;
}

export function buildPdfHeader(data: PdfHeaderData, brandColour: string): Content[] {
  const headerLeft: Content = data.logoUrl
    ? { image: data.logoUrl, width: 120, fit: [120, 40] }
    : { text: data.businessName, style: 'headerBusinessName' };

  const businessInfoStack: Content[] = [
    ...(data.businessName && !data.logoUrl ? [{ text: data.businessName, style: 'headerBusinessName' }] : []),
    ...(data.email ? [{ text: data.email, style: 'headerMuted' }] : []),
    ...(data.phone ? [{ text: data.phone, style: 'headerMuted' }] : []),
  ];

  return [
    {
      columns: [
        headerLeft,
        { stack: businessInfoStack, alignment: 'right' },
      ],
      margin: [0, 0, 0, 12],
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 487,
          y2: 0,
          lineWidth: 0.5,
          lineColor: brandColour,
        },
      ],
      margin: [0, 0, 0, 20],
    },
  ];
}

export function buildPdfFooter(): (currentPage: number, pageCount: number) => Content {
  return () => ({
    text: 'Powered by GigMan',
    alignment: 'center',
    fontSize: 8,
    color: '#999999',
    margin: [0, 0, 0, 0],
  });
}

export function buildDocumentTitle(title: string): Content {
  return {
    text: title,
    font: 'PlayfairDisplay',
    fontSize: 28,
    color: '#1a1a1a',
    margin: [0, 12, 0, 20],
  };
}
