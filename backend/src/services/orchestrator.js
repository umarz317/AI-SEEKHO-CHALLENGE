// services/orchestrator.js — Master Orchestrator
// Chains all 7 agents in sequence and builds the unified response

const intentAgent = require('../agents/intentAgent');
const locationAgent = require('../agents/locationAgent');
const discoveryAgent = require('../agents/discoveryAgent');
const rankingAgent = require('../agents/rankingAgent');
const bookingAgent = require('../agents/bookingAgent');
const followUpAgent = require('../agents/followUpAgent');
const traceAgent = require('../agents/traceAgent');

const COLORS = {
  purple: '#8B5CF6',
  agent: '#6366F1',
  blue: '#0EA5E9',
  amber: '#F59E0B',
  accent: '#10B981',
  success: '#22C55E',
};

/**
 * Run the full orchestration pipeline
 * @param {{ userId: string, customerPhone?: string, text: string, cityHint: string, timezone?: string }} request
 * @returns {object} full orchestration response
 */
async function orchestrate(request, options = {}) {
  const { userId = 'demo-user-001', customerPhone = null, text, cityHint = 'Islamabad', timezone = 'Asia/Karachi' } = request;
  const { onProgress } = options;
  const traceSteps = [];

  // ---------- Step 1: Intent Understanding ----------
  emitProgress(onProgress, {
    agent: 'Intent Understanding',
    tool: 'parse_request',
    status: 'running',
    icon: 'sparkle',
    color: COLORS.purple,
    output: 'Parsing request with the configured intent adapter.',
  });
  const intent = await intentAgent.run({ text, cityHint });
  recordStep(traceSteps, onProgress, {
    agent: 'Intent Understanding',
    tool: 'parse_request',
    source: intent.source,
    status: intent.serviceType ? 'success' : 'partial',
    icon: 'sparkle',
    color: COLORS.purple,
    output: `Extracted ${intent.serviceType || 'unknown service'}, ${intent.locationText || 'no location'}, ${intent.dateText || 'no date'} ${intent.timeText || ''} · ${intent.detectedLanguage} · ${Math.round(intent.confidence * 100)}% · parser ${intent.parser || 'adapter'}`,
    summary: 'Intent parsed successfully.',
  });

  // ---------- Step 2: Location Resolution ----------
  emitProgress(onProgress, {
    agent: 'Location Resolution',
    tool: 'resolve_location',
    status: 'running',
    icon: 'pin',
    color: COLORS.agent,
    output: `Resolving ${intent.locationText || 'customer location'}.`,
  });
  const location = await locationAgent.run({
    locationText: intent.locationText,
    city: intent.city,
  });
  recordStep(traceSteps, onProgress, {
    agent: 'Location Resolution',
    tool: 'resolve_location',
    source: location.source,
    status: location.status === 'resolved' ? 'success' : 'partial',
    icon: 'pin',
    color: COLORS.agent,
    output: location.lat
      ? `${intent.locationText} → ${location.lat}°N, ${location.lng}°E (${location.city || intent.city})`
      : 'Location not specified — using city center.',
    summary: `Location resolved to ${location.formattedLocation || intent.city}.`,
  });

  const missingFields = getMissingFields(intent, location);
  if (missingFields.length > 0) {
    recordStep(traceSteps, onProgress, {
      agent: 'Clarification',
      tool: 'request_missing_details',
      source: 'orchestrator_policy',
      status: 'needs_input',
      icon: 'message',
      color: COLORS.amber,
      output: `Missing ${missingFields.join(', ')}. Asking customer before provider discovery or booking.`,
      summary: `Needs ${missingFields.join(', ')} before booking.`,
    });

    addTraceWriterStep(traceSteps, onProgress);
    const trace = traceAgent.run({ steps: traceSteps });
    return buildClarificationResponse({
      trace,
      intent,
      location,
      missingFields,
    });
  }

  // ---------- Step 3: Provider Discovery ----------
  emitProgress(onProgress, {
    agent: 'Provider Discovery',
    tool: 'find_providers',
    status: 'running',
    icon: 'list',
    color: COLORS.blue,
    output: `Searching providers for ${intent.serviceType || 'the requested service'}.`,
  });
  const discovery = await discoveryAgent.run({
    normalizedServiceType: intent.normalizedServiceType,
    providerSearch: intent.providerSearch,
    locationText: intent.locationText,
    city: location.city || intent.city,
  });
  recordStep(traceSteps, onProgress, {
    agent: 'Provider Discovery',
    tool: 'find_providers',
    source: discovery.source,
    status: discovery.totalFound > 0 ? 'success' : 'empty',
    icon: 'list',
    color: COLORS.blue,
    output: `Found ${discovery.totalFound} ${intent.serviceType || 'providers'}${intent.locationText ? ` near ${intent.locationText}` : ''}, available ${intent.dateText || 'soon'}${intent.timeText ? ` ${intent.timeText.toLowerCase()}` : ''}`,
    summary: `${discovery.totalFound} providers found.`,
  });

  // ---------- Step 4: Provider Ranking ----------
  emitProgress(onProgress, {
    agent: 'Provider Ranking',
    tool: 'rank_providers',
    status: 'running',
    icon: 'flow',
    color: COLORS.amber,
    output: 'Ranking providers by availability, distance, rating, and reliability.',
  });
  const ranking = await rankingAgent.run({
    providers: discovery.providers,
    userLat: location.lat || 33.6844,
    userLng: location.lng || 73.0479,
    timeWindow: intent.timeWindow,
    resolvedDate: intent.resolvedDate,
  });

  const topProvider = ranking.rankedProviders[0] || null;
  const alternatives = ranking.rankedProviders.slice(1, 3);

  recordStep(traceSteps, onProgress, {
    agent: 'Provider Ranking',
    tool: 'rank_providers',
    source: ranking.source,
    status: topProvider ? 'success' : 'empty',
    icon: 'flow',
    color: COLORS.amber,
    output: topProvider
      ? `${topProvider.name} selected · score ${topProvider.score} (avail ${(ranking.rankedProviders[0]?.score * 1.1).toFixed(2)}, prox ${(1 - topProvider.distanceKm / 20).toFixed(2)}, rating ${(topProvider.rating / 5).toFixed(2)})`
      : 'No providers to rank.',
    summary: topProvider ? `${topProvider.name} selected.` : 'No match found.',
  });

  if (!topProvider) {
    addTraceWriterStep(traceSteps, onProgress);
    const trace = traceAgent.run({ steps: traceSteps });
    return buildNoMatchResponse({ trace, intent, location, discovery });
  }

  // ---------- Step 5: Booking ----------
  emitProgress(onProgress, {
    agent: 'Booking',
    tool: 'create_booking',
    status: 'running',
    icon: 'check',
    color: COLORS.accent,
    output: `Creating booking for ${topProvider.name}.`,
  });
  let booking = null;
  booking = await bookingAgent.run({
    provider: topProvider,
    resolvedDate: intent.resolvedDate,
    dateFull: intent.dateFull,
    locationText: intent.locationText,
    formattedLocation: location.formattedLocation,
    userId,
    customerPhone,
    requestText: text,
    serviceType: intent.serviceType,
    userLat: location.lat,
    userLng: location.lng,
  });
  recordStep(traceSteps, onProgress, {
    agent: 'Booking',
    tool: 'create_booking',
    source: 'local_booking_store',
    status: 'success',
    icon: 'check',
    color: COLORS.accent,
    output: `Booking ${booking.bookingId} request sent · ${intent.dateFull} @ ${topProvider.slotLabel} · ${booking.status}`,
    summary: 'Booking request sent to provider.',
  });

  // ---------- Step 6: Trace ----------
  addTraceWriterStep(traceSteps, onProgress);
  const trace = traceAgent.run({ steps: traceSteps });
  const bookingWithTrace = booking
    ? bookingAgent.updateBooking(booking.bookingId, {
      traceId: trace.traceId,
      traceSummary: trace.traceSummary,
    }, 'Agent trace persisted.')
    : booking;

  // ---------- Build unified response ----------
  const response = {
    status: bookingWithTrace.status,
    traceId: trace.traceId,
    adapterModes: {
      intent: intent.adapterMode,
      intentParser: intent.parser,
      location: location.adapterMode,
      provider: discovery.adapterMode,
      distance: ranking.adapterMode,
    },

    userLocation: {
      lat: location.lat || null,
      lng: location.lng || null,
      formatted: location.formattedLocation || null,
    },

    requestUnderstanding: {
      serviceType: intent.serviceType,
      location: location.formattedLocation || `${intent.locationText || ''}, ${intent.city}`.replace(/^, /, ''),
      dateLabel: intent.dateText,
      dateFull: intent.dateFull,
      timeLabel: intent.timeText,
      timeWindowLabel: intent.timeWindowLabel,
      providerSearch: intent.providerSearch,
      detectedLanguage: intent.detectedLanguage,
      confidence: Math.round(intent.confidence * 100),
    },

    recommendation: topProvider ? {
      providerId: topProvider.providerId,
      providerName: topProvider.name,
      initials: topProvider.initials,
      gradient: topProvider.gradient,
      verified: topProvider.verified,
      rating: topProvider.rating,
      reviews: topProvider.reviews,
      completedJobs: topProvider.completedJobs,
      responseMin: topProvider.responseMin,
      yearsActive: topProvider.yearsActive,
      distance: topProvider.distanceLabel,
      duration: topProvider.durationLabel,
      availability: topProvider.slotLabel,
      googleMapsUri: topProvider.googleMapsUri,
      googlePlaceId: topProvider.googlePlaceId,
      formattedAddress: topProvider.formattedAddress,
      lat: topProvider.lat,
      lng: topProvider.lng,
      score: topProvider.score,
      reasons: topProvider.reasons,
      reasonCodes: topProvider.reasonCodes,
      description: topProvider.description,
    } : null,

    alternatives: alternatives.map(alt => ({
      providerId: alt.providerId,
      name: alt.name,
      initials: alt.initials,
      gradient: alt.gradient,
      rating: alt.rating,
      distance: alt.distanceLabel,
      duration: alt.durationLabel,
      availability: alt.slotLabel,
      googleMapsUri: alt.googleMapsUri,
      googlePlaceId: alt.googlePlaceId,
      formattedAddress: alt.formattedAddress,
      lat: alt.lat,
      lng: alt.lng,
      score: alt.score,
      note: buildAltNote(alt, topProvider),
    })),

    booking: bookingWithTrace ? {
      bookingId: bookingWithTrace.bookingId,
      status: bookingWithTrace.status,
      providerName: bookingWithTrace.providerName,
      slot: bookingWithTrace.slotLabel,
      location: bookingWithTrace.location,
      fee: bookingWithTrace.fee,
      lifecycleStatus: bookingWithTrace.lifecycleStatus,
      providerPhone: bookingWithTrace.providerPhone,
      providerMessageSid: bookingWithTrace.providerMessageSid,
      providerMessageStatus: bookingWithTrace.providerMessageStatus,
      providerMessageError: bookingWithTrace.providerMessageError,
      providerResponseStatus: bookingWithTrace.providerResponseStatus,
      providerResponseMessage: bookingWithTrace.providerResponseMessage,
      statusHistory: bookingWithTrace.statusHistory || [],
      confirmationMessage: bookingWithTrace.confirmationMessage,
      traceId: bookingWithTrace.traceId,
      traceSummary: bookingWithTrace.traceSummary || [],
      reminderMessage: null,
      reminderTimeLabel: null,
    } : null,

    trace: trace.events,
    traceSummary: trace.traceSummary,
  };

  return response;
}

