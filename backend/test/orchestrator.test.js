const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');

const { orchestrate } = require('../src/services/orchestrator');
const routes = require('../src/routes/orchestrate');
const intentAgent = require('../src/agents/intentAgent');
const locationAgent = require('../src/agents/locationAgent');
const discoveryAgent = require('../src/agents/discoveryAgent');
const rankingAgent = require('../src/agents/rankingAgent');
const bookingAgent = require('../src/agents/bookingAgent');
const followUpAgent = require('../src/agents/followUpAgent');
const reminderScheduler = require('../src/services/reminderScheduler');
const { registerPushToken } = require('../src/services/pushNotifications');
const traceAgent = require('../src/agents/traceAgent');
const store = require('../src/storage/localStore');

function makeTestApp() {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use('/api', routes);
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve({
        server,
        url: `http://127.0.0.1:${server.address().port}`,
      });
    });
  });
}

async function makeConfirmedBooking({ userId = `chat-user-${Date.now()}`, text = 'Need plumber in F-10 today evening' } = {}) {
  const result = await orchestrate({ userId, text, cityHint: 'Islamabad' });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const app = makeTestApp();
  const { server, url } = await listen(app);
  await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      MessageSid: `SM_ACCEPT_${result.booking.bookingId}`,
      From: 'whatsapp:+15550000000',
      To: 'whatsapp:+15551111111',
      Body: `YES ${result.booking.bookingId}`,
    }),
  });
  await new Promise((resolve) => server.close(resolve));
  return bookingAgent.getBooking(result.booking.bookingId);
}

test.beforeEach(() => {
  process.env.TWILIO_FAKE_SEND = 'true';
  process.env.EXPO_PUSH_FAKE_SEND = 'true';
  process.env.PROVIDER_TEST_WHATSAPP_TO = '+15550000000';
  process.env.TWILIO_VALIDATE_SIGNATURE = 'false';
});

