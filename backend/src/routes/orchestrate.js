// routes/orchestrate.js — API routes
const express = require('express');
const router = express.Router();
const { orchestrate } = require('../services/orchestrator');
const bookingAgent = require('../agents/bookingAgent');
const followUpAgent = require('../agents/followUpAgent');
const traceAgent = require('../agents/traceAgent');
const store = require('../storage/localStore');

/**
 * POST /api/orchestrate
 * Main endpoint — runs the full 7-agent pipeline
 */
router.post('/orchestrate', async (req, res) => {
  try {
    const { userId, text, cityHint, timezone } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'missing_text',
        message: 'Request text is required.',
      });
    }

    const result = await orchestrate({ userId, text, cityHint, timezone });
    res.json(result);
  } catch (err) {
    console.error('[orchestrate] Error:', err);
    res.status(500).json({
      error: 'orchestration_failed',
      message: err.message,
    });
  }
});

/**
 * GET /api/bookings
 * List all bookings
 */
router.get('/bookings', (req, res) => {
  res.json({ bookings: bookingAgent.getAllBookings() });
});

/**
 * GET /api/bookings/:id
 * Get a specific booking
 */
router.get('/bookings/:id', (req, res) => {
  const booking = bookingAgent.getBooking(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: 'not_found', message: 'Booking not found.' });
  }
  res.json(booking);
});

/**
 * GET /api/traces
 * List all traces
 */
router.get('/traces', (req, res) => {
  res.json({ traces: traceAgent.getAllTraces() });
});

/**
 * GET /api/traces/:id
 * Get a specific trace
 */
router.get('/traces/:id', (req, res) => {
  const trace = traceAgent.getTrace(req.params.id);
  if (!trace) {
    return res.status(404).json({ error: 'not_found', message: 'Trace not found.' });
  }
  res.json(trace);
});

router.get('/reminders', (req, res) => {
  res.json({ reminders: followUpAgent.getAllReminders() });
});

router.get('/notifications', (req, res) => {
  res.json({ notifications: followUpAgent.getAllNotifications() });
});

/**
 * GET /api/health
 * Health check
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: process.env.APP_MODE || 'demo',
    adapters: {
      intent: process.env.INTENT_MODE || 'mock',
      location: process.env.LOCATION_MODE || 'mock',
      provider: process.env.PROVIDER_MODE || 'mock',
      distance: process.env.DISTANCE_MODE || 'mock',
      bookingStore: process.env.BOOKING_STORE_MODE || 'local',
      notification: process.env.NOTIFICATION_MODE || 'mock',
      reminder: process.env.REMINDER_MODE || 'mock',
    },
    storage: {
      type: 'local_json',
      file: store.DB_FILE,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