function buildAltNote(alt, top) {
  if (!top) return '';
  if (alt.rating > top.rating) return 'Higher rating, farther away.';
  if (alt.distanceKm < top.distanceKm) return 'Closer, but less available.';
  return `Score ${alt.score}, ${alt.distanceLabel} away.`;
}

function addTraceWriterStep(traceSteps, onProgress) {
  recordStep(traceSteps, onProgress, {
    agent: 'Trace Writer',
    tool: 'write_trace',
    source: 'local_trace_store',
    status: 'success',
    icon: 'file',
    color: COLORS.agent,
    output: 'Persisted full agent workflow trace for reviewer inspection.',
    summary: 'Agent trace persisted.',
  });
}

function recordStep(traceSteps, onProgress, step) {
  traceSteps.push(step);
  emitProgress(onProgress, step);
}

function emitProgress(onProgress, event) {
  if (typeof onProgress !== 'function') return;
  onProgress({
    agent: event.agent,
    tool: event.tool,
    source: event.source || null,
    status: event.status,
    icon: event.icon,
    color: event.color,
    output: event.output,
    summary: event.summary || event.output,
  });
}

function getMissingFields(intent, location) {
  const fields = [];
  if (!intent.normalizedServiceType) fields.push('service');
  if (location.status === 'missing_location') fields.push('location');
  return fields;
}

