const assert = require('node:assert/strict');
const test = require('node:test');

const { orchestrate } = require('../src/services/orchestrator');
const intentAgent = require('../src/agents/intentAgent');
const locationAgent = require('../src/agents/locationAgent');
const bookingAgent = require('../src/agents/bookingAgent');
const traceAgent = require('../src/agents/traceAgent');

test('Roman Urdu AC request creates a confirmed booking and trace', async () => {
  const result = await orchestrate({
    userId: 'test-user',
    text: 'Mujhe kal subah G-13 mein AC technician chahiye',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.requestUnderstanding.serviceType, 'AC Technician');
  assert.equal(result.requestUnderstanding.location, 'G-13, Islamabad');
  assert.equal(result.recommendation.providerName, 'Ali AC Services');
  assert.equal(result.booking.status, 'confirmed');
  assert.ok(result.booking.bookingId.startsWith('BK-'));
  assert.ok(result.booking.reminderMessage.includes('Reminder set'));
  assert.ok(result.trace.length >= 6);
});

test('missing location returns clarification instead of booking', async () => {
  const result = await orchestrate({
    text: 'Need electrician today',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'needs_clarification');
  assert.deepEqual(result.missingFields, ['location', 'time']);
  assert.equal(result.booking, null);
  assert.equal(result.recommendation, null);
});

test('missing time returns clarification instead of booking', async () => {
  const result = await orchestrate({
    text: 'Need beautician in F-11',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'needs_clarification');
  assert.deepEqual(result.missingFields, ['time']);
  assert.equal(result.booking, null);
});

test('bookings and traces are persisted in local JSON store', async () => {
  const result = await orchestrate({
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'confirmed');
  assert.ok(bookingAgent.getBooking(result.booking.bookingId));
  assert.ok(traceAgent.getTrace(result.traceId));
});

test('location can drive city-specific provider discovery', async () => {
  const result = await orchestrate({
    text: 'Need electrician in Satellite Town today morning',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'confirmed');
  assert.equal(result.requestUnderstanding.location, 'Satellite Town, Rawalpindi');
  assert.equal(result.recommendation.providerName, 'Quick Bijli Works');
});

test('intent google mode uses llm extraction with rule normalization', async () => {
  const originalFetch = global.fetch;
  process.env.INTENT_MODE = 'google';
  process.env.GEMINI_API_KEY = 'test-key';

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              serviceType: 'Electrician',
              normalizedServiceType: 'electrician',
              locationText: 'f-10',
              city: 'Islamabad',
              dateText: 'Friday',
              resolvedDate: '2026-05-22',
              timeText: 'Evening',
              timeWindow: { start: '15:00', end: '19:00' },
              detectedLanguage: 'English',
              confidence: 0.91,
            }),
          }],
        },
      }],
    }),
  });

  try {
    const result = await intentAgent.run({
      text: 'Can you send someone for lights issue in F-10 this evening',
      cityHint: 'Islamabad',
    });

    assert.equal(result.parser, 'llm+rules');
    assert.equal(result.normalizedServiceType, 'electrician');
    assert.equal(result.locationText, 'F-10');
    assert.equal(result.resolvedDate, '2026-05-22');
    assert.equal(result.dateText, 'Friday');
    assert.equal(result.timeText, 'Evening');
    assert.equal(result.source, 'google_intent');
  } finally {
    global.fetch = originalFetch;
    delete process.env.INTENT_MODE;
    delete process.env.GEMINI_API_KEY;
  }
});

