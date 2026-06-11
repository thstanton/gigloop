import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { DocumentList } from '@/features/bookings/DocumentList';
import type { Document, Invoice } from '@/types/api';

interface Props {
  bookingId: string;
}

export function DocumentsCard({ bookingId }: Props) {
  const { data: documents = [] } = useQuery({
    queryKey: ['bookingDocuments', bookingId],
    queryFn: () => apiGet<Document[]>(`/bookings/${bookingId}/documents`),
    enabled: !!bookingId,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['bookingInvoices', bookingId],
    queryFn: () => apiGet<Invoice[]>(`/bookings/${bookingId}/invoices`),
    enabled: !!bookingId,
  });

  return (
    <Card title="Documents">
      <DocumentList documents={documents} invoices={invoices} />
    </Card>
  );
}