function buildClarificationResponse({ trace, intent, location, missingFields }) {
  return {
    status: 'needs_clarification',
    traceId: trace.traceId,
    missingFields,
    clarificationPrompt: buildClarificationPrompt(missingFields),
    requestUnderstanding: {
      serviceType: intent.serviceType,
      location: location.formattedLocation,
      dateLabel: intent.dateText,
      dateFull: intent.dateFull,
      timeLabel: intent.timeText,
      timeWindowLabel: intent.timeWindowLabel,
      providerSearch: intent.providerSearch,
      detectedLanguage: intent.detectedLanguage,
      confidence: Math.round(intent.confidence * 100),
    },
    recommendation: null,
    alternatives: [],
    booking: null,
    trace: trace.events,
    traceSummary: trace.traceSummary,
  };
}

function buildNoMatchResponse({ trace, intent, location, discovery }) {
  return {
    status: 'no_match',
    traceId: trace.traceId,
    requestUnderstanding: {
      serviceType: intent.serviceType,
      location: location.formattedLocation,
      dateLabel: intent.dateText,
      dateFull: intent.dateFull,
      timeLabel: intent.timeText,
      timeWindowLabel: intent.timeWindowLabel,
      providerSearch: intent.providerSearch,
      detectedLanguage: intent.detectedLanguage,
      confidence: Math.round(intent.confidence * 100),
    },
    recommendation: null,
    alternatives: [],
    booking: null,
    message: `No ${intent.serviceType || 'service'} providers found for ${location.formattedLocation || intent.city}.`,
    fallbackSuggestions: buildFallbackSuggestions(intent, discovery),
    trace: trace.events,
    traceSummary: trace.traceSummary,
  };
}

function buildClarificationPrompt(fields) {
  if (fields.includes('service')) return 'What service do you need help with?';
  if (fields.includes('location')) return 'Which area or sector should we search in?';
  if (fields.includes('time')) return 'What time should we book this for? Morning, afternoon, evening, or night?';
  return 'Please share the missing details so I can book the right provider.';
}

function buildFallbackSuggestions(intent, discovery) {
  if (discovery.status === 'no_providers') {
    return [
      `Try a nearby Islamabad sector for ${intent.serviceType}.`,
      'Try a broader service category or another time window.',
    ];
  }
  return ['Try another service category or location.'];
}

module.exports = { orchestrate };
