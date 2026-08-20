import { customersApi } from './api';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

// Fallback coordinates if user denies GPS permissions
const DEFAULT_FALLBACK_COORDS: GeoCoordinates = {
  latitude: 20.2961,
  longitude: 85.8245,
};

const LOCATION_STORAGE_KEY = 'aura_user_live_location';

/**
 * Get cached live coordinates if available
 */
export const getCachedCoordinates = (): GeoCoordinates => {
  try {
    const cached = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
        return parsed;
      }
    }
  } catch {
    // Ignore cache parse error
  }
  return DEFAULT_FALLBACK_COORDS;
};

/**
 * Actively query the browser's Geolocation API with high accuracy,
 * cache the result, and optionally sync with backend if user is authenticated.
 */
export const fetchLiveCoordinates = async (syncWithBackend = true): Promise<GeoCoordinates> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(getCachedCoordinates());
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords: GeoCoordinates = {
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        };

        // Cache in localStorage
        try {
          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(coords));
        } catch {
          // Ignore storage error
        }

        // Sync with backend if user is logged in
        if (syncWithBackend && localStorage.getItem('accessToken')) {
          try {
            await customersApi.updateLocation(coords.latitude, coords.longitude);
          } catch {
            // Silently ignore sync errors (e.g. offline / rate limit)
          }
        }

        resolve(coords);
      },
      () => {
        // Return cached or fallback if permission denied / timeout
        resolve(getCachedCoordinates());
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};
