// agents/bookingAgent.js — Agent 5: Booking
// Creates a simulated booking for the top-ranked provider

const store = require('../storage/localStore');
const { runWithAdapter, googleStubs } = require('../tools/mode');

/**
 * @param {{
 *   provider: object,
 *   resolvedDate: string,
 *   dateFull: string,
 *   locationText: string,
 *   formattedLocation: string,
 *   userId: string
 * }} input
 * @returns {object} booking confirmation
 */
async function run(input) {
  const { provider, resolvedDate, dateFull, locationText, formattedLocation, userId } = input;

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
      status: 'confirmed',
      providerId: provider.providerId,
      providerName: provider.name,
      slot: provider.availableSlot,
      slotLabel: `${dateFull} · ${provider.slotLabel}`,
      location: formattedLocation || `${locationText}, Islamabad`,
      fee: 'Free consultation',
      confirmationMessage: `Booking confirmed with ${provider.name} for ${provider.slotLabel} ${dateFull ? 'on ' + dateFull : ''}.`,
      stateChanged: true,
      createdAt: new Date().toISOString(),
    };

    return store.insert('bookings', booking);
  };

  return runWithAdapter('booking', mockImpl, googleStubs.booking);
}

function getBooking(bookingId) {
  return store.findById('bookings', 'bookingId', bookingId);
}

function getAllBookings() {
  return store.list('bookings');
}

module.exports = { run, getBooking, getAllBookings };
