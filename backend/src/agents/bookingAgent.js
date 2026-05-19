// agents/bookingAgent.js — Agent 5: Booking
// Creates a provider-facing booking request and tracks lifecycle transitions

const store = require('../storage/localStore');
const { runWithAdapter, googleStubs } = require('../tools/mode');
const { sendProviderBookingRequest } = require('../services/providerMessaging');

/**
 * @param {{
 *   provider: object,
 *   resolvedDate: string,
 *   dateFull: string,
 *   locationText: string,
 *   formattedLocation: string,
 *   userId: string,
 *   customerPhone?: string,
 *   requestText?: string,
 *   serviceType?: string
 * }} input
 * @returns {object} booking confirmation
 */
async function run(input) {
  const {
    provider,
    resolvedDate,
    dateFull,
    locationText,
    formattedLocation,
    userId,
    customerPhone,
    requestText,
    serviceType,
    userLat,
    userLng,
  } = input;

  const hasPin = Number.isFinite(userLat) && Number.isFinite(userLng);
  const customerLocationUrl = hasPin
    ? `https://maps.google.com/?q=${userLat},${userLng}`
    : null;

  const mockImpl = async () => {
    if (!provider) {
      return { bookingId: null, status: 'failed', reason: 'no_provider' };
    }

    // Generate booking ID
    const dateStr = resolvedDate.replace(/-/g, '');
    const seq = store.nextSequence('bookings');
    const bookingId = `BK-${dateStr}-${seq}`;

    const booking = {
      bookingId,
      userId: userId || 'demo-user-001',
      customerPhone: customerPhone || null,
      status: 'pending_user_confirmation',
      lifecycleStatus: 'created',
      providerId: provider.providerId,
      providerName: provider.name,
      slot: provider.availableSlot,
      slotLabel: `${dateFull} · ${provider.slotLabel}`,
      location: formattedLocation || `${locationText}, Islamabad`,
      customerLat: hasPin ? userLat : null,
      customerLng: hasPin ? userLng : null,
      customerLocationUrl,
      serviceType,
      jobDetails: requestText || null,
      fee: 'Free consultation',
      confirmationMessage: `Booking drafted for ${provider.name}. Awaiting your confirmation.`,
      providerResponseStatus: null,
      providerResponseMessage: null,
      providerRespondedAt: null,
      confirmedAt: null,
      rejectedAt: null,
      providerPhone: null,
      providerMessageSid: null,
      providerMessageStatus: null,
      providerMessageBody: null,
      statusHistory: [{
        status: 'pending_user_confirmation',
        lifecycleStatus: 'created',
        message: 'Booking drafted; waiting for user confirmation.',
        at: new Date().toISOString(),
      }],
      stateChanged: true,
      createdAt: new Date().toISOString(),
    };

    return store.insert('bookings', booking);
  };

  return runWithAdapter('booking', mockImpl, googleStubs.booking);
}

function updateBooking(bookingId, patch, historyMessage) {
  return store.updateById('bookings', 'bookingId', bookingId, (booking) => {
    const at = new Date().toISOString();
    const next = {
      ...booking,
      ...patch,
      updatedAt: at,
    };
    next.statusHistory = [
      ...(booking.statusHistory || []),
      {
        status: next.status,
        lifecycleStatus: next.lifecycleStatus,
        message: historyMessage,
        at,
      },
    ];
    return next;
  });
}

function applyProviderResponse({ bookingId, intent, message, from, messageSid, parser, proposedSlot }) {
  const booking = getBooking(bookingId);
  if (!booking) return null;

  if (intent === 'accepted') {
    return updateBooking(bookingId, {
      status: 'confirmed',
      lifecycleStatus: 'provider_accepted',
      providerResponseStatus: 'accepted',
      providerResponseMessage: message,
      providerResponseFrom: from,
      providerResponseMessageSid: messageSid,
      providerResponseParser: parser,
      providerRespondedAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
      confirmationMessage: `Provider accepted ${booking.bookingId}. Your booking is confirmed.`,
    }, 'Provider accepted the booking.');
  }

  if (intent === 'rejected') {
    return updateBooking(bookingId, {
      status: 'rejected',
      lifecycleStatus: 'provider_rejected',
      providerResponseStatus: 'rejected',
      providerResponseMessage: message,
      providerResponseFrom: from,
      providerResponseMessageSid: messageSid,
      providerResponseParser: parser,
      providerRespondedAt: new Date().toISOString(),
      rejectedAt: new Date().toISOString(),
      confirmationMessage: 'Provider is unavailable for this booking request.',
    }, 'Provider rejected the booking.');
  }

  return updateBooking(bookingId, {
    lifecycleStatus: 'provider_reply_needs_review',
    providerResponseStatus: intent || 'unknown',
    providerResponseMessage: message,
    providerResponseFrom: from,
    providerResponseMessageSid: messageSid,
    providerResponseParser: parser,
    providerRespondedAt: new Date().toISOString(),
    proposedSlot: proposedSlot || null,
  }, 'Provider reply needs review.');
}

async function confirmBooking(bookingId) {
  const booking = getBooking(bookingId);
  if (!booking) return null;

  if (booking.status !== 'pending_user_confirmation') {
    return booking;
  }

  try {
    const message = await sendProviderBookingRequest(booking);
    return updateBooking(bookingId, {
      status: 'pending_provider_response',
      lifecycleStatus: 'message_sent_to_provider',
      providerPhone: message.providerPhone,
      providerMessageSid: message.providerMessageSid,
      providerMessageStatus: message.providerMessageStatus,
      providerMessageBody: message.providerMessageBody,
      confirmationMessage: `Booking request sent to ${booking.providerName}. Waiting for provider response.`,
    }, 'Provider WhatsApp message sent.');
  } catch (err) {
    return updateBooking(bookingId, {
      status: 'provider_message_failed',
      lifecycleStatus: 'provider_message_failed',
      providerMessageError: err.message || 'Provider WhatsApp message failed.',
    }, 'Provider WhatsApp message failed.');
  }
}

function getBooking(bookingId) {
  return store.findById('bookings', 'bookingId', bookingId);
}

function getAllBookings() {
  return store.list('bookings');
}

module.exports = { applyProviderResponse, confirmBooking, getAllBookings, getBooking, run, updateBooking };
