import { useState } from 'react';
import { Upload } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api';
import { Card } from '@/components/common/Card';
import { GhostButton } from '@/components/common/GhostButton';
import { DocumentList } from '@/features/bookings/DocumentList';
import { UploadDocumentSheet } from '@/features/bookings/UploadDocumentSheet';
import type { Document, Invoice } from '@/types/api';


interface Props {
  bookingId: string;
}

export function DocumentsCard({ bookingId }: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);

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
    <>
      <Card
        title="Documents"
        action={
          <GhostButton variant="primary" size="xs" icon={<Upload size={12} />} onClick={() => setUploadOpen(true)}>
            Upload
          </GhostButton>
        }
      >
        <DocumentList bookingId={bookingId} documents={documents} invoices={invoices} />
      </Card>
      <UploadDocumentSheet
        bookingId={bookingId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />
    </>
  );
}
