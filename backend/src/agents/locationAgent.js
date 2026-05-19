// agents/locationAgent.js — Agent 2: Location Resolution
// Resolves sector names to lat/lng coordinates

const locations = require('../data/locations.mock.json');
const { runWithAdapter } = require('../tools/mode');

/**
 * @param {{ locationText: string, city: string }} input
 * @returns {object} resolved location
 */
async function run(input) {
  const { locationText, city = 'Islamabad' } = input;

  const mockImpl = async () => {
    if (!locationText) return buildMissingLocation(city);

    const key = locationText.toUpperCase();
    const loc = locations[key];

    if (loc) {
      return {
        locationText: key,
        formattedLocation: loc.formatted || `${key}, ${city}`,
        lat: loc.lat,
        lng: loc.lng,
        city: loc.city || inferCity(loc.formatted) || city,
        status: 'resolved',
      };
    }

    // Fallback — sector not in DB, use city center
    return {
      locationText: key,
      formattedLocation: `${key}, ${city}`,
      lat: 33.6844,
      lng: 73.0479,
      city,
      status: 'approximate',
    };
  };

  const googleImpl = async () => {
    if (!locationText) {
      debugGoogleLocation({
        skipped: true,
        reason: 'missing_location_text',
        city,
      });
      return buildMissingLocation(city);
    }
    return geocodeWithGoogle({ locationText, city });
  };

  return runWithAdapter('location', mockImpl, googleImpl);
}

function inferCity(formatted) {
  if (!formatted || !formatted.includes(',')) return null;
  return formatted.split(',').pop().trim();
}

async function geocodeWithGoogle({ locationText, city }) {
  const key = process.env.GOOGLE_GEOCODING_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    debugGoogleLocation({
      skipped: true,
      reason: 'not_configured',
      requiredEnv: ['GOOGLE_GEOCODING_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY'],
    });
    throw new Error('not_configured');
  }

  const query = `${locationText}, ${city}, Pakistan`;
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('components', 'country:PK');
  url.searchParams.set('region', 'pk');
  url.searchParams.set('key', key);

  const timeoutMs = Number(process.env.GOOGLE_LOCATION_TIMEOUT_MS || 5000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    debugGoogleLocation({ request: { address: query }, error: err.message });
    if (err.name === 'AbortError') {
      throw new Error('google_location_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    debugGoogleLocation({ request: { address: query }, status: response.status, ok: response.ok, errorText: errText });
    const err = new Error(`google_location_http_${response.status}`);
    err.detail = errText;
    throw err;
  }

  const body = await response.json();
  debugGoogleLocation({ request: { address: query }, status: response.status, ok: response.ok, body });
  if (body.status !== 'OK') {
    const err = new Error(`google_location_${String(body.status || 'unknown').toLowerCase()}`);
    err.detail = body.error_message || '';
    throw err;
  }

  const result = body.results?.[0];
  const loc = result?.geometry?.location;
  if (!result || !Number.isFinite(loc?.lat) || !Number.isFinite(loc?.lng)) {
    throw new Error('google_location_empty_result');
  }

  const normalizedLocation = locationText.replace(/\s+/g, ' ').trim().toUpperCase();
  return {
    locationText: normalizedLocation,
    formattedLocation: result.formatted_address || `${normalizedLocation}, ${city}`,
    lat: loc.lat,
    lng: loc.lng,
    city: inferCityFromComponents(result.address_components) || city,
    status: result.partial_match ? 'approximate' : 'resolved',
    placeId: result.place_id || null,
    locationType: result.geometry?.location_type || null,
  };
}

function debugGoogleLocation(payload) {
  if (process.env.DEBUG_GOOGLE_RESPONSE !== 'true' &&
      process.env.DEBUG_GOOGLE_LOCATION_RESPONSE !== 'true') return;
  console.log('[google:location]', JSON.stringify(payload, null, 2));
}

function inferCityFromComponents(components = []) {
  const preferredTypes = [
    'locality',
    'administrative_area_level_2',
    'administrative_area_level_1',
  ];
  for (const type of preferredTypes) {
    const match = components.find((component) => component.types?.includes(type));
    if (match?.long_name) return match.long_name;
  }
  return null;
}

function buildMissingLocation(city) {
  return {
    locationText: null,
    formattedLocation: null,
    lat: null,
    lng: null,
    city,
    status: 'missing_location',
  };
}

module.exports = { run, geocodeWithGoogle };
