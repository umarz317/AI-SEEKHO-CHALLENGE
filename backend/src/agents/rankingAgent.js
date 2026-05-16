// agents/rankingAgent.js — Agent 4: Provider Ranking
// Scores and ranks providers using weighted formula

const { runWithAdapter, googleStubs } = require('../tools/mode');

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
  
  const mockImpl = async () => {
    if (!providers || providers.length === 0) {
      return { rankedProviders: [], status: 'no_providers_to_rank' };
    }

    const scored = providers.map(p => {
      const distanceKm = haversine(userLat, userLng, p.lat, p.lng);

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
        availableSlot,
        slotLabel,
        reasonCodes,
        reasons,
        description: buildDescription(p, distanceKm, availabilityScore, timeWindow),
        gradient: getGradient(p.category),
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    return {
      rankedProviders: scored,
      status: 'ranked',
    };
  };

  return runWithAdapter('distance', mockImpl, googleStubs.distance);
}



function projectSlotToDate(slot, resolvedDate) {
  if (!slot || !resolvedDate) return slot;
  const timeWithZone = slot.slice(10);
  return `${resolvedDate}${timeWithZone}`;
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

module.exports = { run };
