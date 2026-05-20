import { useAuth, useClerk } from '@clerk/react';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

export default function AdminLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoaded && !isSignedIn) navigate('/sign-in', { replace: true });
  }, [isLoaded, isSignedIn, navigate]);

  if (!isLoaded || !isSignedIn) return null;

  return (
    <div>
      <nav>
        <button onClick={() => signOut(() => navigate('/sign-in'))}>Sign out</button>
      </nav>
      <Outlet />
    </div>
  );
}
