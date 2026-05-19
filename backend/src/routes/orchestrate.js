// routes/orchestrate.js — API routes
const express = require('express');
const router = express.Router();
const { orchestrate } = require('../services/orchestrator');
const jobs = require('../services/jobStore');
const bookingAgent = require('../agents/bookingAgent');
const followUpAgent = require('../agents/followUpAgent');
const traceAgent = require('../agents/traceAgent');
const store = require('../storage/localStore');
const { parseProviderReply } = require('../services/providerReplyParser');
const { validateTwilioSignature } = require('../services/providerMessaging');
const { emitBookingUpdated } = require('../services/realtime');
const { requireAuth } = require('../middleware/auth');

/**
 * POST /api/orchestrate
 * Main endpoint — runs the full 7-agent pipeline
 */
router.post('/orchestrate', requireAuth, async (req, res) => {
  try {
    const { userId, text, cityHint, timezone } = req.body;
    const effectiveUserId = req.userId || userId || 'demo-user-001';

    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        error: 'missing_text',
        message: 'Request text is required.',
      });
    }

    const result = await orchestrate({ userId: effectiveUserId, text, cityHint, timezone });
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
 * POST /api/orchestrate/jobs
 * Starts orchestration in the background so clients can track real progress.
 */
router.post('/orchestrate/jobs', requireAuth, (req, res) => {
  const { text, cityHint, timezone } = req.body;
  const effectiveUserId = req.userId || 'demo-user-001';

  if (!text || text.trim().length === 0) {
    return res.status(400).json({
      error: 'missing_text',
      message: 'Request text is required.',
    });
  }

  const job = jobs.createJob({ userId: effectiveUserId, text, cityHint, timezone });
  res.status(202).json(jobs.serializeJob(job));

  setImmediate(async () => {
    jobs.markRunning(job.jobId);
    jobs.appendEvent(job.jobId, {
      agent: 'Orchestrator',
      tool: 'start_job',
      source: 'api_job_runner',
      status: 'running',
      icon: 'flow',
      color: '#6366F1',
      output: 'Orchestration job accepted by backend.',
      summary: 'Job started.',
    });

    try {
      const result = await orchestrate(
        { userId: effectiveUserId, text, cityHint, timezone },
        {
          onProgress: (event) => {
            jobs.appendEvent(job.jobId, event);
          },
        }
      );
      jobs.completeJob(job.jobId, result);
      jobs.appendEvent(job.jobId, {
        agent: 'Orchestrator',
        tool: 'finish_job',
        source: 'api_job_runner',
        status: 'success',
        icon: 'check',
        color: '#22C55E',
        output: `Job completed with status ${result.status}.`,
        summary: 'Job complete.',
      });
    } catch (err) {
      console.error('[orchestrate:job] Error:', err);
      jobs.failJob(job.jobId, err);
      jobs.appendEvent(job.jobId, {
        agent: 'Orchestrator',
        tool: 'fail_job',
        source: 'api_job_runner',
        status: 'failed',
        icon: 'alarm',
        color: '#EF4444',
        output: err.message || 'Orchestration job failed.',
        summary: 'Job failed.',
      });
    }
  });
});

/**
 * GET /api/orchestrate/jobs/:jobId
 * Reads job status, progress events, and final result.
 */
router.get('/orchestrate/jobs/:jobId', (req, res) => {
  const job = jobs.getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'not_found', message: 'Job not found.' });
  }
  res.json(jobs.serializeJob(job));
});

/**
 * POST /api/webhooks/twilio/whatsapp
 * Receives real inbound provider WhatsApp replies from Twilio.
 */
