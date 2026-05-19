const twilio = require('twilio');

function normalizeWhatsAppNumber(value) {
  if (!value) return null;
  return value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;
}

function isConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_FROM &&
    process.env.PROVIDER_TEST_WHATSAPP_TO
  );
}

function valueOrFallback(value, fallback = 'not provided') {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value).trim();
  return normalized || fallback;
}

function cleanWhatsAppPrefix(value) {
  return valueOrFallback(value).replace(/^whatsapp:/i, '');
}

function buildCustomerLocationUrl(booking) {
  if (booking.customerLocationUrl) return booking.customerLocationUrl;
  const lat = Number(booking.customerLat);
  const lng = Number(booking.customerLng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  return null;
}

function buildJobSummary(booking) {
  const service = valueOrFallback(booking.serviceType, 'service');
  const details = valueOrFallback(booking.jobDetails, '');
  if (!details) return `Customer needs ${service.toLowerCase()} help.`;
  return details.length > 220 ? `${details.slice(0, 217)}...` : details;
}

function buildTemplateServiceVariable(booking) {
  return [
    valueOrFallback(booking.serviceType, 'Service'),
    `Job: ${buildJobSummary(booking)}`,
    `Customer: ${cleanWhatsAppPrefix(booking.customerPhone || booking.userPhone || booking.customerContact)}`,
  ].join(' | ');
}

function buildTemplateWhenVariable(booking) {
  return [
    valueOrFallback(booking.slotLabel || booking.slot),
    `Booking ID: ${booking.bookingId}`,
    'Please tap Accept if you can take this job, or Reject if you are unavailable.',
  ].join(' | ');
}

function buildProviderBookingMessage(booking) {
  const service = valueOrFallback(booking.serviceType, 'service');
  const area = valueOrFallback(booking.location);
  const when = valueOrFallback(booking.slotLabel || booking.slot);
  const customerPhone = cleanWhatsAppPrefix(booking.customerPhone || booking.userPhone || booking.customerContact);
  const jobSummary = buildJobSummary(booking);
  const pinUrl = buildCustomerLocationUrl(booking);

  return [
    `Hi, you have a new AISEEKHO booking request.`,
    ``,
    `Booking ID: ${booking.bookingId}`,
    `Service: ${service}`,
    `Job details: ${jobSummary}`,
    `Customer area: ${area}`,
    ...(pinUrl ? [`Customer location: ${pinUrl}`] : []),
    `Customer phone: ${customerPhone}`,
    `Preferred time: ${when}`,
    ``,
    `Please accept only if you can visit at this time. Reply YES ${booking.bookingId} to accept or NO ${booking.bookingId} to reject.`,
  ].join('\n');
}

function buildProviderReminderMessage(booking) {
  const service = valueOrFallback(booking.serviceType, 'service');
  const area = valueOrFallback(booking.location);
  const when = valueOrFallback(booking.slotLabel || booking.slot);
  const customerPhone = cleanWhatsAppPrefix(booking.customerPhone || booking.userPhone || booking.customerContact);

  const pinUrl = buildCustomerLocationUrl(booking);

  return [
    `Reminder: AISEEKHO booking ${booking.bookingId} is coming up.`,
    ``,
    `Service: ${service}`,
    `Customer area: ${area}`,
    ...(pinUrl ? [`Customer location: ${pinUrl}`] : []),
    `Customer phone: ${customerPhone}`,
    `Visit time: ${when}`,
    ``,
    `Please be ready and contact the customer if you need directions.`,
  ].join('\n');
}

function buildProviderChatMessage(booking, body) {
  return [
    `AISEEKHO message for booking ${booking.bookingId}`,
    ``,
    String(body || '').trim(),
    ``,
    `Reply with ${booking.bookingId} in your message so we can attach it to this booking.`,
  ].join('\n');
}

function buildProviderActionMessage(booking, action, decision) {
  if (action.actionType === 'reschedule') {
    const result = decision === 'approved'
      ? `User approved the new time: ${action.proposedSlot || 'proposed time'}.`
      : `User declined the proposed new time: ${action.proposedSlot || 'proposed time'}.`;
    return [
      `AISEEKHO booking ${booking.bookingId}`,
      result,
      `Current service: ${booking.serviceType || 'service'} in ${booking.location || 'the customer area'}.`,
    ].join('\n');
  }

  if (action.actionType === 'cancel') {
    const result = decision === 'approved'
      ? 'User approved the cancellation. This booking is now cancelled.'
      : 'User declined the cancellation. Please continue with the current booking or propose another option.';
    return [
      `AISEEKHO booking ${booking.bookingId}`,
      result,
    ].join('\n');
  }

  return `AISEEKHO booking ${booking.bookingId}: user ${decision} your request.`;
}

async function sendProviderBookingRequest(booking) {
  if (process.env.TWILIO_FAKE_SEND === 'true') {
    return {
      providerPhone: normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO || '+15550000000'),
      providerMessageSid: `SM_FAKE_${booking.bookingId}`,
      providerMessageBody: buildProviderBookingMessage(booking),
      providerMessageStatus: 'queued',
    };
  }

  if (!isConfigured()) {
    const err = new Error('twilio_not_configured');
    err.code = 'twilio_not_configured';
    throw err;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const to = normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO);
  const from = normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_FROM);
  const statusCallback = process.env.PUBLIC_WEBHOOK_BASE_URL
    ? `${process.env.PUBLIC_WEBHOOK_BASE_URL.replace(/\/$/, '')}/api/webhooks/twilio/status`
    : undefined;

  const body = buildProviderBookingMessage(booking);
  const contentSid = process.env.TWILIO_CONTENT_SID;

  const pinUrl = buildCustomerLocationUrl(booking);
  const locationVar = pinUrl
    ? `${booking.location || 'area not provided'} (Pin: ${pinUrl})`
    : (booking.location || 'not provided');

  const contentVariables = {
    '1': booking.bookingId,
    '2': buildTemplateServiceVariable(booking),
    '3': locationVar,
    '4': buildTemplateWhenVariable(booking),
  };

  const message = await client.messages.create({
    from,
    to,
    ...(contentSid
      ? { contentSid, contentVariables: JSON.stringify(contentVariables) }
      : { body }),
    ...(statusCallback ? { statusCallback } : {}),
  });

  return {
    providerPhone: to,
    providerMessageSid: message.sid,
    providerMessageBody: body,
    providerMessageStatus: message.status || 'queued',
  };
}

