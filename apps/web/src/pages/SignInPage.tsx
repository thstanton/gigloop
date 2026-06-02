import { SignIn } from '@clerk/react';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/admin" />
    </div>
  );
}
