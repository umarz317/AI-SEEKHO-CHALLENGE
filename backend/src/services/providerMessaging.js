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

// ---- WhatsApp Content-Template variables ----
// The provider WhatsApp template (TWILIO_CONTENT_SID) has 4 substitution slots
// and renders the Accept/Reject buttons natively. We pack each variable with
// well-formatted multi-line content so the templated message still looks clean.
function buildTemplateServiceVariable(booking) {
  const service = valueOrFallback(booking.serviceType, 'Service');
  const job = buildJobSummary(booking);
  const customer = cleanWhatsAppPrefix(booking.customerPhone || booking.userPhone || booking.customerContact);
  return [
    `*${service}*`,
    `📋 ${job}`,
    `📞 ${customer}`,
  ].join('\n');
}

function buildTemplateLocationVariable(booking) {
  const area = valueOrFallback(booking.location);
  const pin = buildCustomerLocationUrl(booking);
  return pin ? `${area}\n📍 ${pin}` : area;
}

function buildTemplateWhenVariable(booking) {
  const when = valueOrFallback(booking.slotLabel || booking.slot);
  return `*${when}*`;
}

const BRAND = 'Karigo';
const RULE = '━━━━━━━━━━━━━━';
const SOFT_RULE = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

function brandHeader(emoji, title) {
  return [
    `${emoji}  *${BRAND}*`,
    `_${title}_`,
  ].join('\n');
}

function brandFooter(extra) {
  const tagline = '_Powered by Karigo — connecting trusted pros_';
  return extra ? `${tagline}\n${extra}` : tagline;
}

function buildProviderBookingMessage(booking) {
  const service = valueOrFallback(booking.serviceType, 'Service');
  const area = valueOrFallback(booking.location);
  const when = valueOrFallback(booking.slotLabel || booking.slot);
  const customerPhone = cleanWhatsAppPrefix(booking.customerPhone || booking.userPhone || booking.customerContact);
  const jobSummary = buildJobSummary(booking);
  const pinUrl = buildCustomerLocationUrl(booking);

  return [
    brandHeader('🛠️', 'New booking request'),
    RULE,
    ``,
    `*${service}*`,
    `_${jobSummary}_`,
    ``,
    `🕒  *${when}*`,
    `📍  ${area}`,
    ...(pinUrl ? [`        ↳ ${pinUrl}`] : []),
    `📞  ${customerPhone}`,
    ``,
    `🆔  \`${booking.bookingId}\``,
    ``,
    SOFT_RULE,
    `*Can you take this job?*`,
    `✅  Accept  →  reply  *YES ${booking.bookingId}*`,
    `❌  Decline →  reply  *NO ${booking.bookingId}*`,
    ``,
    brandFooter(),
  ].join('\n');
}

function buildProviderReminderMessage(booking) {
  const service = valueOrFallback(booking.serviceType, 'Service');
  const area = valueOrFallback(booking.location);
  const when = valueOrFallback(booking.slotLabel || booking.slot);
  const customerPhone = cleanWhatsAppPrefix(booking.customerPhone || booking.userPhone || booking.customerContact);
  const pinUrl = buildCustomerLocationUrl(booking);

  return [
    brandHeader('⏰', 'Upcoming visit reminder'),
    RULE,
    ``,
    `*${service}*`,
    `Your customer is expecting you soon.`,
    ``,
    `🕒  *${when}*`,
    `📍  ${area}`,
    ...(pinUrl ? [`        ↳ ${pinUrl}`] : []),
    `📞  ${customerPhone}`,
    ``,
    `🆔  \`${booking.bookingId}\``,
    ``,
    SOFT_RULE,
    `_Tip: message the customer if you need directions or are running late._`,
    ``,
    brandFooter(),
  ].join('\n');
}

function buildProviderChatMessage(booking, body) {
  return [
    brandHeader('💬', 'Message from your customer'),
    RULE,
    ``,
    String(body || '').trim(),
    ``,
    `🆔  \`${booking.bookingId}\``,
    ``,
    SOFT_RULE,
    `_Reply with *${booking.bookingId}* in your message so we attach it to this booking._`,
    ``,
    brandFooter(),
  ].join('\n');
}

