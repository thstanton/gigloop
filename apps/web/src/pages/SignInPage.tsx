import { SignIn } from '@clerk/react';

export default function SignInPage() {
  return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/admin" />;
}
