// tools/mode.js — adapter mode helpers for mock-first orchestration

function getMode(name, fallback = 'mock') {
  return (process.env[name] || fallback).toLowerCase();
}

async function runWithAdapter(type, mockImpl, googleImpl, ...args) {
  const mode = getMode(`${type.toUpperCase()}_MODE`);

  if (mode === 'google') {
    const res = await googleImpl(...args);
    return { ...res, source: `google_${type}`, adapterMode: mode };
  }

  if (mode === 'hybrid') {
    try {
      const res = await googleImpl(...args);
      return { ...res, source: `google_${type}`, adapterMode: mode };
    } catch (e) {
      debugAdapterFallback(type, e);
      const mockRes = await mockImpl(...args);
      return {
        ...mockRes,
        source: `mock_${type}_fallback_from_hybrid`,
        adapterMode: mode,
        fallbackReason: e.message || 'google_adapter_failed',
      };
    }
  }

  // mock mode
  const mockRes = await mockImpl(...args);
  return { ...mockRes, source: `mock_${type}`, adapterMode: 'mock' };
}

function debugAdapterFallback(type, error) {
  if (process.env.DEBUG_GOOGLE_RESPONSE !== 'true' &&
      process.env.DEBUG_ADAPTER_FALLBACK !== 'true') return;
  console.log('[adapter:fallback]', JSON.stringify({
    adapter: type,
    mode: 'hybrid',
    reason: error.message || 'google_adapter_failed',
  }, null, 2));
}

const googleStubs = {
  intent: async () => {
    if (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_GEMINI_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  },
  location: async () => {
    if (!process.env.GOOGLE_GEOCODING_API_KEY &&
        !process.env.GOOGLE_MAPS_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  },
  discovery: async () => {
    if (!process.env.GOOGLE_PLACES_API_KEY &&
        !process.env.GOOGLE_MAPS_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  },
  distance: async () => {
    if (!process.env.GOOGLE_ROUTES_API_KEY &&
        !process.env.GOOGLE_MAPS_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  },
  booking: async () => {
    if (!process.env.GOOGLE_FIRESTORE_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  },
  notification: async () => {
    if (!process.env.GOOGLE_FCM_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  },
  reminder: async () => {
    if (!process.env.GOOGLE_CLOUD_TASKS_API_KEY) throw new Error('not_configured');
    return { status: 'google_stub_called' };
  }
};

module.exports = { getMode, runWithAdapter, googleStubs };
