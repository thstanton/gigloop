import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import ContactForm, {
  toContactPayload,
  contactToFormValues,
} from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import { useContact } from '@/lib/hooks/useContact';
import { apiPatch, apiDelete } from '@/lib/api';
import { Button } from '@/components/ui/button';
import type { Contact } from '@/types/api';

export default function ContactEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const { data: contact, isLoading } = useContact(id!);

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPatch<Contact>(`/contacts/${id}`, toContactPayload(values)),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contact', id], (prev: Contact | undefined) =>
        prev ? { ...prev, ...updated } : updated,
      );
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate(`/admin/contacts/${id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/contacts/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['contact', id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate('/admin/contacts');
    },
  });

  if (isLoading || !contact) {
    return (
      <div className="px-6 py-8 max-w-2xl animate-pulse space-y-6">
        <div className="h-4 w-24 bg-border rounded" />
        <div className="h-7 w-32 bg-border rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-border rounded" />)}
        </div>
      </div>
    );
  }

  const totalBookings =
    contact.customerBookings.length +
    contact.venueBookings.length +
    contact.referrerBookings.length;

  return (
    <div className="px-6 py-8 max-w-2xl">
      <Link
        to={`/admin/contacts/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        {contact.name}
      </Link>

      <h1 className="text-2xl font-semibold text-foreground mb-8">Edit contact</h1>

      <ContactForm
        defaultValues={contactToFormValues(contact)}
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        isError={mutation.isError}
        submitLabel="Save changes"
        onCancel={() => navigate(`/admin/contacts/${id}`)}
      />

      <div className="border-t border-border mt-10 pt-8">
        <p className="text-sm font-medium text-foreground mb-1">Delete contact</p>
        <p className="text-sm text-muted mb-4">
          {totalBookings > 0
            ? `This contact has ${totalBookings} booking${totalBookings === 1 ? '' : 's'} and cannot be deleted.`
            : 'Permanently removes this contact. This cannot be undone.'}
        </p>
        {deleteConfirm ? (
          <Button
            size="sm"
            variant="outline"
            className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Confirm delete'}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-status-cancelled border-status-cancelled hover:bg-status-cancelled/8"
            disabled={totalBookings > 0}
            onClick={() => setDeleteConfirm(true)}
          >
            Delete contact
          </Button>
        )}
      </div>
    </div>
  );
}
