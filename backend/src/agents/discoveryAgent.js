// agents/discoveryAgent.js — Agent 3: Provider Discovery
// Finds providers matching the service category and area

const providers = require('../data/providers.mock.json');
const { runWithAdapter } = require('../tools/mode');

const FALLBACK_SERVICE_LABELS = {
  ac_technician: 'home air conditioner repair HVAC technician',
  plumber: 'plumber',
  electrician: 'electrician',
  cleaner: 'cleaning service',
  beautician: 'beautician',
  tutor: 'tutor',
  carpenter: 'carpenter',
};

const AUTOMOTIVE_TERMS = [
  'auto',
  'automobile',
  'automotive',
  'car',
  'cars',
  'vehicle',
  'vehicles',
  'motor',
  'motors',
  'garage',
  'workshop',
];

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.businessStatus',
  'places.types',
  'places.googleMapsUri',
].join(',');

/**
 * @param {{ normalizedServiceType: string, providerSearch?: object, locationText: string, city: string }} input
 * @returns {object} discovered providers
 */
async function run(input) {
  const { normalizedServiceType, providerSearch, locationText, city = 'Islamabad' } = input;

  const mockImpl = async () => {
    if (!normalizedServiceType) {
      return { providers: [], status: 'no_service_type' };
    }

    // Filter by category
    let matches = providers.filter(p => p.category === normalizedServiceType && p.city.toLowerCase() === city.toLowerCase());

    // If location specified, prioritize those serving that area
    if (locationText) {
      const area = locationText.toUpperCase();
      const inArea = matches.filter(p => p.areasServed.includes(area));
      const outArea = matches.filter(p => !p.areasServed.includes(area));
      matches = [...inArea, ...outArea];
    }

    return {
      providers: matches,
      totalFound: matches.length,
      status: matches.length > 0 ? 'found' : 'no_providers',
    };
  };

  const googleImpl = async () => discoverWithGooglePlaces({ normalizedServiceType, providerSearch, locationText, city });

  return runWithAdapter('provider', mockImpl, googleImpl);
}

async function discoverWithGooglePlaces({ normalizedServiceType, providerSearch, locationText, city = 'Islamabad' }) {
  if (!normalizedServiceType) {
    debugGoogleProvider({
      skipped: true,
      reason: 'missing_service_type',
    });
    return { providers: [], totalFound: 0, status: 'no_service_type' };
  }

  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    debugGoogleProvider({
      skipped: true,
      reason: 'not_configured',
      requiredEnv: ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY'],
    });
    throw new Error('not_configured');
  }

  const searchProfile = normalizeProviderSearchProfile(normalizedServiceType, providerSearch);
  const textQuery = buildTextQuery({ normalizedServiceType, providerSearch: searchProfile, locationText, city });
  const timeoutMs = Number(process.env.GOOGLE_PROVIDER_TIMEOUT_MS || 5000);
  const pageSize = normalizePageSize(process.env.GOOGLE_PROVIDER_LIMIT || 8);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;

  try {
    response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      signal: controller.signal,
      body: JSON.stringify({
        textQuery,
        regionCode: 'PK',
        pageSize,
      }),
    });
  } catch (err) {
    debugGoogleProvider({ request: { textQuery, regionCode: 'PK', pageSize }, error: err.message });
    if (err.name === 'AbortError') {
      throw new Error('google_provider_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    debugGoogleProvider({ request: { textQuery, regionCode: 'PK', pageSize }, status: response.status, ok: response.ok, errorText: errText });
    const err = new Error(`google_provider_http_${response.status}`);
    err.detail = errText;
    throw err;
  }

  const body = await response.json();
  debugGoogleProvider({ request: { textQuery, regionCode: 'PK', pageSize }, status: response.status, ok: response.ok, body });
  const places = body.places || [];
  if (!Array.isArray(places) || places.length === 0) {
    throw new Error('google_provider_empty_result');
  }

  const filteredPlaces = filterPlacesForService(places, normalizedServiceType, searchProfile);
  if (filteredPlaces.length === 0) {
    const err = new Error('google_provider_empty_after_service_filter');
    err.detail = `Filtered ${places.length} Places results for ${normalizedServiceType}`;
    throw err;
  }

  const normalizedProviders = filteredPlaces.map((place, index) =>
    normalizeGooglePlace({ place, index, normalizedServiceType, locationText, city })
  );

  return {
    providers: normalizedProviders,
    totalFound: normalizedProviders.length,
    status: 'found',
    query: textQuery,
  };
}

function debugGoogleProvider(payload) {
  if (process.env.DEBUG_GOOGLE_RESPONSE !== 'true' &&
      process.env.DEBUG_GOOGLE_PROVIDER_RESPONSE !== 'true') return;
  console.log('[google:provider]', JSON.stringify(payload, null, 2));
}

function buildTextQuery({ normalizedServiceType, providerSearch, locationText, city }) {
  const serviceLabel = providerSearch?.label ||
    FALLBACK_SERVICE_LABELS[normalizedServiceType] ||
    normalizedServiceType.replace(/_/g, ' ');
  const area = locationText || city;
  return `${serviceLabel} near ${area}, ${city}, Pakistan`;
}

function filterPlacesForService(places, normalizedServiceType, providerSearch) {
  return places.filter((place) => {
    if (matchesExcludedTerm(place, providerSearch?.excludeTerms)) return false;
    if (normalizedServiceType === 'ac_technician' && looksAutomotive(place)) return false;
    return true;
  });
}

function looksAutomotive(place) {
  return matchesExcludedTerm(place, AUTOMOTIVE_TERMS);
}

function matchesExcludedTerm(place, terms = []) {
  if (!Array.isArray(terms) || terms.length === 0) return false;
  const searchable = [
    place.displayName?.text,
    place.formattedAddress,
    ...(place.types || []),
  ].filter(Boolean).join(' ').toLowerCase();

  return terms.some((term) => {
    const normalized = String(term || '').trim().toLowerCase();
    if (!normalized) return false;
    return new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i').test(searchable);
  });
}

function normalizeProviderSearchProfile(normalizedServiceType, providerSearch) {
  const fallbackLabel = FALLBACK_SERVICE_LABELS[normalizedServiceType] || normalizedServiceType.replace(/_/g, ' ');
  if (!providerSearch || typeof providerSearch !== 'object') {
    return { label: fallbackLabel, includeTerms: [fallbackLabel], excludeTerms: [] };
  }

  return {
    label: sanitizeSearchLabel(providerSearch.label) || fallbackLabel,
    includeTerms: sanitizeTerms(providerSearch.includeTerms),
    excludeTerms: sanitizeTerms(providerSearch.excludeTerms),
  };
}

function sanitizeSearchLabel(value) {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[^\p{L}\p{N}\s&/-]/gu, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned || cleaned.length > 90) return null;
  return cleaned;
}

