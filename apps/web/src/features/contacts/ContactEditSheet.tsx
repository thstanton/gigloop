import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import ContactForm, { toContactPayload, contactToFormValues } from './ContactForm';
import type { ContactFormValues } from './ContactForm';
import { apiPatch } from '@/lib/api';
import type { Contact } from '@/types/api';

interface Props {
  contact: Contact | null;
  onClose: () => void;
}

export default function ContactEditSheet({ contact, onClose }: Props) {
  const queryClient = useQueryClient();
  const open = contact !== null;

  const saveMutation = useMutation({
    mutationFn: (values: ContactFormValues) =>
      apiPatch<Contact>(`/contacts/${contact!.id}`, toContactPayload(values)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contact', contact!.id] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking'] });
      onClose();
    },
  });

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle>Edit contact</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {contact && (
            <ContactForm
              key={contact.updatedAt}
              defaultValues={contactToFormValues(contact)}
              onSubmit={(values) => saveMutation.mutate(values)}
              isPending={saveMutation.isPending}
              isError={saveMutation.isError}
              submitLabel="Save changes"
              onCancel={onClose}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
