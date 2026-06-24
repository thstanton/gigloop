import '@vitejs/plugin-react/preamble';
import type { Preview } from '@storybook/react-vite';
import '../src/styles/globals.css';
import React from 'react';
import MockDate from 'mockdate';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initialize, mswLoader } from 'msw-storybook-addon';
import { allHandlers, apiFallbackHandler } from './msw-handlers';

// apiFallbackHandler is an *initial* handler — lowest precedence — so any /api/* a
// story doesn't mock returns 404 in-process instead of leaking to the real :3000
// API and flaking at teardown (#495). Per-story handlers still override it.
initialize({ onUnhandledRequest: 'bypass' }, [apiFallbackHandler]);

const makeQueryClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const preview: Preview = {
  async beforeEach() {
    // Freeze time so date-dependent filters (upcomingGigs, etc.) are deterministic
    MockDate.set('2030-06-01T12:00:00Z');
  },
  decorators: [
    (Story) =>
      React.createElement(
        QueryClientProvider,
        { client: makeQueryClient() },
        React.createElement(Story),
      ),
  ],
  loaders: [mswLoader],
  parameters: {
    msw: { handlers: allHandlers },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