test('Roman Urdu AC request creates a pending provider booking and trace', async () => {
  const result = await orchestrate({
    userId: 'test-user',
    text: 'Mujhe kal subah G-13 mein AC technician chahiye',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'pending_user_confirmation');
  assert.equal(result.requestUnderstanding.serviceType, 'AC Technician');
  assert.equal(result.requestUnderstanding.location, 'G-13, Islamabad');
  assert.equal(result.recommendation.providerName, 'Ali AC Services');
  assert.equal(result.booking.status, 'pending_user_confirmation');
  assert.equal(result.booking.lifecycleStatus, 'created');
  assert.ok(result.booking.bookingId.startsWith('BK-'));
  assert.equal(result.booking.reminderMessage, null);
  assert.ok(result.trace.length >= 6);
});

test('missing location returns clarification instead of booking', async () => {
  const result = await orchestrate({
    text: 'Need electrician today',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'needs_clarification');
  assert.deepEqual(result.missingFields, ['location']);
  assert.equal(result.booking, null);
  assert.equal(result.recommendation, null);
});

test('missing time still produces a booking (time is optional)', async () => {
  const result = await orchestrate({
    text: 'Need beautician in F-11',
    cityHint: 'Islamabad',
  });

  assert.notEqual(result.status, 'needs_clarification');
  assert.ok(result.recommendation, 'recommendation should be returned without a time window');
  assert.ok(result.booking, 'booking should be created without a time window');
});

test('bookings and traces are persisted in local JSON store', async () => {
  const result = await orchestrate({
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'pending_user_confirmation');
  assert.ok(bookingAgent.getBooking(result.booking.bookingId));
  assert.ok(traceAgent.getTrace(result.traceId));
});

test('location can drive city-specific provider discovery', async () => {
  const result = await orchestrate({
    text: 'Need electrician in Satellite Town today morning',
    cityHint: 'Islamabad',
  });

  assert.equal(result.status, 'pending_user_confirmation');
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
    assert.equal(result.providerSearch.label, 'residential electrician electrical repair');
    assert.equal(result.source, 'google_intent');
  } finally {
    global.fetch = originalFetch;
    delete process.env.INTENT_MODE;
    delete process.env.GEMINI_API_KEY;
  }
});

test('intent rules build provider search profile for home AC', () => {
  const result = intentAgent.parseWithRules({
    text: 'Mujhe kal subah G-13 mein AC technician chahiye',
    cityHint: 'Islamabad',
  });

  assert.equal(result.normalizedServiceType, 'ac_technician');
  assert.equal(result.providerSearch.label, 'home air conditioner repair HVAC technician');
  assert.ok(result.providerSearch.excludeTerms.includes('car'));
  assert.ok(result.providerSearch.excludeTerms.includes('garage'));
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

    assert.equal(result.status, 'pending_user_confirmation');
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

    assert.equal(result.status, 'pending_user_confirmation');
    assert.equal(result.adapterModes.location, 'hybrid');
    assert.equal(result.requestUnderstanding.location, 'F-10, Islamabad');
  } finally {
    global.fetch = originalFetch;
    delete process.env.LOCATION_MODE;
    delete process.env.GOOGLE_GEOCODING_API_KEY;
  }
});

test('provider mock mode does not call fetch', async () => {
  const originalFetch = global.fetch;
  process.env.PROVIDER_MODE = 'mock';
  global.fetch = async () => {
    throw new Error('fetch_should_not_be_called');
  };

  try {
    const result = await discoveryAgent.run({
      normalizedServiceType: 'plumber',
      locationText: 'F-10',
      city: 'Islamabad',
    });

    assert.equal(result.source, 'mock_provider');
    assert.equal(result.adapterMode, 'mock');
    assert.ok(result.providers.length > 0);
  } finally {
    global.fetch = originalFetch;
    delete process.env.PROVIDER_MODE;
  }
});

test('provider google mode maps Places Text Search response into rankable providers', async () => {
  const originalFetch = global.fetch;
  process.env.PROVIDER_MODE = 'google';
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  process.env.GOOGLE_PROVIDER_LIMIT = '2';

  global.fetch = async (url, options) => {
    assert.equal(url, 'https://places.googleapis.com/v1/places:searchText');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-Goog-Api-Key'], 'test-key');
    assert.ok(options.headers['X-Goog-FieldMask'].includes('places.displayName'));
    const body = JSON.parse(options.body);
    assert.equal(body.textQuery, 'plumber near F-10, Islamabad, Pakistan');
    assert.equal(body.regionCode, 'PK');
    assert.equal(body.pageSize, 2);

    return {
      ok: true,
      json: async () => ({
        places: [{
          id: 'places/plumber-1',
          displayName: { text: 'Google Pipe Works' },
          formattedAddress: 'F-10, Islamabad, Pakistan',
          location: { latitude: 33.67, longitude: 73.0 },
          rating: 4.6,
          userRatingCount: 123,
          priceLevel: 'PRICE_LEVEL_MODERATE',
          businessStatus: 'OPERATIONAL',
          types: ['plumber', 'point_of_interest'],
          googleMapsUri: 'https://maps.google.com/?cid=1',
        }],
      }),
    };
  };

  try {
    const result = await discoveryAgent.run({
      normalizedServiceType: 'plumber',
      locationText: 'F-10',
      city: 'Islamabad',
    });

    assert.equal(result.source, 'google_provider');
    assert.equal(result.adapterMode, 'google');
    assert.equal(result.totalFound, 1);
    assert.equal(result.providers[0].id, 'google:places/plumber-1');
    assert.equal(result.providers[0].name, 'Google Pipe Works');
    assert.equal(result.providers[0].category, 'plumber');
    assert.equal(result.providers[0].areasServed[0], 'F-10');
    assert.equal(result.providers[0].lat, 33.67);
    assert.equal(result.providers[0].lng, 73.0);
    assert.equal(result.providers[0].rating, 4.6);
    assert.equal(result.providers[0].completedJobs, 123);
    assert.equal(result.providers[0].responseRate, 0.82);
    assert.equal(result.providers[0].verificationStatus, 'verified');
    assert.equal(result.providers[0].priceLevel, 'medium');
    assert.equal(result.providers[0].googleMapsUri, 'https://maps.google.com/?cid=1');
    assert.ok(result.providers[0].availableSlots.length > 0);
    assert.equal(result.providers[0].source, 'google_places');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PROVIDER_MODE;
    delete process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PROVIDER_LIMIT;
  }
});

test('provider google mode uses providerSearch profile and filters car AC results', async () => {
  const originalFetch = global.fetch;
  process.env.PROVIDER_MODE = 'google';
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';

  global.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.textQuery, 'home air conditioner repair HVAC technician near G-13, Islamabad, Pakistan');

    return {
      ok: true,
      json: async () => ({
        places: [
          {
            id: 'places/car-ac',
            displayName: { text: 'Ahmed Car AC Workshop' },
            formattedAddress: 'G-13, Islamabad, Pakistan',
            location: { latitude: 33.67, longitude: 73.0 },
            rating: 4.9,
            userRatingCount: 300,
            businessStatus: 'OPERATIONAL',
            types: ['car_repair', 'point_of_interest'],
          },
          {
            id: 'places/home-ac',
            displayName: { text: 'Capital Home AC Repair' },
            formattedAddress: 'G-13, Islamabad, Pakistan',
            location: { latitude: 33.68, longitude: 73.01 },
            rating: 4.7,
            userRatingCount: 120,
            businessStatus: 'OPERATIONAL',
            types: ['point_of_interest', 'establishment'],
          },
        ],
      }),
    };
  };

  try {
    const result = await discoveryAgent.run({
      normalizedServiceType: 'ac_technician',
      providerSearch: intentAgent.buildProviderSearchProfile('ac_technician'),
      locationText: 'G-13',
      city: 'Islamabad',
    });

    assert.equal(result.totalFound, 1);
    assert.equal(result.providers[0].name, 'Capital Home AC Repair');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PROVIDER_MODE;
    delete process.env.GOOGLE_PLACES_API_KEY;
  }
});

