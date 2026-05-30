import React from 'react';

export const useAuth = () => ({ isLoaded: true, isSignedIn: true, userId: 'user_storybook_test' });

export const useUser = () => ({
  user: {
    firstName: 'Tim',
    lastName: 'Stanton',
    fullName: 'Tim Stanton',
    imageUrl: '',
    primaryEmailAddress: { emailAddress: 'tim@example.com' },
  },
  isLoaded: true,
});

export const useClerk = () => ({ signOut: async () => {} });

export const ClerkProvider = ({ children }: { children: React.ReactNode }) => children as React.ReactElement;

export const SignIn = () => null;

export const SignUp = () => null;