function buildProviderActionMessage(booking, action, decision) {
  const approved = decision === 'approved';
  const marker = approved ? '✅' : '❌';
  const decisionWord = approved ? '*approved*' : '*declined*';

  if (action.actionType === 'reschedule') {
    const proposed = action.proposedSlot || 'the proposed time';
    return [
      brandHeader(marker, `Reschedule ${approved ? 'accepted' : 'rejected'}`),
      RULE,
      ``,
      `The customer ${decisionWord} your new time:`,
      `*${proposed}*`,
      ``,
      `🛠️  ${booking.serviceType || 'Service'}`,
      `📍  ${booking.location || 'Customer area'}`,
      `🆔  \`${booking.bookingId}\``,
      ``,
      brandFooter(),
    ].join('\n');
  }

  if (action.actionType === 'cancel') {
    const line = approved
      ? `The customer ${decisionWord} the cancellation.\nThis booking is now *cancelled*.`
      : `The customer ${decisionWord} the cancellation.\nPlease continue with the current booking or propose another option.`;
    return [
      brandHeader(marker, `Cancellation ${approved ? 'confirmed' : 'declined'}`),
      RULE,
      ``,
      line,
      ``,
      `🆔  \`${booking.bookingId}\``,
      ``,
      brandFooter(),
    ].join('\n');
  }

  return [
    brandHeader(marker, 'Booking update'),
    RULE,
    ``,
    `The customer ${decisionWord} your request.`,
    ``,
    `🆔  \`${booking.bookingId}\``,
    ``,
    brandFooter(),
  ].join('\n');
}

function buildProviderAcceptanceConfirmationMessage(booking) {
  const service = valueOrFallback(booking.serviceType, 'Service');
  const when = valueOrFallback(booking.slotLabel || booking.slot);
  const area = valueOrFallback(booking.location);

  return [
    brandHeader('✅', 'Booking confirmed'),
    RULE,
    ``,
    `Thanks for accepting this job.`,
    ``,
    `🛠️  ${service}`,
    `🕒  *${when}*`,
    `📍  ${area}`,
    `🆔  \`${booking.bookingId}\``,
    ``,
    SOFT_RULE,
    `_Please contact the customer if you need directions or are running late._`,
    ``,
    brandFooter(),
  ].join('\n');
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

  // When a Twilio WhatsApp content template is configured, send via the
  // template so the provider sees native Accept / Reject buttons. The
  // template body is registered at Twilio (re-register it with Karigo
  // copy to drop any legacy AISEEKHO wording). When no contentSid is set,
  // fall back to our beautified plain body (no buttons).
  const contentVariables = contentSid ? {
    '1': booking.bookingId,
    '2': buildTemplateServiceVariable(booking),
    '3': buildTemplateLocationVariable(booking),
    '4': buildTemplateWhenVariable(booking),
  } : null;

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

async function sendProviderSystemMessage(booking, body, fakeSidPrefix = 'SM_FAKE_SYSTEM') {
  if (process.env.TWILIO_FAKE_SEND === 'true') {
    return {
      providerPhone: normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO || '+15550000000'),
      providerMessageSid: `${fakeSidPrefix}_${booking.bookingId}`,
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

async function sendProviderAcceptanceConfirmation(booking) {
  return sendProviderSystemMessage(
    booking,
    buildProviderAcceptanceConfirmationMessage(booking),
    'SM_FAKE_PROVIDER_ACCEPT_CONFIRMATION'
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
  buildProviderAcceptanceConfirmationMessage,
  normalizeWhatsAppNumber,
  sendProviderActionDecision,
  sendProviderAcceptanceConfirmation,
  sendProviderBookingRequest,
  sendProviderPlainMessage,
  sendProviderReminder,
  validateTwilioSignature,
};