test('provider google mode fails when Places key is not configured', async () => {
  process.env.PROVIDER_MODE = 'google';
  delete process.env.GOOGLE_PLACES_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;

  try {
    await assert.rejects(
      () => discoveryAgent.run({
        normalizedServiceType: 'plumber',
        locationText: 'F-10',
        city: 'Islamabad',
      }),
      /not_configured/
    );
  } finally {
    delete process.env.PROVIDER_MODE;
  }
});

test('provider google mode fails on HTTP, empty, and malformed Places responses', async () => {
  const originalFetch = global.fetch;
  process.env.PROVIDER_MODE = 'google';
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';

  try {
    global.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => 'denied',
    });
    await assert.rejects(
      () => discoveryAgent.run({ normalizedServiceType: 'plumber', locationText: 'F-10', city: 'Islamabad' }),
      /google_provider_http_403/
    );

    global.fetch = async () => ({
      ok: true,
      json: async () => ({ places: [] }),
    });
    await assert.rejects(
      () => discoveryAgent.run({ normalizedServiceType: 'plumber', locationText: 'F-10', city: 'Islamabad' }),
      /google_provider_empty_result/
    );

    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        places: [{
          id: 'places/bad',
          displayName: { text: 'Bad Provider' },
          location: { latitude: null, longitude: 73.0 },
        }],
      }),
    });
    await assert.rejects(
      () => discoveryAgent.run({ normalizedServiceType: 'plumber', locationText: 'F-10', city: 'Islamabad' }),
      /google_provider_malformed_place/
    );
  } finally {
    global.fetch = originalFetch;
    delete process.env.PROVIDER_MODE;
    delete process.env.GOOGLE_PLACES_API_KEY;
  }
});

test('orchestrate hybrid provider falls back to mock when Places fails', async () => {
  const originalFetch = global.fetch;
  process.env.PROVIDER_MODE = 'hybrid';
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';

  global.fetch = async () => ({
    ok: false,
    status: 403,
    text: async () => 'denied',
  });

  try {
    const result = await orchestrate({
      text: 'Need plumber in F-10 today evening',
      cityHint: 'Islamabad',
    });

    assert.equal(result.status, 'pending_user_confirmation');
    assert.equal(result.adapterModes.provider, 'hybrid');
    assert.equal(result.recommendation.providerName, 'Capital Pipe Masters');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PROVIDER_MODE;
    delete process.env.GOOGLE_PLACES_API_KEY;
  }
});

test('orchestrate google provider reaches ranking and booking using Places data', async () => {
  const originalFetch = global.fetch;
  process.env.PROVIDER_MODE = 'google';
  process.env.GOOGLE_PLACES_API_KEY = 'test-key';

  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      places: [{
        id: 'places/ac-1',
        displayName: { text: 'Google AC Experts' },
        formattedAddress: 'G-13, Islamabad, Pakistan',
        location: { latitude: 33.6501, longitude: 72.9702 },
        rating: 4.9,
        userRatingCount: 240,
        priceLevel: 'PRICE_LEVEL_MODERATE',
        businessStatus: 'OPERATIONAL',
        types: ['point_of_interest'],
        googleMapsUri: 'https://maps.google.com/?cid=2',
      }],
    }),
  });

  try {
    const result = await orchestrate({
      text: 'Mujhe kal subah G-13 mein AC technician chahiye',
      cityHint: 'Islamabad',
    });

    assert.equal(result.status, 'pending_user_confirmation');
    assert.equal(result.adapterModes.provider, 'google');
    assert.equal(result.recommendation.providerName, 'Google AC Experts');
    assert.equal(result.booking.providerName, 'Google AC Experts');
  } finally {
    global.fetch = originalFetch;
    delete process.env.PROVIDER_MODE;
    delete process.env.GOOGLE_PLACES_API_KEY;
  }
});

