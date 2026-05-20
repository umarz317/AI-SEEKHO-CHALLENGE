const { getMode } = require('../tools/mode');

async function executeAdapter(type, mockImpl, googleImpl, ...args) {
  const mode = getMode(`${type.toUpperCase()}_MODE`);
  const mockFallback = async (reason) => {
    const result = await mockImpl(...args);
    return { ...result, source: `mock_${type}_fallback_${reason}`, adapterMode: mode };
  };

  if (mode === 'google' || mode === 'hybrid') {
    try {
      const result = await googleImpl(...args);
      return { ...result, source: `google_${type}`, adapterMode: mode };
    } catch (e) {
      if (e.message === 'not_configured') {
        const reason = mode === 'google' ? 'google_unconfigured' : 'from_hybrid';
        return mockFallback(reason);
      }
      throw e;
    }
  }

  // mock mode
  const result = await mockImpl(...args);
  return { ...result, source: `mock_${type}`, adapterMode: 'mock' };
}

const stubs = {
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

module.exports = { executeAdapter, stubs };
