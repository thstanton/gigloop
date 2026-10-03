// Must be the first import: under ES module evaluation, a module's own
// statements run only after all its imports resolve, so a guard inlined here
// would still run after every module below has already loaded. A separate,
// first-imported module evaluates (and so calls Sentry.init()) before any
// sibling import's subtree does.
import './instrument';

import React from 'react';
import '@/styles/globals.css';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import ErrorBoundary, { variantForPathname } from '@/components/ErrorBoundary';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AdminLayout from './layouts/AdminLayout';
import OnboardingLayout from './layouts/OnboardingLayout';
import DashboardPage from './pages/admin/DashboardPage';
import SettingsPage from './pages/admin/SettingsPage';
import BookingsListPage from './pages/admin/bookings/BookingsListPage';
import BookingDetailPage from './pages/admin/bookings/BookingDetailPage';
import BookingBuilderPage from './pages/admin/bookings/BookingBuilderPage';
import BookingNewPage from './pages/admin/bookings/BookingNewPage';
import ContactsListPage from './pages/admin/contacts/ContactsListPage';
import ContactNewPage from './pages/admin/contacts/ContactNewPage';
import ContactDetailPage from './pages/admin/contacts/ContactDetailPage';
import RepertoirePage from './pages/admin/RepertoirePage';
import TemplatesListPage from './pages/admin/TemplatesListPage';
import TemplateEditPage from './pages/admin/TemplateEditPage';
import PortalPage from './pages/portal/PortalPage';
import PortalContractPage from './pages/portal/PortalContractPage';
import PortalMusicPage from './pages/portal/PortalMusicPage';
import BandPortalPage from './pages/portal/BandPortalPage';
import PortalPreviewPage from './pages/admin/PortalPreviewPage';
import PackagesPage from './pages/admin/PackagesPage';
import OnboardingProfilePage from './pages/onboarding/OnboardingProfilePage';
import OnboardingSongsPage from './pages/onboarding/OnboardingSongsPage';
import OnboardingPackagesPage from './pages/onboarding/OnboardingPackagesPage';
import OnboardingChecklistPage from './pages/onboarding/OnboardingChecklistPage';
import OnboardingPortalPage from './pages/onboarding/OnboardingPortalPage';
import { getEnvironmentLabel } from './lib/environment';
import { useAppearance } from './lib/hooks/useAppearance';
import { buildClerkAppearance, readRootToken } from './lib/clerkAppearance';

const environmentLabel = getEnvironmentLabel();
if (environmentLabel) {
  document.title = `[${environmentLabel}] ${document.title}`;
}

const queryClient = new QueryClient();

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/sign-in/*',
    element: <SignInPage />,
  },
  {
    path: '/sign-up/*',
    element: <SignUpPage />,
  },
  {
    path: '/booking/:token',
    element: <PortalPage />,
  },
  {
    path: '/booking/:token/contract',
    element: <PortalContractPage />,
  },
  {
    path: '/booking/:token/music',
    element: <PortalMusicPage />,
  },
  {
    path: '/band/:token',
    element: <BandPortalPage />,
  },
  {
    path: '/admin/portal-preview',
    element: <PortalPreviewPage />,
  },
  {
    path: '/onboarding',
    element: <OnboardingLayout />,
    children: [
      { path: 'profile', element: <OnboardingProfilePage /> },
      { path: 'checklist', element: <OnboardingChecklistPage /> },
      { path: 'packages', element: <OnboardingPackagesPage /> },
      { path: 'portal', element: <OnboardingPortalPage /> },
      { path: 'songs', element: <OnboardingSongsPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'bookings', element: <BookingsListPage /> },
      { path: 'bookings/new', element: <BookingNewPage /> },
      { path: 'bookings/:id', element: <BookingDetailPage /> },
      { path: 'bookings/:id/builder', element: <BookingBuilderPage /> },
      { path: 'contacts', element: <ContactsListPage /> },
      { path: 'contacts/new', element: <ContactNewPage /> },
      { path: 'contacts/:id', element: <ContactDetailPage /> },
      { path: 'repertoire', element: <RepertoirePage /> },
      { path: 'templates', element: <TemplatesListPage /> },
      { path: 'templates/:id/edit', element: <TemplateEditPage /> },
      { path: 'packages', element: <PackagesPage /> },
    ],
  },
]);

function usePathname() {
  const [pathname, setPathname] = React.useState(() => window.location.pathname);

  React.useEffect(
    () => router.subscribe((state) => setPathname(state.location.pathname)),
    [],
  );

  return pathname;
}

// Clerk renders its own UI, so its colours are rebuilt from the declared tokens whenever the
// resolved appearance changes. This wrapper also owns the root `dark` class (useAppearance), and
// declares that before the layout effect below so the tokens are read after the class flips.
function AppearanceClerkProvider({ children }: { children: React.ReactNode }) {
  const { resolved } = useAppearance(usePathname());
  const [appearance, setAppearance] = React.useState(() => buildClerkAppearance(readRootToken));

  React.useLayoutEffect(() => {
    setAppearance(buildClerkAppearance(readRootToken));
  }, [resolved]);

  return (
    <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} appearance={appearance}>
      {children}
    </ClerkProvider>
  );
}

function RootErrorBoundary() {
  const variant = variantForPathname(usePathname());

  return (
    <ErrorBoundary variant={variant}>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppearanceClerkProvider>
    <QueryClientProvider client={queryClient}>
      <React.StrictMode>
        <RootErrorBoundary />
      </React.StrictMode>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </AppearanceClerkProvider>,
);
