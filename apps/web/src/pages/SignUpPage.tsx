import { SignUp } from '@clerk/react';

export default function SignUpPage() {
  return <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/onboarding/profile" />;
}