test('distance mock mode does not call fetch', async () => {
  const originalFetch = global.fetch;
  process.env.DISTANCE_MODE = 'mock';
  global.fetch = async () => {
    throw new Error('fetch_should_not_be_called');
  };

  try {
    const result = await rankingAgent.run({
      providers: [{
        id: 'p_test',
        name: 'Test Provider',
        category: 'plumber',
        lat: 33.67,
        lng: 73.0,
        rating: 4.6,
        completedJobs: 100,
        responseRate: 0.9,
        verificationStatus: 'verified',
        availableSlots: ['2026-05-17T16:00:00+05:00'],
      }],
      userLat: 33.66,
      userLng: 72.99,
      timeWindow: { start: '15:00', end: '19:00', label: 'Evening' },
      resolvedDate: '2026-05-17',
    });

    assert.equal(result.source, 'mock_distance');
    assert.equal(result.adapterMode, 'mock');
    assert.equal(result.rankedProviders.length, 1);
  } finally {
    global.fetch = originalFetch;
    delete process.env.DISTANCE_MODE;
  }
});

test('distance google mode uses Routes route matrix distances', async () => {
  const originalFetch = global.fetch;
  process.env.DISTANCE_MODE = 'google';
  process.env.GOOGLE_ROUTES_API_KEY = 'test-key';

  global.fetch = async (url, options) => {
    assert.equal(url, 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['X-Goog-Api-Key'], 'test-key');
    assert.equal(options.headers['X-Goog-FieldMask'], 'originIndex,destinationIndex,status,condition,distanceMeters,duration');
    const body = JSON.parse(options.body);
    assert.equal(body.travelMode, 'DRIVE');
    assert.equal(body.origins[0].waypoint.location.latLng.latitude, 33.66);
    assert.equal(body.destinations.length, 2);

    return {
      ok: true,
      json: async () => ([
        { originIndex: 0, destinationIndex: 0, condition: 'ROUTE_EXISTS', distanceMeters: 9000, duration: '1200s' },
        { originIndex: 0, destinationIndex: 1, condition: 'ROUTE_EXISTS', distanceMeters: 2000, duration: '360s' },
      ]),
    };
  };

  try {
    const result = await rankingAgent.run({
      providers: [
        {
          id: 'far',
          name: 'Far Provider',
          category: 'plumber',
          lat: 33.8,
          lng: 73.2,
          rating: 4.9,
          completedJobs: 250,
          responseRate: 0.92,
          verificationStatus: 'verified',
          availableSlots: ['2026-05-17T16:00:00+05:00'],
        },
        {
          id: 'near',
          name: 'Near Provider',
          category: 'plumber',
          lat: 33.67,
          lng: 73.0,
          rating: 4.7,
          completedJobs: 200,
          responseRate: 0.9,
          verificationStatus: 'verified',
          availableSlots: ['2026-05-17T16:00:00+05:00'],
        },
      ],
      userLat: 33.66,
      userLng: 72.99,
      timeWindow: { start: '15:00', end: '19:00', label: 'Evening' },
      resolvedDate: '2026-05-17',
    });

    assert.equal(result.source, 'google_distance');
    assert.equal(result.adapterMode, 'google');
    assert.equal(result.rankedProviders[0].providerId, 'near');
    assert.equal(result.rankedProviders[0].distanceKm, 2);
    assert.equal(result.rankedProviders[0].durationLabel, '6 min');
  } finally {
    global.fetch = originalFetch;
    delete process.env.DISTANCE_MODE;
    delete process.env.GOOGLE_ROUTES_API_KEY;
  }
});

test('distance google mode fails when Routes key is not configured', async () => {
  process.env.DISTANCE_MODE = 'google';
  delete process.env.GOOGLE_ROUTES_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;

  try {
    await assert.rejects(
      () => rankingAgent.run({
        providers: [{ id: 'p', name: 'P', lat: 1, lng: 1, rating: 4, completedJobs: 1, responseRate: 0.8, availableSlots: [] }],
        userLat: 1,
        userLng: 1,
      }),
      /not_configured/
    );
  } finally {
    delete process.env.DISTANCE_MODE;
  }
});

test('distance google mode fails on HTTP, empty, and missing route elements', async () => {
  const originalFetch = global.fetch;
  process.env.DISTANCE_MODE = 'google';
  process.env.GOOGLE_ROUTES_API_KEY = 'test-key';
  const input = {
    providers: [{ id: 'p', name: 'P', lat: 1, lng: 1, rating: 4, completedJobs: 1, responseRate: 0.8, availableSlots: [] }],
    userLat: 1,
    userLng: 1,
  };

  try {
    global.fetch = async () => ({ ok: false, status: 403, text: async () => 'denied' });
    await assert.rejects(() => rankingAgent.run(input), /google_distance_http_403/);

    global.fetch = async () => ({ ok: true, json: async () => [] });
    await assert.rejects(() => rankingAgent.run(input), /google_distance_empty_result/);

    global.fetch = async () => ({
      ok: true,
      json: async () => ([{ originIndex: 0, destinationIndex: 0, condition: 'ROUTE_NOT_FOUND' }]),
    });
    await assert.rejects(() => rankingAgent.run(input), /google_distance_missing_element/);
  } finally {
    global.fetch = originalFetch;
    delete process.env.DISTANCE_MODE;
    delete process.env.GOOGLE_ROUTES_API_KEY;
  }
});

