import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ContactForm, { toContactPayload } from '@/features/contacts/ContactForm';
import type { ContactFormValues } from '@/features/contacts/ContactForm';
import { apiPost } from '@/lib/api';
import type { Contact } from '@/types/api';
import { PageHeader } from '@/components/common/PageHeader';

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
    <div className="px-6 py-8 max-w-3xl mx-auto">
      <PageHeader title="New contact" backHref="/admin/contacts" backLabel="Contacts" />

      <ContactForm
        onSubmit={(values) => mutation.mutate(values)}
        isPending={mutation.isPending}
        isError={mutation.isError}
        submitLabel="Create contact"
        onCancel={() => navigate('/admin/contacts')}
        autoSuggestGreetingName
      />
    </div>
  );
}
