import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { apiPostFormData } from '@/lib/api';
import type { Document } from '@/types/api';

const MAX_SIZE = 10 * 1024 * 1024;

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UploadDocumentSheet({ bookingId, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const file = fileRef.current?.files?.[0];
      if (!file) { setFileError('Please select a PDF file'); throw new Error('no file'); }
      if (file.size > MAX_SIZE) { setFileError('File must be 10 MB or smaller'); throw new Error('too large'); }
      setFileError(null);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', values.name);
      return apiPostFormData<Document>(`/bookings/${bookingId}/documents/upload`, fd);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookingDocuments', bookingId] });
      reset();
      if (fileRef.current) fileRef.current.value = '';
      onOpenChange(false);
    },
  });

  function handleOpenChange(next: boolean) {
    if (!next) { reset(); setFileError(null); if (fileRef.current) fileRef.current.value = ''; }
    onOpenChange(next);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Upload document</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="mt-4 space-y-4">
          <FormField label="Document name" required error={errors.name?.message}>
            <Input
              {...register('name')}
              aria-label="Document name"
              placeholder="e.g. O2 Academy Contract"
            />
          </FormField>
          <FormField label="PDF file" required error={fileError ?? undefined}>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,application/pdf"
              aria-label="PDF file"
              className="text-sm"
              onChange={() => setFileError(null)}
            />
          </FormField>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Uploading…' : 'Upload'}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
