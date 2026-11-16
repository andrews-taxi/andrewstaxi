import type { LocationPoint } from '../types';

export interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
  resolve: () => Promise<LocationPoint>;
}

export interface RouteCalculationResult {
  distanceKm: number;
  distanceMeters: number;
  durationMinutes: number | null;
  path: Array<{ lat: number; lng: number }>;
}

declare global {
  interface Window {
    google?: {
      maps?: {
        importLibrary: (name: string) => Promise<Record<string, any>>;
        [key: string]: any;
      };
    };
    __onGoogleMapsLoaded?: () => void;
    gm_authFailure?: () => void;
  }
}

let loaderPromise: Promise<NonNullable<NonNullable<Window['google']>['maps']>> | null = null;

export function getGoogleMapsApiKey(): string {
  return (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
}

export function buildGoogleMapsPinUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/**
 * Loads the Google Maps JavaScript API once per page session using Google's callback hook
 * so `google.maps.importLibrary` is guaranteed to be initialized before resolving.
 */
export function loadGoogleMaps(): Promise<NonNullable<NonNullable<Window['google']>['maps']>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in a browser environment.'));
  }

  if (window.google?.maps?.importLibrary) {
    return Promise.resolve(window.google.maps);
  }

  if (loaderPromise) {
    return loaderPromise;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error('Google Maps API key is missing (VITE_GOOGLE_MAPS_API_KEY).'));
  }

  loaderPromise = new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
    };

    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      cleanup();
      loaderPromise = null;
      reject(new Error(message));
    };

    const succeed = () => {
      if (settled) return;
      if (window.google?.maps?.importLibrary) {
        settled = true;
        cleanup();
        resolve(window.google.maps);
      } else {
        fail('Google Maps initialized without importLibrary support.');
      }
    };

    const timeoutId = window.setTimeout(() => {
      fail('Google Maps timed out while loading. Please check your connection or API key.');
    }, 15000);

    window.gm_authFailure = () => {
      fail('Google Maps API key was rejected (check HTTP referrer restrictions and billing in Google Cloud).');
    };

    window.__onGoogleMapsLoaded = succeed;

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-loader="true"]');
    if (existingScript) {
      // If script already exists and finished loading, poll briefly for importLibrary
      if (window.google?.maps?.importLibrary) {
        succeed();
      }
      existingScript.addEventListener('error', () => {
        fail('Failed to load Google Maps script.');
      }, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__onGoogleMapsLoaded`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.onerror = () => {
      fail('Failed to load Google Maps. Check your API key or network connection.');
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

/**
 * Gets the user's current GPS / browser coordinates on mobile or laptop.
 */
export function getCurrentBrowserPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location services are not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Location permission was denied. Please allow location access or search/pin on the map.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Your current position could not be determined. Please search or pin on the map.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Location request timed out. Please try again or pick your location on the map.'));
            break;
          default:
            reject(new Error('Unable to read your location. Please search or pin on the map.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );
  });
}

function formatReadableAddress(rawAddress: string): string {
  return rawAddress
    .replace(/,\s*Lebanon$/i, '')
    .trim();
}

/**
 * Converts lat/lng coordinates into a readable Lebanese street/area title.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const fallback = `Pinned Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  try {
    const maps = await loadGoogleMaps();
    const { Geocoder } = await maps.importLibrary('geocoding');
    const geocoder = new Geocoder();
    const response = await geocoder.geocode({ location: { lat, lng } });
    const first = response?.results?.[0];
    if (first?.formatted_address) {
      return formatReadableAddress(first.formatted_address);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Searches Lebanese addresses and landmarks using Places API (New),
 * falling back to Geocoding if Places is restricted.
 */
export async function searchLebanonPlaces(query: string): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const maps = await loadGoogleMaps();

  try {
    const placesLib = await maps.importLibrary('places');
    if (placesLib?.AutocompleteSuggestion?.fetchAutocompleteSuggestions) {
      const { suggestions } = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        includedRegionCodes: ['lb'],
      });

      if (Array.isArray(suggestions) && suggestions.length > 0) {
        return suggestions
          .filter((s: any) => s?.placePrediction)
          .slice(0, 6)
          .map((s: any, index: number) => {
            const prediction = s.placePrediction;
            const mainText = prediction.mainText?.text || prediction.text?.text || trimmed;
            const secondaryText = prediction.secondaryText?.text || 'Lebanon';

            return {
              id: prediction.placeId || `${mainText}-${index}`,
              title: mainText,
              subtitle: formatReadableAddress(secondaryText),
              resolve: async () => {
                const place = prediction.toPlace();
                await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
                const loc = place.location;
                const lat = typeof loc.lat === 'function' ? loc.lat() : Number(loc.lat);
                const lng = typeof loc.lng === 'function' ? loc.lng() : Number(loc.lng);
                const display = place.displayName ? String(place.displayName) : mainText;
                const formatted = place.formattedAddress ? formatReadableAddress(String(place.formattedAddress)) : '';
                const title = formatted && !formatted.toLowerCase().includes(display.toLowerCase())
                  ? `${display}, ${formatted}`
                  : (formatted || display);
                return { title, lat, lng };
              },
            };
          });
      }
    }
  } catch {
    // Fall through to Geocoder fallback below
  }

  // Fallback to Geocoding API biased to Lebanon
  try {
    const { Geocoder } = await maps.importLibrary('geocoding');
    const geocoder = new Geocoder();
    const response = await geocoder.geocode({
      address: trimmed,
      componentRestrictions: { country: 'LB' },
    });

    return (response?.results || []).slice(0, 5).map((res: any, index: number) => {
      const lat = typeof res.geometry.location.lat === 'function'
        ? res.geometry.location.lat()
        : Number(res.geometry.location.lat);
      const lng = typeof res.geometry.location.lng === 'function'
        ? res.geometry.location.lng()
        : Number(res.geometry.location.lng);
      const formatted = formatReadableAddress(res.formatted_address || trimmed);
      return {
        id: res.place_id || `geo-${index}`,
        title: formatted,
        subtitle: 'Lebanon',
        resolve: async () => ({ title: formatted, lat, lng }),
      };
    });
  } catch {
    return [];
  }
}

function toLatLngPoint(point: any): { lat: number; lng: number } {
  return {
    lat: typeof point.lat === 'function' ? point.lat() : Number(point.lat),
    lng: typeof point.lng === 'function' ? point.lng() : Number(point.lng),
  };
}

/**
 * Calculates driving distance in kilometers between two coordinates using Google Routes API
 * (via Maps JS API `Route.computeRoutes`), with DirectionsService fallback if needed.
 */
export async function calculateDrivingRoute(
  origin: LocationPoint,
  destination: LocationPoint,
): Promise<RouteCalculationResult> {
  const maps = await loadGoogleMaps();

  try {
    const { Route } = await maps.importLibrary('routes');
    if (Route?.computeRoutes) {
      const response = await Route.computeRoutes({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: maps.TravelMode?.DRIVING || 'DRIVING',
        fields: ['distanceMeters', 'durationMillis', 'path'],
      });

      const primary = response?.routes?.[0];
      if (primary && typeof primary.distanceMeters === 'number') {
        const distanceMeters = primary.distanceMeters;
        const durationMinutes = typeof primary.durationMillis === 'number'
          ? Math.max(1, Math.round(primary.durationMillis / 60000))
          : null;
        const path = Array.isArray(primary.path) ? primary.path.map(toLatLngPoint) : [];
        return {
          distanceMeters,
          distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
          durationMinutes,
          path,
        };
      }
    }
  } catch (routeErr) {
    // Try DirectionsService fallback in case legacy Directions API is active instead of Routes API
    try {
      const routesLib = await maps.importLibrary('routes');
      const DirectionsServiceCtor = routesLib?.DirectionsService || maps.DirectionsService;
      if (DirectionsServiceCtor) {
        const service = new DirectionsServiceCtor();
        const dirResult = await service.route({
          origin: { lat: origin.lat, lng: origin.lng },
          destination: { lat: destination.lat, lng: destination.lng },
          travelMode: 'DRIVING',
        });
        const leg = dirResult?.routes?.[0]?.legs?.[0];
        if (leg?.distance?.value != null) {
          const distanceMeters = leg.distance.value;
          const durationMinutes = leg.duration?.value != null
            ? Math.max(1, Math.round(leg.duration.value / 60))
            : null;
          const overview = dirResult.routes[0].overview_path || [];
          return {
            distanceMeters,
            distanceKm: Math.round((distanceMeters / 1000) * 10) / 10,
            durationMinutes,
            path: overview.map(toLatLngPoint),
          };
        }
      }
    } catch {
      // Throw original Routes API error below
    }
    throw routeErr;
  }

  throw new Error('Could not find a driving route between the selected pickup and drop-off points.');
}