router.post('/webhooks/twilio/whatsapp', async (req, res) => {
  res.type('text/xml');

  if (!validateTwilioSignature(req)) {
    return res.status(403).send('<Response></Response>');
  }

  const inbound = {
    inboundMessageId: req.body.MessageSid || req.body.SmsSid || `IN-${Date.now()}`,
    channel: 'twilio_whatsapp',
    from: req.body.From || null,
    to: req.body.To || null,
    body: req.body.Body || '',
    buttonPayload: req.body.ButtonPayload || null,
    raw: req.body,
    status: 'received',
    createdAt: new Date().toISOString(),
  };

  try {
    const parsed = await parseProviderReply({
      text: inbound.body,
      buttonPayload: inbound.buttonPayload,
    });
    inbound.bookingId = parsed.bookingId || null;
    inbound.parsedIntent = parsed.intent;
    inbound.parser = parsed.parser;

    if (!parsed.bookingId) {
      inbound.status = 'unmatched_missing_booking_code';
      store.insert('inboundMessages', inbound);
      return res.send('<Response></Response>');
    }

    const updatedBooking = bookingAgent.applyProviderResponse({
      bookingId: parsed.bookingId,
      intent: parsed.intent,
      message: inbound.body,
      from: inbound.from,
      messageSid: inbound.inboundMessageId,
      parser: parsed.parser,
      proposedSlot: parsed.proposedSlot,
    });

    if (!updatedBooking) {
      inbound.status = 'unmatched_booking_not_found';
      store.insert('inboundMessages', inbound);
      return res.send('<Response></Response>');
    }

    inbound.status = `matched_${parsed.intent}`;
    store.insert('inboundMessages', inbound);

    if (parsed.intent === 'accepted') {
      const followUp = await followUpAgent.run({
        bookingId: updatedBooking.bookingId,
        providerName: updatedBooking.providerName,
        slot: updatedBooking.slot,
        formattedLocation: updatedBooking.location,
      });
      const bookingWithReminder = bookingAgent.updateBooking(updatedBooking.bookingId, {
        reminderTimeLabel: followUp.reminderTimeLabel || null,
        reminderMessage: followUp.reminderMessage || null,
      }, 'Reminder scheduled after provider acceptance.');
      emitBookingUpdated(bookingWithReminder || updatedBooking);
    } else {
      emitBookingUpdated(updatedBooking);
    }

    return res.send('<Response></Response>');
  } catch (err) {
    console.error('[twilio:whatsapp] Error:', err);
    inbound.status = 'processing_failed';
    inbound.error = err.message;
    store.insert('inboundMessages', inbound);
    return res.send('<Response></Response>');
  }
});

router.post('/webhooks/twilio/status', (req, res) => {
  res.type('text/xml');
  store.insert('notifications', {
    notificationId: `TWILIO-STATUS-${req.body.MessageSid || Date.now()}`,
    type: 'twilio_status',
    channel: 'twilio_whatsapp',
    messageSid: req.body.MessageSid || null,
    messageStatus: req.body.MessageStatus || req.body.SmsStatus || null,
    raw: req.body,
    createdAt: new Date().toISOString(),
  });
  res.send('<Response></Response>');
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
 * POST /api/bookings/:id/confirm
 * User confirms the draft booking; backend sends provider WhatsApp.
 */
router.post('/bookings/:id/confirm', async (req, res) => {
  try {
    const updated = await bookingAgent.confirmBooking(req.params.id);
    if (!updated) {
      return res.status(404).json({ error: 'not_found', message: 'Booking not found.' });
    }
    emitBookingUpdated(updated);
    res.json(updated);
  } catch (err) {
    console.error('[bookings:confirm] Error:', err);
    res.status(500).json({ error: 'confirm_failed', message: err.message });
  }
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
    auth: {
      enabled: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL),
    },
    adapters: {
      intent: process.env.INTENT_MODE || 'mock',
      location: process.env.LOCATION_MODE || 'mock',
      provider: process.env.PROVIDER_MODE || 'mock',
      distance: process.env.DISTANCE_MODE || 'mock',
      bookingStore: process.env.BOOKING_STORE_MODE || 'local',
      notification: process.env.NOTIFICATION_MODE || 'mock',
      reminder: process.env.REMINDER_MODE || 'mock',
    },
    messaging: {
      channel: 'twilio_whatsapp',
      configured: Boolean(
        process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_WHATSAPP_FROM &&
        process.env.PROVIDER_TEST_WHATSAPP_TO
      ),
      validateSignature: process.env.TWILIO_VALIDATE_SIGNATURE === 'true',
    },
    storage: {
      type: 'local_json',
      file: store.DB_FILE,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