test('orchestrate hybrid distance falls back to Haversine when Routes fails', async () => {
  const originalFetch = global.fetch;
  process.env.DISTANCE_MODE = 'hybrid';
  process.env.GOOGLE_ROUTES_API_KEY = 'test-key';

  global.fetch = async () => ({ ok: false, status: 403, text: async () => 'denied' });

  try {
    const result = await orchestrate({
      text: 'Need plumber in F-10 today evening',
      cityHint: 'Islamabad',
    });

    assert.equal(result.status, 'pending_user_confirmation');
    assert.equal(result.adapterModes.distance, 'hybrid');
    assert.equal(result.recommendation.providerName, 'Capital Pipe Masters');
  } finally {
    global.fetch = originalFetch;
    delete process.env.DISTANCE_MODE;
    delete process.env.GOOGLE_ROUTES_API_KEY;
  }
});

test('orchestrate google distance reaches booking with Routes data', async () => {
  const originalFetch = global.fetch;
  process.env.DISTANCE_MODE = 'google';
  process.env.GOOGLE_ROUTES_API_KEY = 'test-key';

  global.fetch = async () => ({
    ok: true,
    json: async () => ([
      { originIndex: 0, destinationIndex: 0, condition: 'ROUTE_EXISTS', distanceMeters: 12000, duration: '1800s' },
      { originIndex: 0, destinationIndex: 1, condition: 'ROUTE_EXISTS', distanceMeters: 4000, duration: '600s' },
      { originIndex: 0, destinationIndex: 2, condition: 'ROUTE_EXISTS', distanceMeters: 3000, duration: '500s' },
      { originIndex: 0, destinationIndex: 3, condition: 'ROUTE_EXISTS', distanceMeters: 9000, duration: '1500s' },
    ]),
  });

  try {
    const result = await orchestrate({
      text: 'Mujhe kal subah G-13 mein AC technician chahiye',
      cityHint: 'Islamabad',
    });

    assert.equal(result.status, 'pending_user_confirmation');
    assert.equal(result.adapterModes.distance, 'google');
    assert.ok(result.recommendation.distance.includes('km'));
    assert.equal(result.booking.status, 'pending_user_confirmation');
  } finally {
    global.fetch = originalFetch;
    delete process.env.DISTANCE_MODE;
    delete process.env.GOOGLE_ROUTES_API_KEY;
  }
});

test('booking marks provider message failure when Twilio send is unavailable', async () => {
  delete process.env.TWILIO_FAKE_SEND;
  delete process.env.TWILIO_ACCOUNT_SID;
  delete process.env.TWILIO_AUTH_TOKEN;
  delete process.env.TWILIO_WHATSAPP_FROM;
  delete process.env.PROVIDER_TEST_WHATSAPP_TO;

  const result = await orchestrate({
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });

  const updatedBooking = await bookingAgent.confirmBooking(result.booking.bookingId);

  assert.equal(updatedBooking.status, 'provider_message_failed');
  assert.equal(updatedBooking.lifecycleStatus, 'provider_message_failed');
  assert.ok(updatedBooking.providerMessageError);
});

