import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactForm, { toContactPayload } from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';

export default function ContactNewPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPost<Contact>('/contacts', toContactPayload(values)),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      navigate(`/admin/contacts/${created.id}`);
    },
  });

  return (
    <div className="px-6 py-8 max-w-2xl">
      <Link
        to="/admin/contacts"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft size={14} />
        Contacts
      </Link>

      <h1 className="font-display text-2xl font-semibold text-foreground mb-8">New contact</h1>

      <ContactForm
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        isError={mutation.isError}
        submitLabel="Create contact"
        onCancel={() => navigate('/admin/contacts')}
      />
    </div>
  );
}