test('orchestrate hybrid mode falls back to rules when llm fails', async () => {
  const originalFetch = global.fetch;
  process.env.INTENT_MODE = 'hybrid';
  process.env.GEMINI_API_KEY = 'test-key';

  global.fetch = async () => ({
    ok: false,
    status: 500,
    text: async () => 'server error',
  });

  try {
    const result = await orchestrate({
      text: 'Mujhe kal subah G-13 mein AC technician chahiye',
      cityHint: 'Islamabad',
    });

    assert.equal(result.status, 'confirmed');
    assert.equal(result.adapterModes.intent, 'hybrid');
    assert.equal(result.adapterModes.intentParser, 'rules');
    assert.equal(result.requestUnderstanding.serviceType, 'AC Technician');
  } finally {
    global.fetch = originalFetch;
    delete process.env.INTENT_MODE;
    delete process.env.GEMINI_API_KEY;
  }
});

test('orchestrate google mode fails when llm is not configured', async () => {
  process.env.INTENT_MODE = 'google';
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_GEMINI_API_KEY;

  try {
    await assert.rejects(
      () => orchestrate({
        text: 'Need plumber in F-10 today evening',
        cityHint: 'Islamabad',
      }),
      /not_configured/
    );
  } finally {
    delete process.env.INTENT_MODE;
  }
});

test('location google mode resolves with Google Geocoding response', async () => {
  const originalFetch = global.fetch;
  process.env.LOCATION_MODE = 'google';
  process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';

  global.fetch = async (url) => {
    const href = String(url);
    assert.ok(href.startsWith('https://maps.googleapis.com/maps/api/geocode/json'));
    assert.ok(href.includes('address=G-13'));
    assert.ok(href.includes('components=country%3APK'));
    assert.ok(href.includes('region=pk'));
    return {
      ok: true,
      json: async () => ({
        status: 'OK',
        results: [{
          formatted_address: 'G-13, Islamabad, Pakistan',
          place_id: 'google-place-g13',
          geometry: {
            location: { lat: 33.6469, lng: 72.9615 },
            location_type: 'APPROXIMATE',
          },
          address_components: [
            { long_name: 'Islamabad', types: ['locality'] },
            { long_name: 'Pakistan', types: ['country'] },
          ],
        }],
      }),
    };
  };

  try {
    const result = await locationAgent.run({
      locationText: 'G-13',
      city: 'Islamabad',
    });

    assert.equal(result.source, 'google_location');
    assert.equal(result.adapterMode, 'google');
    assert.equal(result.formattedLocation, 'G-13, Islamabad, Pakistan');
    assert.equal(result.lat, 33.6469);
    assert.equal(result.lng, 72.9615);
    assert.equal(result.city, 'Islamabad');
    assert.equal(result.placeId, 'google-place-g13');
  } finally {
    global.fetch = originalFetch;
    delete process.env.LOCATION_MODE;
    delete process.env.GOOGLE_GEOCODING_API_KEY;
  }
});

test('location google mode fails when geocoding key is not configured', async () => {
  process.env.LOCATION_MODE = 'google';
  delete process.env.GOOGLE_GEOCODING_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_PLACES_API_KEY;

  try {
    await assert.rejects(
      () => locationAgent.run({ locationText: 'G-13', city: 'Islamabad' }),
      /not_configured/
    );
  } finally {
    delete process.env.LOCATION_MODE;
  }
});

test('orchestrate hybrid location falls back to mock when Google geocoding fails', async () => {
  const originalFetch = global.fetch;
  process.env.LOCATION_MODE = 'hybrid';
  process.env.GOOGLE_GEOCODING_API_KEY = 'test-key';

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      status: 'REQUEST_DENIED',
      error_message: 'API disabled',
    }),
  });

  try {
    const result = await orchestrate({
      text: 'Need plumber in F-10 today evening',
      cityHint: 'Islamabad',
    });

    assert.equal(result.status, 'confirmed');
    assert.equal(result.adapterModes.location, 'hybrid');
    assert.equal(result.requestUnderstanding.location, 'F-10, Islamabad');
  } finally {
    global.fetch = originalFetch;
    delete process.env.LOCATION_MODE;
    delete process.env.GOOGLE_GEOCODING_API_KEY;
  }
});
