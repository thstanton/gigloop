import React from 'react';
import '@/styles/globals.css';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import HomePage from './pages/HomePage';
import SignInPage from './pages/SignInPage';
import SignUpPage from './pages/SignUpPage';
import AdminLayout from './layouts/AdminLayout';
import DashboardPage from './pages/admin/DashboardPage';
import SettingsPage from './pages/admin/SettingsPage';
import BookingsListPage from './pages/admin/bookings/BookingsListPage';
import BookingDetailPage from './pages/admin/bookings/BookingDetailPage';
import BookingNewPage from './pages/admin/bookings/BookingNewPage';
import ContactsListPage from './pages/admin/contacts/ContactsListPage';
import ContactNewPage from './pages/admin/contacts/ContactNewPage';
import ContactDetailPage from './pages/admin/contacts/ContactDetailPage';
import RepertoirePage from './pages/admin/RepertoirePage';
import TemplatesListPage from './pages/admin/TemplatesListPage';
import TemplateEditPage from './pages/admin/TemplateEditPage';
import PortalPage from './pages/portal/PortalPage';
import PortalContractPage from './pages/portal/PortalContractPage';

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
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'bookings', element: <BookingsListPage /> },
      { path: 'bookings/new', element: <BookingNewPage /> },
      { path: 'bookings/:id', element: <BookingDetailPage /> },
      { path: 'contacts', element: <ContactsListPage /> },
      { path: 'contacts/new', element: <ContactNewPage /> },
      { path: 'contacts/:id', element: <ContactDetailPage /> },
      { path: 'repertoire', element: <RepertoirePage /> },
      { path: 'templates', element: <TemplatesListPage /> },
      { path: 'templates/:id/edit', element: <TemplateEditPage /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <QueryClientProvider client={queryClient}>
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>
    </QueryClientProvider>
  </ClerkProvider>,
);
