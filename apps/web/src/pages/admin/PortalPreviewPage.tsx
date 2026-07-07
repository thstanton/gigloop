import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { apiGet, apiPatch } from '@/lib/api';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui/button';
import CustomiseSheet, { type Overrides } from '@/features/portal/CustomiseSheet';
import {
  PortalPreviewBody,
  PreviewPageTabs,
  profileToOverrides,
  type PreviewPage,
} from '@/features/portal/PortalPreviewBody';
import type { PublicProfile, UpdatePublicProfileInput } from '@/types/api';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalPreviewPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/sign-in', { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  const { data: profile } = useQuery({
    queryKey: ['publicProfile'],
    queryFn: () => apiGet<PublicProfile>('/me/public'),
    enabled: isLoaded && !!isSignedIn,
  });

  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [previewPage, setPreviewPage] = useState<PreviewPage>('booking');

  useEffect(() => {
    if (profile && overrides === null) {
      setOverrides(profileToOverrides(profile));
    }
  }, [profile, overrides]);

  const saveMutation = useMutation({
    mutationFn: (data: UpdatePublicProfileInput) => apiPatch<PublicProfile>('/me/public', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publicProfile'] });
      setIsDirty(false);
      setSheetOpen(false);
    },
    onError: () => toast({ title: 'Failed to save. Please try again.', variant: 'destructive' }),
  });

  function handleChange(partial: Partial<Overrides>) {
    setOverrides((prev) => prev ? { ...prev, ...partial } : prev);
    setIsDirty(true);
  }

  function handleSave() {
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

  if (!isLoaded || !isSignedIn || !profile || !overrides) return null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Admin top bar */}
      <div className="sticky top-0 z-50 bg-background border-b border-border h-12 flex items-center justify-between gap-3 px-4 shrink-0">
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground transition-colors flex-shrink-0"
        >
          <ChevronLeft size={14} />
          Settings
        </Link>

        <PreviewPageTabs value={previewPage} onChange={setPreviewPage} />

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
            Customise
          </Button>
          <Button
            size="sm"
            disabled={!isDirty || saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Portal preview */}
      <div className="flex-1">
        <PortalPreviewBody
          profile={profile}
          overrides={overrides}
          previewPage={previewPage}
          onNavigate={setPreviewPage}
        />
      </div>

      <CustomiseSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        overrides={overrides}
        onChange={handleChange}
        onSave={handleSave}
        isDirty={isDirty}
        isSaving={saveMutation.isPending}
        hasPhoto={!!profile.photo}
        hasEmail={!!profile.email}
        hasPhone={!!profile.phone}
      />
    </div>
  );
}
