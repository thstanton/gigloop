import React from 'react';
import '@/styles/globals.css';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
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
import PortalPreviewPage from './pages/admin/PortalPreviewPage';
import PackagesPage from './pages/admin/PackagesPage';
import OnboardingProfilePage from './pages/onboarding/OnboardingProfilePage';
import OnboardingSongsPage from './pages/onboarding/OnboardingSongsPage';
import OnboardingPackagesPage from './pages/onboarding/OnboardingPackagesPage';
import OnboardingChecklistPage from './pages/onboarding/OnboardingChecklistPage';
import OnboardingPortalPage from './pages/onboarding/OnboardingPortalPage';

const queryClient = new QueryClient();

const clerkAppearance = {
  variables: {
    colorPrimary: 'hsl(152, 45%, 25%)',
    colorBackground: 'hsl(38, 30%, 98%)',
    colorInputBackground: 'hsl(38, 25%, 95%)',
    colorText: 'hsl(30, 8%, 13%)',
    colorTextSecondary: 'hsl(30, 8%, 48%)',
    borderRadius: '0.25rem',
    fontFamily: "'Commissioner', sans-serif",
  },
  elements: {
    card: {
      backgroundColor: 'hsl(38, 30%, 98%)',
      boxShadow: 'none',
      border: '1px solid hsl(35, 18%, 87%)',
    },
    headerTitle: {
      fontFamily: "'Playfair Display', serif",
    },
    formButtonPrimary: {
      boxShadow: 'none',
    },
  },
};

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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} appearance={clerkAppearance}>
    <QueryClientProvider client={queryClient}>
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </ClerkProvider>,
);