async function sendProviderPlainMessage(booking, body, fakeSidPrefix = 'SM_FAKE_CHAT') {
  const messageBody = buildProviderChatMessage(booking, body);

  if (process.env.TWILIO_FAKE_SEND === 'true') {
    return {
      providerPhone: normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO || '+15550000000'),
      providerMessageSid: `${fakeSidPrefix}_${booking.bookingId}`,
      providerMessageBody: messageBody,
      providerMessageStatus: 'queued',
    };
  }

  if (!isConfigured()) {
    const err = new Error('twilio_not_configured');
    err.code = 'twilio_not_configured';
    throw err;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const to = normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO);
  const from = normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_FROM);
  const statusCallback = process.env.PUBLIC_WEBHOOK_BASE_URL
    ? `${process.env.PUBLIC_WEBHOOK_BASE_URL.replace(/\/$/, '')}/api/webhooks/twilio/status`
    : undefined;

  const message = await client.messages.create({
    from,
    to,
    body: messageBody,
    ...(statusCallback ? { statusCallback } : {}),
  });

  return {
    providerPhone: to,
    providerMessageSid: message.sid,
    providerMessageBody: messageBody,
    providerMessageStatus: message.status || 'queued',
  };
}

async function sendProviderActionDecision(booking, action, decision) {
  return sendProviderPlainMessage(
    booking,
    buildProviderActionMessage(booking, action, decision),
    `SM_FAKE_ACTION_${String(decision || 'decision').toUpperCase()}`
  );
}

async function sendProviderReminder(booking) {
  const body = buildProviderReminderMessage(booking);

  if (process.env.TWILIO_FAKE_SEND === 'true') {
    return {
      providerPhone: normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO || '+15550000000'),
      providerMessageSid: `SM_FAKE_REMINDER_${booking.bookingId}`,
      providerMessageBody: body,
      providerMessageStatus: 'queued',
    };
  }

  if (!isConfigured()) {
    const err = new Error('twilio_not_configured');
    err.code = 'twilio_not_configured';
    throw err;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const to = normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO);
  const from = normalizeWhatsAppNumber(process.env.TWILIO_WHATSAPP_FROM);
  const statusCallback = process.env.PUBLIC_WEBHOOK_BASE_URL
    ? `${process.env.PUBLIC_WEBHOOK_BASE_URL.replace(/\/$/, '')}/api/webhooks/twilio/status`
    : undefined;

  const message = await client.messages.create({
    from,
    to,
    body,
    ...(statusCallback ? { statusCallback } : {}),
  });

  return {
    providerPhone: to,
    providerMessageSid: message.sid,
    providerMessageBody: body,
    providerMessageStatus: message.status || 'queued',
  };
}

function validateTwilioSignature(req) {
  if (process.env.TWILIO_VALIDATE_SIGNATURE !== 'true') return true;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.warn('[Twilio Webhook] Validation failed: TWILIO_AUTH_TOKEN is not set.');
    return false;
  }

  const signature = req.get('x-twilio-signature');
  if (!signature) {
    console.warn('[Twilio Webhook] Validation failed: x-twilio-signature header is missing. (Bypass by setting TWILIO_VALIDATE_SIGNATURE=false in .env.local)');
    return false;
  }

  const baseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL?.replace(/\/$/, '');
  const url = baseUrl
    ? `${baseUrl}${req.originalUrl}`
    : `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  const isValid = twilio.validateRequest(authToken, signature, url, req.body || {});
  if (!isValid) {
    console.warn(`[Twilio Webhook] Validation failed: Signature verification failed for URL: ${url}. (Check if webhook base URL matches your tunnel hostname, or set TWILIO_VALIDATE_SIGNATURE=false in .env.local to disable validation)`);
  }
  return isValid;
}

module.exports = {
  buildProviderBookingMessage,
  buildProviderReminderMessage,
  buildProviderChatMessage,
  normalizeWhatsAppNumber,
  sendProviderActionDecision,
  sendProviderBookingRequest,
  sendProviderPlainMessage,
  sendProviderReminder,
  validateTwilioSignature,
};
