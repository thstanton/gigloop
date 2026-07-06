import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { stepNav } from '@/features/onboarding/steps';

const PATH = '/onboarding/portal';

export default function OnboardingPortalPage() {
  const navigate = useNavigate();
  const { prev, next } = stepNav(PATH);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Your portal & branding"
        subheading="See what your clients experience and make it yours."
        className="mb-0"
      />

      <p className="text-base text-muted">
        A live preview of your client portal — with controls to adjust your theme, brand colour, and
        logo — is coming to this step.
      </p>

      <div className="flex flex-col sm:flex-row items-start gap-3 pt-2">
        {prev && (
          <Button variant="outline" onClick={() => navigate(prev)}>
            Back
          </Button>
        )}
        {next && <Button onClick={() => navigate(next)}>Next</Button>}
        {next && (
          <Button variant="ghost" onClick={() => navigate(next)}>
            Skip for now — customise in Settings
          </Button>
        )}
      </div>
    </div>
  );
}
