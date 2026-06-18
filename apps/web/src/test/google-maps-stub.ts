import { beforeEach } from 'vitest';

// Stub the Google Maps loader so any component that calls `loadPlaces()`
// (VenuePlaceSearch, AddressAutocomplete) takes the *fast path* in
// `loadPlaces` — `window.google.maps.importLibrary` is already present, so no
// <script> tag is appended. Without this, those components append a real Maps
// script, which happy-dom rejects with "JavaScript file loading is disabled",
// surfacing as unhandled async errors that fail the vitest run even though
// every test passes.
//
// The stub's `importLibrary` *rejects*: this mirrors the intended test-env
// behaviour ("Maps unavailable") that the venue stories rely on — VenuePlaceSearch
// catches the rejection, sets loadFailed, and renders its manual-entry fallback —
// while still avoiding the script injection that produced the error.
//
// Guarded on absence: a spec that installs its own working google mock (e.g.
// VenuePlaceSearch.spec) is left untouched.
function installGoogleMapsStub() {
  const win = window as unknown as { google?: { maps?: { importLibrary?: unknown } } };
  if (win.google?.maps?.importLibrary) return;
  win.google = {
    maps: {
      importLibrary: async () => {
        throw new Error('Google Maps unavailable in test environment');
      },
    },
  };
}

installGoogleMapsStub();
beforeEach(installGoogleMapsStub);
