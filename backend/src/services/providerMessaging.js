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

function buildProviderBookingMessage(booking) {
  return [
    `KariGo booking request ${booking.bookingId}`,
    `Service: ${booking.serviceType || 'Service'}`,
    `Customer area: ${booking.location || 'not provided'}`,
    `When: ${booking.slotLabel || booking.slot || 'not provided'}`,
    `Reply YES ${booking.bookingId} to accept or NO ${booking.bookingId} to reject.`,
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

  const contentVariables = {
    '1': booking.bookingId,
    '2': booking.serviceType || 'Service',
    '3': booking.location || 'not provided',
    '4': booking.slotLabel || booking.slot || 'not provided',
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

function validateTwilioSignature(req) {
  if (process.env.TWILIO_VALIDATE_SIGNATURE !== 'true') return true;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature = req.get('x-twilio-signature');
  if (!signature) return false;

  const baseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL?.replace(/\/$/, '');
  const url = baseUrl
    ? `${baseUrl}${req.originalUrl}`
    : `${req.protocol}://${req.get('host')}${req.originalUrl}`;

  return twilio.validateRequest(authToken, signature, url, req.body || {});
}

module.exports = {
  buildProviderBookingMessage,
  normalizeWhatsAppNumber,
  sendProviderBookingRequest,
  validateTwilioSignature,
};
