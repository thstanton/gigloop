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
import ContactEditPage from './pages/admin/contacts/ContactEditPage';

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
      { path: 'contacts/:id/edit', element: <ContactEditPage /> },
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
