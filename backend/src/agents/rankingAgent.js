// agents/rankingAgent.js — Agent 4: Provider Ranking
// Scores and ranks providers using weighted formula

const { runWithAdapter } = require('../tools/mode');

/**
 * Haversine distance between two lat/lng points (km)
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * @param {{
 *   providers: Array,
 *   userLat: number, userLng: number,
 *   timeWindow?: { start: string, end: string },
 *   resolvedDate?: string
 * }} input
 * @returns {object} ranked providers
 */
async function run(input) {
  const { providers, userLat, userLng, timeWindow, resolvedDate } = input;

  const mockImpl = async () => scoreProviders({
    providers,
    userLat,
    userLng,
    timeWindow,
    resolvedDate,
    distanceResolver: async (p) => ({ distanceKm: haversine(userLat, userLng, p.lat, p.lng) }),
  });

  const googleImpl = async () => {
    if (!providers || providers.length === 0) {
      return { rankedProviders: [], status: 'no_providers_to_rank' };
    }

    const routeDistances = await computeRouteMatrixWithGoogle({ providers, userLat, userLng });
    return scoreProviders({
      providers,
      userLat,
      userLng,
      timeWindow,
      resolvedDate,
      distanceResolver: async (_p, index) => routeDistances[index],
    });
  };

  return runWithAdapter('distance', mockImpl, googleImpl);
}

async function scoreProviders({ providers, timeWindow, resolvedDate, distanceResolver }) {
  if (!providers || providers.length === 0) {
    return { rankedProviders: [], status: 'no_providers_to_rank' };
  }

  const scored = await Promise.all(providers.map(async (p, index) => {
      const routeDistance = await distanceResolver(p, index);
      const distanceKm = routeDistance.distanceKm;
      // Availability score: is there a slot in the requested window?
      let availabilityScore = 0;
      let availableSlot = null;
      if (timeWindow && resolvedDate) {
        const windowStart = new Date(`${resolvedDate}T${timeWindow.start}:00+05:00`);
        const windowEnd = new Date(`${resolvedDate}T${timeWindow.end}:00+05:00`);
        for (const slot of p.availableSlots) {
          const projectedSlot = projectSlotToDate(slot, resolvedDate);
          const slotDate = new Date(projectedSlot);
          if (slotDate >= windowStart && slotDate <= windowEnd) {
            availabilityScore = 1;
            availableSlot = projectedSlot;
            break;
          }
        }
        // Fallback: any slot on that date
        if (!availableSlot) {
          for (const slot of p.availableSlots) {
            const projectedSlot = projectSlotToDate(slot, resolvedDate);
            if (projectedSlot.startsWith(resolvedDate)) {
              availabilityScore = 0.4;
              availableSlot = projectedSlot;
              break;
            }
          }
        }
      } else {
        availabilityScore = 0.5;
        availableSlot = p.availableSlots[0] ? projectSlotToDate(p.availableSlots[0], resolvedDate) : null;
      }

      const ratingScore = p.rating / 5;
      const distanceScore = Math.max(0, 1 - (distanceKm / 20)); // 20km max
      const reliabilityScore = Math.min(p.completedJobs / 400, 1);
      const responseScore = p.responseRate;

      const score = 0.30 * availabilityScore +
        0.25 * ratingScore +
        0.20 * distanceScore +
        0.15 * reliabilityScore +
        0.10 * responseScore;

      // Build reason codes
      const reasonCodes = [];
      if (availabilityScore >= 0.8) reasonCodes.push('available_in_requested_window');
      if (distanceKm < 3) reasonCodes.push('nearby');
      else if (distanceKm < 6) reasonCodes.push('closest_available_provider');
      if (p.rating >= 4.7) reasonCodes.push('high_rating');
      if (p.responseRate >= 0.90) reasonCodes.push('fast_response_rate');
      if (p.completedJobs >= 200) reasonCodes.push('high_completed_jobs');
      if (availabilityScore < 0.5) reasonCodes.push('outside_requested_time');
      if (distanceKm > 10) reasonCodes.push('too_far');

      // Human reasons
      const reasons = [];
      if (availabilityScore >= 0.8) reasons.push('Available in window');
      if (distanceKm < 5) reasons.push('Nearby');
      if (p.rating >= 4.5) reasons.push('High rating');
      if (p.responseRate >= 0.90) reasons.push('Fast response');
      if (p.completedJobs >= 200) reasons.push('Strong history');

      // Format slot time
      let slotLabel = null;
      if (availableSlot) {
        const d = new Date(availableSlot);
        const h = d.getHours();
        const m = d.getMinutes();
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        slotLabel = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
      }

      return {
        providerId: p.id,
        name: p.name,
        initials: p.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        rating: p.rating,
        reviews: Math.round(p.completedJobs * 0.41), // approx reviews
        completedJobs: p.completedJobs,
        responseMin: Math.round((1 - p.responseRate) * 40 + 2), // synthetic response time
        yearsActive: Math.round(p.completedJobs / 50),
        verified: p.verificationStatus === 'verified',
        score: Math.round(score * 1000) / 1000,
        distanceKm: Math.round(distanceKm * 10) / 10,
        distanceLabel: `${(Math.round(distanceKm * 10) / 10)} km`,
        durationSeconds: routeDistance.durationSeconds || null,
        durationLabel: routeDistance.durationSeconds ? formatDuration(routeDistance.durationSeconds) : null,
        googleMapsUri: p.googleMapsUri || null,
        googlePlaceId: p.googlePlaceId || null,
        formattedAddress: p.formattedAddress || null,
        availableSlot,
        slotLabel,
        reasonCodes,
        reasons,
        description: buildDescription(p, distanceKm, availabilityScore, timeWindow),
        gradient: getGradient(p.category),
      };
    }));

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  return {
    rankedProviders: scored,
    status: 'ranked',
  };
}

