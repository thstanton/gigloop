import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { VenuePlaceSearch, type VenuePlaceValue } from './VenuePlaceSearch';

// No vi.mock for AddressAutocomplete: the real loadPlaces is used. window.google
// is set up before each test so loadPlaces takes the fast path (no script tag injected).

const emptyValue: VenuePlaceValue = {
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  county: '',
  postcode: '',
  country: 'GB',
  latitude: null,
  longitude: null,
  placeId: null,
};

// Controlled wrapper so the component receives updated value after each onChange.
function Controlled({ initial = emptyValue }: { initial?: VenuePlaceValue }) {
  const [value, setValue] = useState(initial);
  return <VenuePlaceSearch value={value} onChange={setValue} />;
}

function makeAddressComponents() {
  return [
    { types: ['street_number'], longText: '10', shortText: '10' },
    { types: ['route'], longText: 'Main Street', shortText: 'Main St' },
    { types: ['postal_town'], longText: 'London', shortText: 'London' },
    { types: ['postal_code'], longText: 'EC1A 1BB', shortText: 'EC1A 1BB' },
    { types: ['country'], longText: 'United Kingdom', shortText: 'GB' },
    { types: ['administrative_area_level_2'], longText: 'Greater London', shortText: 'Greater London' },
  ];
}

function setupGoogleMock(suggestions: object[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).google = {
    maps: {
      importLibrary: vi.fn().mockImplementation((library: string) => {
        if (library === 'places') {
          return Promise.resolve({
            AutocompleteSuggestion: {
              fetchAutocompleteSuggestions: vi.fn().mockResolvedValue({ suggestions }),
            },
            // Session token is obtained lazily from importLibrary in VenuePlaceSearch.
            AutocompleteSessionToken: function MockSessionToken() {},
          });
        }
        return Promise.resolve({});
      }),
    },
  };
}

beforeEach(() => {
  setupGoogleMock([]);
});

afterEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).google = undefined;
});

describe('VenuePlaceSearch', () => {
  it('renders the search input in empty state', async () => {
    render(<Controlled />);
    // Wait for loadPlaces().then() microtask to settle (session token creation).
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search for a venue/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/enter manually/i)).toBeInTheDocument();
  });

  it('shows address fields when value already has address data', () => {
    render(
      <Controlled
        initial={{
          ...emptyValue,
          name: 'Royal Albert Hall',
          addressLine1: 'Kensington Gore',
          city: 'London',
          postcode: 'SW7 2AP',
          placeId: 'abc',
          latitude: 51.5009,
          longitude: -0.1774,
        }}
      />,
    );
    expect(screen.getByDisplayValue('Royal Albert Hall')).toBeVisible();
    expect(screen.getByDisplayValue('Kensington Gore')).toBeVisible();
    expect(screen.getByDisplayValue('London')).toBeVisible();
    expect(screen.getByDisplayValue('SW7 2AP')).toBeVisible();
  });

  it('switches to manual entry and back to search', async () => {
    render(<Controlled />);
    await waitFor(() => {
      expect(screen.getByText(/enter manually/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/enter manually/i));
    expect(screen.getByPlaceholderText(/O2 Arena/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/123 High Street/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/← search instead/i));
    expect(screen.getByPlaceholderText(/search for a venue/i)).toBeInTheDocument();
  });

  it('populates name and address from an establishment selection', async () => {
    const place = {
      displayName: 'The O2 Arena',
      addressComponents: makeAddressComponents(),
      location: { lat: () => 51.5, lng: () => 0.003 },
      id: 'o2-id',
      fetchFields: vi.fn().mockResolvedValue(undefined),
    };
    setupGoogleMock([
      {
        placePrediction: {
          text: { toString: () => 'The O2 Arena, London' },
          toPlace: () => place,
          types: ['establishment', 'point_of_interest'],
        },
      },
    ]);

    render(<Controlled />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search for a venue/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search for a venue/i);
    fireEvent.change(input, { target: { value: 'O2' } });

    // Wait for the 300ms debounce + suggestions to render.
    const btn = await screen.findByText('The O2 Arena, London', {}, { timeout: 2000 });
    fireEvent.pointerDown(btn);

    await waitFor(() => {
      expect(screen.getByDisplayValue('The O2 Arena')).toBeVisible();
      expect(screen.getByDisplayValue('10 Main Street')).toBeVisible();
    });
  });

  it('leaves name empty when a plain-address (non-establishment) suggestion is selected', async () => {
    const place = {
      displayName: '10 Main Street',
      addressComponents: makeAddressComponents(),
      location: { lat: () => 51.5, lng: () => -0.1 },
      id: 'addr-id',
      fetchFields: vi.fn().mockResolvedValue(undefined),
    };
    setupGoogleMock([
      {
        placePrediction: {
          text: { toString: () => '10 Main Street, London' },
          toPlace: () => place,
          types: ['street_address', 'geocode'],
        },
      },
    ]);

    render(<Controlled />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search for a venue/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/search for a venue/i);
    fireEvent.change(input, { target: { value: '10 Main' } });

    const btn = await screen.findByText('10 Main Street, London', {}, { timeout: 2000 });
    fireEvent.pointerDown(btn);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search for a venue/i)).toHaveValue('');
      expect(screen.getByDisplayValue('10 Main Street')).toBeVisible();
    });
  });
});
