const store = require('../storage/localStore');

function registerPushToken({ userId, token, platform }) {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    const err = new Error('missing_push_token');
    err.code = 'missing_push_token';
    throw err;
  }

  const now = new Date().toISOString();
  return store.upsertById('pushTokens', 'token', normalizedToken, (existing) => ({
    ...(existing || {}),
    token: normalizedToken,
    userId: userId || 'demo-user-001',
    platform: platform || existing?.platform || 'unknown',
    updatedAt: now,
    createdAt: existing?.createdAt || now,
  }));
}

function getLatestPushTokenForUser(userId) {
  const targetUserId = userId || 'demo-user-001';
  return [...store.list('pushTokens')]
    .filter((record) => record.userId === targetUserId && record.token)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))[0] || null;
}

async function sendUserReminderPush({ booking, reminder }) {
  const pushToken = getLatestPushTokenForUser(booking.userId);
  if (!pushToken) {
    const err = new Error('push_token_not_registered');
    err.code = 'push_token_not_registered';
    throw err;
  }

  const body = reminder.message || `${booking.providerName || 'Provider'} will visit ${booking.location || 'your area'} at ${booking.slotLabel || booking.slot || 'the booked time'}.`;
  const message = {
    to: pushToken.token,
    sound: 'default',
    title: 'Booking reminder',
    body,
    data: {
      bookingId: booking.bookingId,
      type: 'booking_reminder',
    },
  };

  if (process.env.EXPO_PUSH_FAKE_SEND === 'true') {
    return {
      pushToken: pushToken.token,
      status: 'ok',
      id: `EXPO_FAKE_${booking.bookingId}`,
      body: message,
    };
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(`expo_push_failed_${response.status}`);
    err.detail = payload;
    throw err;
  }

  return {
    pushToken: pushToken.token,
    status: payload?.data?.status || 'ok',
    id: payload?.data?.id || null,
    body: message,
    raw: payload,
  };
}

module.exports = {
  getLatestPushTokenForUser,
  registerPushToken,
  sendUserReminderPush,
};
