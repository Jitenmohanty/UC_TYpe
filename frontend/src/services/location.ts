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

export interface AddressDetails {
  formattedAddress: string;
  city?: string;
  state?: string;
  country?: string;
  road?: string;
  neighbourhood?: string;
  postcode?: string;
}

/**
 * Free Reverse Geocoding via BigDataCloud & OpenStreetMap Nominatim with local caching
 */
export const reverseGeocode = async (latitude: number, longitude: number): Promise<AddressDetails> => {
  const cacheKey = `aura_addr_${latitude.toFixed(4)}_${longitude.toFixed(4)}`;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Ignore storage parse error
  }

  // 1. Try BigDataCloud Free Reverse Geocoding API (Fast, Free, Client-side CORS friendly)
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.localityInfo?.administrative?.[3]?.name || data.localityInfo?.administrative?.[2]?.name || '';
      const city = data.city || data.principalSubdivision || '';
      const parts = [locality, city, data.postcode, data.countryName].filter(Boolean);

      const formatted = parts.join(', ') || `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      const result: AddressDetails = {
        formattedAddress: formatted,
        city: data.city || data.locality || data.principalSubdivision,
        state: data.principalSubdivision,
        country: data.countryName,
        postcode: data.postcode,
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch {}
      return result;
    }
  } catch {
    // Fallback to Nominatim
  }

  // 2. Fallback: OpenStreetMap Nominatim Free API
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { headers: { Accept: 'application/json' } }
    );
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const street = addr.road || addr.suburb || addr.neighbourhood || '';
      const cityName = addr.city || addr.town || addr.village || addr.county || '';
      const parts = [street, cityName, addr.state, addr.postcode, addr.country].filter(Boolean);

      const formatted = data.display_name || parts.join(', ') || `Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`;
      const result: AddressDetails = {
        formattedAddress: formatted,
        city: cityName,
        state: addr.state,
        country: addr.country,
        road: addr.road,
        neighbourhood: addr.neighbourhood || addr.suburb,
        postcode: addr.postcode,
      };

      try {
        localStorage.setItem(cacheKey, JSON.stringify(result));
      } catch {}
      return result;
    }
  } catch {}

  // 3. Coordinate fallback
  return {
    formattedAddress: `Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
  };
};

/**
 * Forward Geocoding: Search coordinates by place/village/city name (e.g. "Rajkanika, Kendrapara")
 */
export const searchAddressCoords = async (
  query: string,
): Promise<{
  latitude: number;
  longitude: number;
  formattedAddress: string;
  city?: string;
  state?: string;
} | null> => {
  if (!query || query.trim().length < 2) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`,
      { headers: { Accept: 'application/json' } },
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const addr = item.address || {};
        const cityName = addr.city || addr.town || addr.village || addr.county || query;
        return {
          latitude: Number(item.lat),
          longitude: Number(item.lon),
          formattedAddress: item.display_name || query,
          city: cityName,
          state: addr.state || 'Odisha',
        };
      }
    }
  } catch {}
  return null;
};

/**
 * Clear cached location from localStorage
 */
export const clearLocationCache = (): void => {
  try {
    localStorage.removeItem(LOCATION_STORAGE_KEY);
  } catch {}
};
