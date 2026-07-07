import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Expand, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiDelete } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { ImageUploadField } from '@/components/common/ImageUploadField';
import { type Overrides } from '@/features/portal/CustomiseSheet';
import {
  ThemeCards,
  BrandColourControl,
  HeroImagePicker,
} from '@/features/portal/BrandingControls';
import {
  PortalPreviewBody,
  PreviewPageTabs,
  profileToOverrides,
  type PreviewPage,
} from '@/features/portal/PortalPreviewBody';
import { stepNav } from '@/features/onboarding/steps';
import type { PublicProfile, UpdatePublicProfileInput } from '@/types/api';

const PATH = '/onboarding/portal';

export default function OnboardingPortalPage() {
  const navigate = useNavigate();
  const { prev, next } = stepNav(PATH);
  const { isLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded && !!isSignedIn,
  });

  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [previewPage, setPreviewPage] = useState<PreviewPage>('booking');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (profile && overrides === null) setOverrides(profileToOverrides(profile));
  }, [profile, overrides]);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

  // Same save mechanism as the standalone admin preview route (PortalPreviewPage)
  const saveMutation = useMutation({
    mutationFn: (data: UpdatePublicProfileInput) => apiPatch<PublicProfile>('/me/public', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicProfile'] });
      if (next) navigate(next);
    },
    onError: () =>
      toast({ title: 'Failed to save your branding. Please try again.', variant: 'destructive' }),
  });

  // Same upload/remove mechanism as Settings — the logo persists immediately
  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const { uploadUrl, publicUrl } = await apiPost<{ uploadUrl: string; publicUrl: string }>(
        '/me/logo-upload-url',
        { contentType: file.type },
      );
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
      await apiPatch<PublicProfile>('/me/public', { logoUrl: publicUrl });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
    onError: () => toast({ title: 'Failed to upload logo', variant: 'destructive' }),
  });

  const logoDeleteMutation = useMutation({
    mutationFn: () => apiDelete('/me/logo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['publicProfile'] }),
    onError: () => toast({ title: 'Failed to remove logo', variant: 'destructive' }),
  });

  if (!profile || !overrides) return null;

  const bold = overrides.theme === 'BOLD_MODERN' || overrides.theme === 'BOLD_ROMANTIC';

  function handleChange(partial: Partial<Overrides>) {
    setOverrides((o) => (o ? { ...o, ...partial } : o));
  }

  function handleSaveContinue() {
    if (!overrides) return;
    saveMutation.mutate({
      clientPortalConfig: {
        theme: overrides.theme,
        brandColour: overrides.brandColour,
        heroImage: overrides.heroImage,
        showContactPhoto: overrides.showContactPhoto,
        showContactEmail: overrides.showContactEmail,
        showContactPhone: overrides.showContactPhone,
      },
    });
  }

  const sections: { key: string; title: string; body: React.ReactNode }[] = [
    {
      key: 'theme',
      title: 'Pick a theme',
      body: <ThemeCards value={overrides.theme} onChange={(theme) => handleChange({ theme })} />,
    },
    ...(bold
      ? [
          {
            key: 'hero',
            title: 'Choose a hero image',
            body: (
              <HeroImagePicker
                value={overrides.heroImage}
                brandColour={overrides.brandColour}
                onChange={(heroImage) => handleChange({ heroImage })}
              />
            ),
          },
        ]
      : []),
    {
      key: 'colour',
      title: 'Choose your brand colour',
      body: (
        <BrandColourControl
          value={overrides.brandColour}
          onChange={(brandColour) => handleChange({ brandColour })}
        />
      ),
    },
    {
      key: 'logo',
      title: 'Add your logo',
      body: (
        <ImageUploadField
          label="Logo"
          description="Shown at the top of every portal page and on your documents."
          currentUrl={profile.logoUrl}
          uploading={logoUploadMutation.isPending}
          removing={logoDeleteMutation.isPending}
          onFileSelect={(file) => logoUploadMutation.mutate(file)}
          onRemove={() => logoDeleteMutation.mutate()}
          variant="landscape"
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your portal & branding"
        subheading="A personalised client portal is created for every booking, to keep your clients in the loop. Customise it here."
        className="mb-0"
      />

      {/* Sticky scaled-down preview — stays visible while the controls scroll */}
      <div className="sticky top-2 z-10">
        <div className="relative rounded-lg border border-border bg-white overflow-hidden h-64">
          <div
            className="pointer-events-none origin-top-left"
            style={{ transform: 'scale(0.45)', width: '222%' }}
            aria-hidden="true"
          >
            <PortalPreviewBody
              profile={profile}
              overrides={overrides}
              previewPage="booking"
              onNavigate={() => {}}
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground"
          >
            <Expand size={12} />
            Full preview
          </button>
        </div>
      </div>

      {sections.map((section, i) => (
        <div key={section.key} className="flex gap-3">
          <span className="flex-shrink-0 h-7 w-7 rounded-full bg-accent text-sm font-medium text-foreground flex items-center justify-center">
            {i + 1}
          </span>
          <div className="flex-1 space-y-3 pt-0.5">
            <p className="text-base font-medium text-foreground">{section.title}</p>
            {section.body}
          </div>
        </div>
      ))}

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        {prev && (
          <Button variant="outline" onClick={() => navigate(prev)} disabled={saveMutation.isPending}>
            Back
          </Button>
        )}
        <Button onClick={handleSaveContinue} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : 'Save & continue'}
        </Button>
        {next && (
          <Button variant="ghost" onClick={() => navigate(next)} disabled={saveMutation.isPending}>
            Skip for now — customise in Settings
          </Button>
        )}
      </div>

      {/* Full-screen preview overlay — interactive, with page tabs */}
      {expanded && (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
          <div className="h-14 flex items-center justify-between gap-3 px-4 border-b border-border shrink-0">
            <PreviewPageTabs value={previewPage} onChange={setPreviewPage} />
            <Button size="sm" onClick={() => setExpanded(false)}>
              <X size={16} className="mr-1.5" />
              Close preview
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <PortalPreviewBody
              profile={profile}
              overrides={overrides}
              previewPage={previewPage}
              onNavigate={setPreviewPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