async function computeRouteMatrixWithGoogle({ providers, userLat, userLng }) {
  const key = process.env.GOOGLE_ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    debugGoogleDistance({
      skipped: true,
      reason: 'not_configured',
      requiredEnv: ['GOOGLE_ROUTES_API_KEY', 'GOOGLE_MAPS_API_KEY'],
    });
    throw new Error('not_configured');
  }
  if (!Number.isFinite(userLat) || !Number.isFinite(userLng)) {
    debugGoogleDistance({
      skipped: true,
      reason: 'missing_origin',
      origin: { lat: userLat, lng: userLng },
    });
    throw new Error('google_distance_missing_origin');
  }

  const destinations = providers.map((provider) => {
    if (!Number.isFinite(provider.lat) || !Number.isFinite(provider.lng)) {
      throw new Error('google_distance_malformed_provider');
    }
    return {
      waypoint: {
        location: {
          latLng: {
            latitude: provider.lat,
            longitude: provider.lng,
          },
        },
      },
    };
  });

  const timeoutMs = Number(process.env.GOOGLE_DISTANCE_TIMEOUT_MS || 5000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  const requestSummary = {
    origin: { lat: userLat, lng: userLng },
    destinations: providers.map((provider) => ({
      providerId: provider.id,
      name: provider.name,
      lat: provider.lat,
      lng: provider.lng,
    })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
  };

  try {
    response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters,duration',
      },
      signal: controller.signal,
      body: JSON.stringify({
        origins: [{
          waypoint: {
            location: {
              latLng: {
                latitude: userLat,
                longitude: userLng,
              },
            },
          },
        }],
        destinations,
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
      }),
    });
  } catch (err) {
    debugGoogleDistance({ request: requestSummary, error: err.message });
    if (err.name === 'AbortError') {
      throw new Error('google_distance_timeout');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    debugGoogleDistance({ request: requestSummary, status: response.status, ok: response.ok, errorText: errText });
    const err = new Error(`google_distance_http_${response.status}`);
    err.detail = errText;
    throw err;
  }

  const body = await response.json();
  debugGoogleDistance({ request: requestSummary, status: response.status, ok: response.ok, body });
  const elements = Array.isArray(body) ? body : body.elements;
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new Error('google_distance_empty_result');
  }

  const byDestination = new Map();
  for (const element of elements) {
    const destinationIndex = element.destinationIndex;
    if (!Number.isInteger(destinationIndex)) continue;
    if (element.condition && element.condition !== 'ROUTE_EXISTS') continue;
    if (element.status && !isOkStatus(element.status)) continue;
    if (!Number.isFinite(element.distanceMeters)) continue;
    byDestination.set(destinationIndex, {
      distanceKm: element.distanceMeters / 1000,
      durationSeconds: parseDurationSeconds(element.duration),
    });
  }

  return providers.map((_provider, index) => {
    const routeDistance = byDestination.get(index);
    if (!routeDistance) throw new Error('google_distance_missing_element');
    return routeDistance;
  });
}

function debugGoogleDistance(payload) {
  if (process.env.DEBUG_GOOGLE_RESPONSE !== 'true' &&
      process.env.DEBUG_GOOGLE_DISTANCE_RESPONSE !== 'true') return;
  console.log('[google:distance]', JSON.stringify(payload, null, 2));
}

function projectSlotToDate(slot, resolvedDate) {
  if (!slot || !resolvedDate) return slot;
  const timeWithZone = slot.slice(10);
  return `${resolvedDate}${timeWithZone}`;
}

function isOkStatus(status) {
  if (typeof status === 'string') return status === 'OK';
  if (typeof status === 'object') return !status.code || status.code === 0 || status.code === 'OK';
  return true;
}

function parseDurationSeconds(duration) {
  if (typeof duration !== 'string') return null;
  const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
  return match ? Math.round(Number(match[1])) : null;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function buildDescription(p, distKm, availScore, timeWindow) {
  const dist = Math.round(distKm * 10) / 10;
  const avail = availScore >= 0.8 ? 'available in the requested window' : 'available on the requested day';
  const timeDesc = timeWindow ? ` ${timeWindow.label || 'requested time'}` : '';
  const serviceLabel = (p.category || 'provider').replace(/_/g, ' ');
  return `Closest high-rated ${serviceLabel} ${avail}${timeDesc ? ` (${timeDesc.trim()})` : ''}, ${dist} km away.`;
}

function getGradient(category) {
  const map = {
    ac_technician: ['#10B981', '#047857'],
    plumber: ['#F59E0B', '#B45309'],
    electrician: ['#EAB308', '#A16207'],
    cleaner: ['#22C55E', '#15803D'],
    beautician: ['#EC4899', '#BE185D'],
    tutor: ['#6366F1', '#4338CA'],
  };
  return map[category] || ['#3B82F6', '#1D4ED8'];
}

module.exports = { run, computeRouteMatrixWithGoogle };