function sanitizeTerms(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((term) => typeof term === 'string'
      ? term.replace(/[^\p{L}\p{N}\s&/-]/gu, ' ').replace(/\s+/g, ' ').trim()
      : null)
    .filter((term) => term && term.length <= 40)
    .slice(0, 12);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeGooglePlace({ place, index, normalizedServiceType, locationText, city }) {
  const placeId = place.id;
  const name = place.displayName?.text;
  const lat = place.location?.latitude;
  const lng = place.location?.longitude;

  if (!placeId || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('google_provider_malformed_place');
  }

  const area = locationText ? locationText.replace(/\s+/g, ' ').trim().toUpperCase() : city.toUpperCase();
  return {
    id: `google:${placeId}`,
    name,
    category: normalizedServiceType,
    city,
    areasServed: [area],
    lat,
    lng,
    rating: Number.isFinite(place.rating) ? place.rating : 4.2,
    completedJobs: Number.isFinite(place.userRatingCount) && place.userRatingCount > 0
      ? place.userRatingCount
      : 75,
    responseRate: 0.82,
    verificationStatus: place.businessStatus === 'OPERATIONAL' ? 'verified' : 'unverified',
    priceLevel: mapPriceLevel(place.priceLevel),
    availableSlots: buildSyntheticSlots(index),
    googlePlaceId: placeId,
    googleMapsUri: place.googleMapsUri || null,
    googleTypes: place.types || [],
    formattedAddress: place.formattedAddress || null,
    source: 'google_places',
  };
}

function mapPriceLevel(priceLevel) {
  if (!priceLevel) return 'medium';
  if (priceLevel === 'PRICE_LEVEL_FREE' || priceLevel === 'PRICE_LEVEL_INEXPENSIVE') return 'low';
  if (priceLevel === 'PRICE_LEVEL_EXPENSIVE' || priceLevel === 'PRICE_LEVEL_VERY_EXPENSIVE') return 'high';
  return 'medium';
}

function buildSyntheticSlots(index) {
  const baseDate = '2026-05-17';
  const slots = [
    ['10:00:00', '11:30:00'],
    ['09:30:00', '14:00:00'],
    ['11:00:00', '16:00:00'],
    ['12:00:00', '18:00:00'],
  ];
  return slots[index % slots.length].map((time) => `${baseDate}T${time}+05:00`);
}

function normalizePageSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 8;
  return Math.max(1, Math.min(20, Math.round(numeric)));
}

module.exports = { run, discoverWithGooglePlaces };
