import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/react';
import { apiPatch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Input } from '@/components/ui/input';
import { toast } from '@/lib/hooks/use-toast';
import type { PublicProfile } from '@/types/api';

const schema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  displayName: z.string().optional(),
  email: z.string().email('Enter a valid email').or(z.literal('')).optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function OnboardingProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useUser();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      businessName: '',
      displayName: '',
      email: user?.primaryEmailAddress?.emailAddress ?? '',
      phone: '',
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data: FormValues) =>
      apiPatch<PublicProfile>('/me/public', {
        businessName: data.businessName,
        displayName: data.displayName || null,
        email: data.email || null,
        phone: data.phone || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-profile'] });
      navigate('/onboarding/songs');
    },
    onError: () => {
      toast({ title: 'Failed to save. Please try again.', variant: 'destructive' });
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Set up your profile"
        subheading="This appears on your client portal and communications."
        className="mb-0"
      />

      <form onSubmit={handleSubmit((data) => mutate(data))} className="flex flex-col gap-4">
        <FormField label="Business name" error={errors.businessName?.message} required>
          <Input {...register('businessName')} placeholder="e.g. Smith String Quartet" />
        </FormField>

        <FormField label="Display name" error={errors.displayName?.message}>
          <Input {...register('displayName')} placeholder="e.g. James Smith" />
        </FormField>

        <FormField label="Email" error={errors.email?.message}>
          <Input {...register('email')} type="email" placeholder="you@example.com" />
        </FormField>

        <FormField label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} type="tel" placeholder="+44 7700 900000" />
        </FormField>

        <div className="flex justify-start pt-2">
          <Button type="submit" disabled={!isValid || isPending}>
            {isPending ? 'Saving…' : 'Next'}
          </Button>
        </div>
      </form>
    </div>
  );
}