test('inbound provider YES reply confirms booking and schedules reminder', async () => {
  const result = await orchestrate({
    userId: 'reminder-user-yes',
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const body = new URLSearchParams({
      MessageSid: 'SM_IN_YES',
      From: 'whatsapp:+15550000000',
      To: 'whatsapp:+15551111111',
      Body: `YES ${result.booking.bookingId}`,
    });
    const response = await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), '<Response></Response>');

    const booking = bookingAgent.getBooking(result.booking.bookingId);
    assert.equal(booking.status, 'confirmed');
    assert.equal(booking.providerResponseStatus, 'accepted');
    assert.ok(booking.confirmedAt);
    const reminders = followUpAgent.getAllReminders().filter((reminder) => reminder.bookingId === booking.bookingId);
    assert.equal(reminders.length, 2);
    assert.ok(reminders.some((reminder) => reminder.recipientType === 'provider' && reminder.channel === 'twilio_whatsapp'));
    assert.ok(reminders.some((reminder) => reminder.recipientType === 'user' && reminder.channel === 'expo_push'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('due provider reminder sends via Twilio and marks sent', async () => {
  const result = await orchestrate({
    userId: 'reminder-user-provider',
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_IN_YES_PROVIDER_REMINDER',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `YES ${result.booking.bookingId}`,
      }),
    });

    const reminder = followUpAgent.getAllReminders()
      .find((row) => row.bookingId === result.booking.bookingId && row.recipientType === 'provider');
    store.updateById('reminders', 'reminderId', reminder.reminderId, {
      ...reminder,
      scheduledFor: new Date(Date.now() - 1000).toISOString(),
      reminderTime: new Date(Date.now() - 1000).toISOString(),
    });

    await reminderScheduler.processDueReminders();

    const updated = store.findById('reminders', 'reminderId', reminder.reminderId);
    assert.equal(updated.status, 'sent');
    assert.ok(updated.sentAt);
    assert.equal(updated.delivery.providerMessageSid, `SM_FAKE_REMINDER_${result.booking.bookingId}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('due user reminder sends via Expo push and marks sent', async () => {
  const result = await orchestrate({
    userId: 'reminder-user-push',
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });
  registerPushToken({ userId: 'reminder-user-push', token: 'ExponentPushToken[test]', platform: 'ios' });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_IN_YES_USER_REMINDER',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `YES ${result.booking.bookingId}`,
      }),
    });

    const reminder = followUpAgent.getAllReminders()
      .find((row) => row.bookingId === result.booking.bookingId && row.recipientType === 'user');
    store.updateById('reminders', 'reminderId', reminder.reminderId, {
      ...reminder,
      scheduledFor: new Date(Date.now() - 1000).toISOString(),
      reminderTime: new Date(Date.now() - 1000).toISOString(),
    });

    await reminderScheduler.processDueReminders();

    const updated = store.findById('reminders', 'reminderId', reminder.reminderId);
    assert.equal(updated.status, 'sent');
    assert.ok(updated.sentAt);
    assert.equal(updated.delivery.pushToken, 'ExponentPushToken[test]');
    assert.equal(updated.delivery.body.data.bookingId, result.booking.bookingId);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('due user reminder without push token is skipped', async () => {
  const result = await orchestrate({
    userId: 'reminder-user-no-token',
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_IN_YES_NO_TOKEN',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `YES ${result.booking.bookingId}`,
      }),
    });

    const reminder = followUpAgent.getAllReminders()
      .find((row) => row.bookingId === result.booking.bookingId && row.recipientType === 'user');
    store.updateById('reminders', 'reminderId', reminder.reminderId, {
      ...reminder,
      scheduledFor: new Date(Date.now() - 1000).toISOString(),
      reminderTime: new Date(Date.now() - 1000).toISOString(),
    });

    await reminderScheduler.processDueReminders();

    const updated = store.findById('reminders', 'reminderId', reminder.reminderId);
    assert.equal(updated.status, 'skipped');
    assert.equal(updated.error, 'push_token_not_registered');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('provider reminder Twilio failure marks failed without crashing scheduler', async () => {
  const result = await orchestrate({
    userId: 'reminder-user-provider-fail',
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_IN_YES_PROVIDER_FAIL',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `YES ${result.booking.bookingId}`,
      }),
    });

    const reminder = followUpAgent.getAllReminders()
      .find((row) => row.bookingId === result.booking.bookingId && row.recipientType === 'provider');
    store.updateById('reminders', 'reminderId', reminder.reminderId, {
      ...reminder,
      scheduledFor: new Date(Date.now() - 1000).toISOString(),
      reminderTime: new Date(Date.now() - 1000).toISOString(),
    });

    process.env.TWILIO_FAKE_SEND = 'false';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_WHATSAPP_FROM;

    await reminderScheduler.processDueReminders();

    const updated = store.findById('reminders', 'reminderId', reminder.reminderId);
    assert.equal(updated.status, 'failed');
    assert.equal(updated.error, 'twilio_not_configured');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('inbound provider NO reply rejects booking without scheduling reminder', async () => {
  const result = await orchestrate({
    text: 'Need plumber in F-10 today evening',
    cityHint: 'Islamabad',
  });
  await bookingAgent.confirmBooking(result.booking.bookingId);
  const beforeCount = followUpAgent.getAllReminders().length;
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const body = new URLSearchParams({
      MessageSid: 'SM_IN_NO',
      From: 'whatsapp:+15550000000',
      To: 'whatsapp:+15551111111',
      Body: `NO ${result.booking.bookingId}`,
    });
    const response = await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    assert.equal(response.status, 200);
    const booking = bookingAgent.getBooking(result.booking.bookingId);
    assert.equal(booking.status, 'rejected');
    assert.equal(booking.providerResponseStatus, 'rejected');
    assert.ok(booking.rejectedAt);
    assert.equal(followUpAgent.getAllReminders().length, beforeCount);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('inbound reply without booking code is recorded as unmatched', async () => {
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_NO_CODE',
        From: 'whatsapp:+15559999999',
        To: 'whatsapp:+15551111111',
        Body: 'yes I can come',
      }),
    });

    assert.equal(response.status, 200);
    assert.ok(store.list('inboundMessages').some((message) =>
      message.inboundMessageId === 'SM_NO_CODE' &&
      message.status === 'unmatched_missing_booking_code'
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('user chat message is stored and relayed to provider WhatsApp', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-send' });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/bookings/${booking.bookingId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Please call before arriving.' }),
    });

    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.message.senderType, 'user');
    assert.equal(payload.message.status, 'sent');
    assert.equal(payload.message.metadata.providerDelivery.providerMessageSid, `SM_FAKE_CHAT_${booking.bookingId}`);

    const stored = store.list('conversationMessages').find((message) => message.messageId === payload.message.messageId);
    assert.equal(stored.body, 'Please call before arriving.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('provider reply with booking code creates provider chat message', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-provider-code' });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_PROVIDER_CHAT_CODE',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `Please share the house number ${booking.bookingId}`,
      }),
    });

    assert.equal(response.status, 200);
    assert.ok(store.list('conversationMessages').some((message) =>
      message.bookingId === booking.bookingId &&
      message.senderType === 'provider' &&
      message.body.includes('house number')
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('provider reply without booking code matches latest active booking from same sender', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-provider-latest' });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_PROVIDER_CHAT_NO_CODE',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: 'I am near the market now',
      }),
    });

    assert.equal(response.status, 200);
    assert.ok(store.list('conversationMessages').some((message) =>
      message.bookingId === booking.bookingId &&
      message.senderType === 'provider' &&
      message.body === 'I am near the market now'
    ));
    assert.ok(store.list('inboundMessages').some((message) =>
      message.inboundMessageId === 'SM_PROVIDER_CHAT_NO_CODE' &&
      message.status.includes('latest_active')
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('provider proposed time creates pending reschedule action and assistant message', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-reschedule' });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_PROVIDER_RESCHEDULE',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `Can come at 2026-05-21T18:00:00+05:00 ${booking.bookingId}`,
      }),
    });

    const action = store.list('conversationActions').find((row) =>
      row.bookingId === booking.bookingId &&
      row.actionType === 'reschedule' &&
      row.status === 'pending'
    );
    assert.ok(action);
    assert.equal(action.proposedSlot, '2026-05-21T18:00:00+05:00');
    assert.ok(store.list('conversationMessages').some((message) =>
      message.bookingId === booking.bookingId &&
      message.senderType === 'assistant' &&
      message.metadata.actionId === action.actionId
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('provider YES approves user-initiated reschedule and updates booking', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-reschedule-provider-yes' });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const userResponse = await fetch(`${url}/api/bookings/${booking.bookingId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Reschedule to 4pm?' }),
    });
    assert.equal(userResponse.status, 201);

    const pendingAction = store.list('conversationActions').find((row) =>
      row.bookingId === booking.bookingId &&
      row.actionType === 'reschedule' &&
      row.status === 'pending' &&
      row.metadata?.initiatedBy === 'user'
    );
    assert.ok(pendingAction);
    assert.equal(pendingAction.proposedSlot, '4pm');

    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_PROVIDER_YES_USER_RESCHEDULE',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `Yes ${booking.bookingId}`,
      }),
    });

    const updatedAction = store.findById('conversationActions', 'actionId', pendingAction.actionId);
    assert.equal(updatedAction.status, 'approved');

    const updatedBooking = bookingAgent.getBooking(booking.bookingId);
    assert.equal(updatedBooking.lifecycleStatus, 'rescheduled_by_provider_acceptance');
    assert.ok(updatedBooking.slotLabel.toLowerCase().includes('4:00 pm'));
    assert.ok(store.list('conversationMessages').some((message) =>
      message.bookingId === booking.bookingId &&
      message.senderType === 'system' &&
      message.body.includes('Provider accepted your reschedule request')
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('approving reschedule updates booking, recreates reminders, and notifies provider', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-approve-reschedule' });
  const action = store.insert('conversationActions', {
    actionId: `ACT-${booking.bookingId}-manual-reschedule`,
    conversationId: `CONV-${booking.bookingId}`,
    bookingId: booking.bookingId,
    actionType: 'reschedule',
    proposedSlot: '2026-05-21T18:00:00+05:00',
    reason: 'Provider asked for a later slot.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/bookings/${booking.bookingId}/actions/${action.actionId}/approve`, {
      method: 'POST',
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.action.status, 'approved');

    const updatedBooking = bookingAgent.getBooking(booking.bookingId);
    assert.equal(updatedBooking.lifecycleStatus, 'rescheduled_by_user_approval');
    assert.equal(updatedBooking.slot, '2026-05-21T13:00:00.000Z');
    assert.ok(updatedBooking.slotLabel.toLowerCase().includes('6:00 pm'));

    const reminders = followUpAgent.getAllReminders().filter((row) => row.bookingId === booking.bookingId);
    assert.equal(reminders.length, 2);
    assert.ok(reminders.every((row) => row.status === 'scheduled'));
    assert.ok(store.list('conversationMessages').some((message) =>
      message.bookingId === booking.bookingId &&
      message.senderType === 'system' &&
      message.body.includes('approved')
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('provider cancellation request creates pending cancel action', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-cancel-request' });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        MessageSid: 'SM_PROVIDER_CANCEL',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: `Sorry I cannot come, please cancel ${booking.bookingId}`,
      }),
    });

    const action = store.list('conversationActions').find((row) =>
      row.bookingId === booking.bookingId &&
      row.actionType === 'cancel' &&
      row.status === 'pending'
    );
    assert.ok(action);
    assert.ok(store.list('conversationMessages').some((message) =>
      message.bookingId === booking.bookingId &&
      message.senderType === 'assistant' &&
      message.metadata.actionId === action.actionId
    ));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('approving cancel updates booking and skips scheduled reminders', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-approve-cancel' });
  const action = store.insert('conversationActions', {
    actionId: `ACT-${booking.bookingId}-manual-cancel`,
    conversationId: `CONV-${booking.bookingId}`,
    bookingId: booking.bookingId,
    actionType: 'cancel',
    proposedSlot: null,
    reason: 'Provider cannot come.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/bookings/${booking.bookingId}/actions/${action.actionId}/approve`, {
      method: 'POST',
    });

    assert.equal(response.status, 200);
    const updatedBooking = bookingAgent.getBooking(booking.bookingId);
    assert.equal(updatedBooking.status, 'cancelled');
    assert.equal(updatedBooking.lifecycleStatus, 'cancelled_by_user_approval');
    assert.ok(updatedBooking.cancelledAt);

    const reminders = followUpAgent.getAllReminders().filter((row) => row.bookingId === booking.bookingId);
    assert.ok(reminders.length >= 2);
    assert.ok(reminders.every((row) => row.status === 'skipped' && row.error === 'cancelled'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('rejecting pending action leaves booking unchanged', async () => {
  const booking = await makeConfirmedBooking({ userId: 'chat-user-reject-action' });
  const action = store.insert('conversationActions', {
    actionId: `ACT-${booking.bookingId}-manual-reject`,
    conversationId: `CONV-${booking.bookingId}`,
    bookingId: booking.bookingId,
    actionType: 'reschedule',
    proposedSlot: '2026-05-21T18:00:00+05:00',
    reason: 'Provider asked for a later slot.',
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/bookings/${booking.bookingId}/actions/${action.actionId}/reject`, {
      method: 'POST',
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.action.status, 'rejected');

    const updatedBooking = bookingAgent.getBooking(booking.bookingId);
    assert.equal(updatedBooking.slot, booking.slot);
    assert.equal(updatedBooking.lifecycleStatus, booking.lifecycleStatus);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('invalid Twilio signature is rejected when validation is enabled', async () => {
  process.env.TWILIO_VALIDATE_SIGNATURE = 'true';
  process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';
  process.env.PUBLIC_WEBHOOK_BASE_URL = 'https://example.com';

  const app = makeTestApp();
  const { server, url } = await listen(app);

  try {
    const response = await fetch(`${url}/api/webhooks/twilio/whatsapp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Twilio-Signature': 'invalid',
      },
      body: new URLSearchParams({
        MessageSid: 'SM_BAD_SIG',
        From: 'whatsapp:+15550000000',
        To: 'whatsapp:+15551111111',
        Body: 'YES BK-20260520-001',
      }),
    });

    assert.equal(response.status, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    process.env.TWILIO_VALIDATE_SIGNATURE = 'false';
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.PUBLIC_WEBHOOK_BASE_URL;
  }
});

test('ambiguous provider reply can use Gemini fallback parser', async () => {
  const originalFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{
            text: JSON.stringify({
              intent: 'accepted',
              confidence: 0.82,
              proposedSlot: null,
            }),
          }],
        },
      }],
    }),
  });

  const { parseProviderReply } = require('../src/services/providerReplyParser');
  try {
    const parsed = await parseProviderReply({ text: 'theek hai BK-20260520-001' });
    assert.equal(parsed.bookingId, 'BK-20260520-001');
    assert.equal(parsed.intent, 'accepted');
    assert.equal(parsed.parser, 'rules');

    const fallback = await parseProviderReply({ text: 'I might manage this BK-20260520-002' });
    assert.equal(fallback.intent, 'accepted');
    assert.equal(fallback.parser, 'gemini');
  } finally {
    global.fetch = originalFetch;
    delete process.env.GEMINI_API_KEY;
  }
});
