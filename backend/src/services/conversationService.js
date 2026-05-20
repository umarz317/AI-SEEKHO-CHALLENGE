const bookingAgent = require('../agents/bookingAgent');
const followUpAgent = require('../agents/followUpAgent');
const store = require('../storage/localStore');
const { classifyConversationMessage } = require('./conversationAgent');
const {
  normalizeWhatsAppNumber,
  sendProviderActionDecision,
  sendProviderPlainMessage,
} = require('./providerMessaging');
const {
  emitBookingUpdated,
  emitConversationAction,
  emitConversationMessage,
} = require('./realtime');

const ACTIVE_BOOKING_STATUSES = new Set([
  'pending_provider_response',
  'confirmed',
  'provider_message_failed',
]);

function ensureConversation(booking) {
  if (!booking?.bookingId) return null;
  const conversationId = `CONV-${booking.bookingId}`;
  const now = new Date().toISOString();
  return store.upsertById('conversations', 'conversationId', conversationId, (existing) => ({
    conversationId,
    bookingId: booking.bookingId,
    status: existing?.status || 'active',
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }));
}

function getConversationForBooking(bookingId) {
  const booking = bookingAgent.getBooking(bookingId);
  if (!booking) return null;
  const conversation = ensureConversation(booking);
  const messages = store
    .list('conversationMessages')
    .filter((message) => message.bookingId === bookingId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const actions = store
    .list('conversationActions')
    .filter((action) => action.bookingId === bookingId)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  return { booking, conversation, messages, actions };
}

function addMessage({ booking, senderType, channel, body, direction, status = 'sent', metadata = {} }) {
  const conversation = ensureConversation(booking);
  const now = new Date().toISOString();
  const seq = store.nextSequence('conversationMessages');
  const message = store.insert('conversationMessages', {
    messageId: `MSG-${booking.bookingId}-${seq}`,
    conversationId: conversation.conversationId,
    bookingId: booking.bookingId,
    senderType,
    channel,
    body: String(body || '').trim(),
    direction,
    status,
    metadata,
    createdAt: now,
  });
  emitConversationMessage(message);
  return message;
}

function updateMessage(messageId, patch) {
  const updated = store.updateById('conversationMessages', 'messageId', messageId, (message) => ({
    ...message,
    ...patch,
    metadata: {
      ...(message.metadata || {}),
      ...(patch.metadata || {}),
    },
  }));
  if (updated) emitConversationMessage(updated);
  return updated;
}

function createAction({
  booking,
  actionType,
  proposedSlot,
  reason,
  sourceMessageId,
  assistantMessage,
  metadata = {},
  status = 'pending',
}) {
  const conversation = ensureConversation(booking);
  const now = new Date().toISOString();
  const seq = store.nextSequence('conversationActions');
  const action = store.insert('conversationActions', {
    actionId: `ACT-${booking.bookingId}-${seq}`,
    conversationId: conversation.conversationId,
    bookingId: booking.bookingId,
    actionType,
    proposedSlot: proposedSlot || null,
    reason: reason || null,
    status,
    sourceMessageId: sourceMessageId || null,
    metadata,
    createdAt: now,
    resolvedAt: null,
  });

  emitConversationAction(action);

  if (assistantMessage) {
    addMessage({
      booking,
      senderType: 'assistant',
      channel: 'in_app',
      body: assistantMessage,
      direction: 'internal',
      status: 'sent',
      metadata: { actionId: action.actionId, actionType, ...metadata },
    });
  }

  return action;
}

async function sendUserMessage(bookingId, body, userId) {
  const booking = bookingAgent.getBooking(bookingId);
  if (!booking) {
    const err = new Error('Booking not found.');
    err.code = 'not_found';
    throw err;
  }
  if (!String(body || '').trim()) {
    const err = new Error('Message body is required.');
    err.code = 'missing_message';
    throw err;
  }

  const message = addMessage({
    booking,
    senderType: 'user',
    channel: 'in_app',
    body,
    direction: 'outbound',
    status: 'sending',
    metadata: { userId: userId || booking.userId || 'demo-user-001' },
  });

  let pendingAction = null;
  try {
    const classification = await classifyActionMessage({
      text: body,
      source: 'user',
      booking,
    });

    updateMessage(message.messageId, {
      metadata: { classification },
    });

    if (classification.type === 'reschedule_proposed') {
      pendingAction = createAction({
        booking,
        actionType: 'reschedule',
        proposedSlot: classification.proposedSlot || body,
        reason: body,
        sourceMessageId: message.messageId,
        metadata: { initiatedBy: 'user' },
        assistantMessage: `Waiting for provider confirmation for ${classification.proposedSlot || body}.`,
      });
      updateMessage(message.messageId, {
        metadata: { actionId: pendingAction.actionId },
      });
    }

    const delivery = await sendProviderPlainMessage(booking, body);
    return updateMessage(message.messageId, {
      status: 'sent',
      metadata: {
        providerDelivery: delivery,
        ...(pendingAction ? { actionId: pendingAction.actionId } : {}),
      },
    }) || message;
  } catch (err) {
    return updateMessage(message.messageId, {
      status: 'failed',
      metadata: { error: err.message },
    }) || message;
  }
}

async function handleProviderInbound({ booking, inbound, parsed, classify = true }) {
  if (!booking) return null;
  const providerMessage = addMessage({
    booking,
    senderType: 'provider',
    channel: 'twilio_whatsapp',
    body: inbound.body,
    direction: 'inbound',
    status: 'received',
    metadata: {
      from: inbound.from || null,
      inboundMessageId: inbound.inboundMessageId || null,
      parsedIntent: parsed?.intent || null,
      parser: parsed?.parser || null,
    },
  });

  if (!classify) return { message: providerMessage, classification: null, action: null };

  const providerDecisionResult = await handleProviderDecisionForUserAction({
    booking,
    providerMessage,
    parsed,
  });
  if (providerDecisionResult) return providerDecisionResult;

  const classification = await classifyActionMessage({
    text: inbound.body,
    source: 'provider',
    booking,
  });

  updateMessage(providerMessage.messageId, {
    metadata: { classification },
  });

  if (classification.type === 'reschedule_proposed') {
    const action = createAction({
      booking,
      actionType: 'reschedule',
      proposedSlot: classification.proposedSlot,
      reason: classification.reason,
      sourceMessageId: providerMessage.messageId,
      assistantMessage: classification.assistantMessage || `Provider proposed a new time: ${classification.proposedSlot || classification.reason}.`,
    });
    return { message: providerMessage, classification, action };
  }

  if (classification.type === 'cancel_requested') {
    const action = createAction({
      booking,
      actionType: 'cancel',
      proposedSlot: null,
      reason: classification.reason,
      sourceMessageId: providerMessage.messageId,
      assistantMessage: classification.assistantMessage || 'Provider is asking to cancel this booking. Please approve only if you want to close it.',
    });
    return { message: providerMessage, classification, action };
  }

  return { message: providerMessage, classification, action: null };
}

async function classifyActionMessage({ text, source = 'provider', booking }) {
  const ruleClassification = classifyActionMessageWithRules({ text, source });
  const shouldAskLlm =
    shouldUseLlmActionFallback(text) &&
    (
      ruleClassification.type === 'plain_message' ||
      (
        ruleClassification.type === 'reschedule_proposed' &&
        !isConcreteProposedSlot(ruleClassification.proposedSlot)
      )
    );

  if (!shouldAskLlm) {
    return ruleClassification;
  }

  const llmClassification = await classifyConversationMessage({ text, source, booking }).catch(() => null);
  return normalizeActionClassification(llmClassification, ruleClassification, source);
}

function classifyActionMessageWithRules({ text, source = 'provider' }) {
  const body = String(text || '').trim();
  const proposedSlot = extractProposedSlot(body);

  if (isCancelRequest(body)) {
    return {
      type: 'cancel_requested',
      confidence: 0.9,
      proposedSlot: null,
      reason: body,
      assistantMessage: source === 'provider'
        ? 'Provider is asking to cancel this booking. Please approve only if you want to close it.'
        : 'Cancellation requested. Please confirm before the provider is notified.',
      parser: 'rules',
    };
  }

  if (isRescheduleRequest(body, proposedSlot)) {
    return {
      type: 'reschedule_proposed',
      confidence: proposedSlot ? 0.9 : 0.75,
      proposedSlot: proposedSlot || body,
      reason: body,
      assistantMessage: source === 'provider'
        ? `Provider proposed a new time: ${proposedSlot || body}.`
        : `Waiting for provider confirmation for ${proposedSlot || body}.`,
      parser: 'rules',
    };
  }

  return {
    type: 'plain_message',
    confidence: 1,
    proposedSlot: null,
    reason: body,
    assistantMessage: null,
    parser: 'rules',
  };
}

function normalizeActionClassification(classification, fallback, source) {
  if (!classification || !['reschedule_proposed', 'cancel_requested'].includes(classification.type)) {
    return fallback;
  }

  const reason = classification.reason || fallback.reason;
  const proposedSlot = classification.type === 'reschedule_proposed'
    ? classification.proposedSlot || fallback.proposedSlot || reason
    : null;

  return {
    type: classification.type,
    confidence: classification.confidence || 0.7,
    proposedSlot,
    reason,
    assistantMessage: classification.type === 'reschedule_proposed'
      ? (source === 'provider'
        ? `Provider proposed a new time: ${proposedSlot || reason}.`
        : `Waiting for provider confirmation for ${proposedSlot || reason}.`)
      : (source === 'provider'
        ? 'Provider is asking to cancel this booking. Please approve only if you want to close it.'
        : 'Cancellation requested. Please confirm before the provider is notified.'),
    parser: classification.parser || 'gemini',
  };
}

function shouldUseLlmActionFallback(text) {
  const body = String(text || '').toLowerCase();
  if (!body.trim()) return false;
  return /\b(kal|aaj|aj|shaam|sham|subah|dopahar|raat|bajy|baje|bajay|late|delay|possible|mumkin|hosakta|ho sakta|kar skty|kr skty|kar sakte|kr sakte|instead|later|earlier|tomorrow|today|evening|morning|afternoon|tonight)\b/i.test(body);
}

function isConcreteProposedSlot(value) {
  const text = String(value || '').trim();
  return /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) ||
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text);
}

function isCancelRequest(text) {
  return /\b(cancel|cancelled|canceled|can't come|cannot come|not coming|sorry.*cannot|sorry.*can't)\b/i.test(text);
}

function isRescheduleRequest(text, proposedSlot) {
  if (proposedSlot) return true;
  return /\b(reschedule|change (?:the )?time|move (?:it|this|the booking)|different time|another time)\b/i.test(text) ||
    /\btime\s+ko\b.*\b(?:kar|kr|kard|karde|kardo|karna|set|change)\b/i.test(text);
}

function extractProposedSlot(text) {
  const body = String(text || '');
  const iso = body.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:[+-]\d{2}:\d{2}|Z)?/);
  if (iso) return iso[0];
  const explicitTime = body.match(/\b(?:today|tomorrow|tonight|monday|tuesday|wednesday|thursday|friday|saturday|sunday)?\s*(?:at\s*)?\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i);
  return explicitTime ? explicitTime[0].trim() : null;
}

async function approveAction(bookingId, actionId) {
  const booking = bookingAgent.getBooking(bookingId);
  const action = getPendingAction(bookingId, actionId);
  if (!booking || !action) return null;

  let updatedBooking = booking;
  if (action.actionType === 'reschedule') {
    updatedBooking = await applyRescheduleAction({
      booking,
      action,
      lifecycleStatus: 'rescheduled_by_user_approval',
      historyMessage: 'User approved provider reschedule proposal.',
    });
  } else if (action.actionType === 'cancel') {
    updatedBooking = bookingAgent.updateBooking(bookingId, {
      status: 'cancelled',
      lifecycleStatus: 'cancelled_by_user_approval',
      cancelledAt: new Date().toISOString(),
      confirmationMessage: 'Booking cancelled after user approved provider cancellation request.',
    }, 'User approved provider cancellation request.');
    skipScheduledReminders(bookingId, 'cancelled');
  }

  const updatedAction = resolveAction(action.actionId, 'approved');
  await sendProviderActionDecision(updatedBooking || booking, updatedAction || action, 'approved').catch((err) => {
    addMessage({
      booking: updatedBooking || booking,
      senderType: 'system',
      channel: 'twilio_whatsapp',
      body: `Provider update failed: ${err.message}`,
      direction: 'outbound',
      status: 'failed',
      metadata: { actionId },
    });
  });

  addMessage({
    booking: updatedBooking || booking,
    senderType: 'system',
    channel: 'in_app',
    body: action.actionType === 'reschedule'
      ? 'You approved the provider proposed time. The booking has been updated.'
      : 'You approved cancellation. The booking has been cancelled.',
    direction: 'internal',
    status: 'sent',
    metadata: { actionId, actionType: action.actionType },
  });

  if (updatedBooking) emitBookingUpdated(updatedBooking);
  return { booking: updatedBooking, action: updatedAction };
}

async function rejectAction(bookingId, actionId) {
  const booking = bookingAgent.getBooking(bookingId);
  const action = getPendingAction(bookingId, actionId);
  if (!booking || !action) return null;

  const updatedAction = resolveAction(action.actionId, 'rejected');
  await sendProviderActionDecision(booking, updatedAction || action, 'rejected').catch((err) => {
    addMessage({
      booking,
      senderType: 'system',
      channel: 'twilio_whatsapp',
      body: `Provider update failed: ${err.message}`,
      direction: 'outbound',
      status: 'failed',
      metadata: { actionId },
    });
  });

  addMessage({
    booking,
    senderType: 'system',
    channel: 'in_app',
    body: action.actionType === 'reschedule'
      ? 'You declined the provider proposed time. The original booking remains unchanged.'
      : 'You declined the provider cancellation request. The booking remains unchanged.',
    direction: 'internal',
    status: 'sent',
    metadata: { actionId, actionType: action.actionType },
  });

  return { booking, action: updatedAction };
}

async function handleProviderDecisionForUserAction({ booking, providerMessage, parsed }) {
  if (!['accepted', 'rejected'].includes(parsed?.intent)) return null;
  const action = findLatestPendingUserAction(booking.bookingId);
  if (!action) return null;

  if (parsed.intent === 'accepted') {
    let updatedBooking = booking;
    if (action.actionType === 'reschedule') {
      updatedBooking = await applyRescheduleAction({
        booking,
        action,
        lifecycleStatus: 'rescheduled_by_provider_acceptance',
        historyMessage: 'Provider approved user reschedule proposal.',
      });
    }

    const updatedAction = resolveAction(action.actionId, 'approved');
    addMessage({
      booking: updatedBooking || booking,
      senderType: 'system',
      channel: 'in_app',
      body: action.actionType === 'reschedule'
        ? 'Provider accepted your reschedule request. The booking time has been updated.'
        : 'Provider accepted your request.',
      direction: 'internal',
      status: 'sent',
      metadata: { actionId: action.actionId, providerMessageId: providerMessage.messageId },
    });
    await sendProviderPlainMessage(updatedBooking || booking, 'Confirmed. The booking has been updated in KariGo.').catch(() => null);
    if (updatedBooking) emitBookingUpdated(updatedBooking);
    return { message: providerMessage, classification: { type: 'plain_message', providerDecisionForAction: parsed.intent }, action: updatedAction };
  }

  const updatedAction = resolveAction(action.actionId, 'rejected');
  addMessage({
    booking,
    senderType: 'system',
    channel: 'in_app',
    body: action.actionType === 'reschedule'
      ? 'Provider declined your reschedule request. The original booking time remains unchanged.'
      : 'Provider declined your request.',
    direction: 'internal',
    status: 'sent',
    metadata: { actionId: action.actionId, providerMessageId: providerMessage.messageId },
  });
  return { message: providerMessage, classification: { type: 'plain_message', providerDecisionForAction: parsed.intent }, action: updatedAction };
}

function findLatestPendingUserAction(bookingId) {
  return store
    .list('conversationActions')
    .filter((action) =>
      action.bookingId === bookingId &&
      action.status === 'pending' &&
      action.metadata?.initiatedBy === 'user'
    )
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0] || null;
}

async function applyRescheduleAction({ booking, action, lifecycleStatus, historyMessage }) {
  const slot = normalizeProposedSlot(action.proposedSlot, booking.slot);
  const updatedBooking = bookingAgent.updateBooking(booking.bookingId, {
    slot: slot.iso,
    slotLabel: slot.label,
    proposedSlot: action.proposedSlot || slot.label,
    lifecycleStatus,
    confirmationMessage: `Booking rescheduled to ${slot.label}.`,
  }, historyMessage);

  skipScheduledReminders(booking.bookingId, 'rescheduled');
  await followUpAgent.run({
    bookingId: updatedBooking.bookingId,
    providerName: updatedBooking.providerName,
    slot: updatedBooking.slot,
    slotLabel: updatedBooking.slotLabel,
    formattedLocation: updatedBooking.location,
    serviceType: updatedBooking.serviceType,
  });
  return updatedBooking;
}

function getPendingAction(bookingId, actionId) {
  const action = store.findById('conversationActions', 'actionId', actionId);
  if (!action || action.bookingId !== bookingId || action.status !== 'pending') return null;
  return action;
}

function resolveAction(actionId, status) {
  const updated = store.updateById('conversationActions', 'actionId', actionId, (action) => ({
    ...action,
    status,
    resolvedAt: new Date().toISOString(),
  }));
  if (updated) emitConversationAction(updated);
  return updated;
}

function skipScheduledReminders(bookingId, reason) {
  const now = new Date().toISOString();
  for (const reminder of store.list('reminders').filter((item) => item.bookingId === bookingId && item.status === 'scheduled')) {
    const updated = store.updateById('reminders', 'reminderId', reminder.reminderId, {
      ...reminder,
      status: 'skipped',
      error: reason,
      sentAt: null,
    });
    store.upsertById('notifications', 'notificationId', `NOTIF-${reminder.reminderId}`, {
      notificationId: `NOTIF-${reminder.reminderId}`,
      bookingId,
      type: 'reminder',
      recipientType: updated.recipientType,
      channel: updated.channel,
      message: updated.message,
      scheduledFor: updated.scheduledFor,
      status: 'skipped',
      sentAt: null,
      error: reason,
      createdAt: updated.createdAt || now,
    });
  }
}

function matchLatestActiveBookingByProvider(from, options = {}) {
  const normalizedFrom = normalizeWhatsAppNumber(from);
  if (!normalizedFrom) return null;

  const activeBookings = store
    .list('bookings')
    .filter((booking) => ACTIVE_BOOKING_STATUSES.has(booking.status))
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));

  const preferredStatuses = Array.isArray(options.preferredStatuses)
    ? new Set(options.preferredStatuses)
    : null;

  const providerMatches = activeBookings.filter((booking) =>
    normalizeWhatsAppNumber(booking.providerPhone) === normalizedFrom
  );
  const directProviderMatch = preferredStatuses?.size
    ? providerMatches.find((booking) => preferredStatuses.has(booking.status)) || null
    : pickPreferredBooking(providerMatches, preferredStatuses);
  if (directProviderMatch) return directProviderMatch;
  if (providerMatches.length && preferredStatuses?.size) return null;

  const configuredProvider = normalizeWhatsAppNumber(process.env.PROVIDER_TEST_WHATSAPP_TO);
  if (!configuredProvider || normalizedFrom !== configuredProvider) return null;

  return pickPreferredBooking(activeBookings, preferredStatuses);
}

function matchLatestPendingProviderResponseBooking() {
  return store
    .list('bookings')
    .filter((booking) => booking.status === 'pending_provider_response')
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))[0] || null;
}

function pickPreferredBooking(bookings, preferredStatuses) {
  if (!bookings.length) return null;
  if (preferredStatuses?.size) {
    const preferred = bookings.find((booking) => preferredStatuses.has(booking.status));
    if (preferred) return preferred;
  }
  return bookings[0] || null;
}

function normalizeProposedSlot(proposedSlot, fallbackSlot) {
  const fallback = fallbackSlot ? new Date(fallbackSlot) : new Date();
  const relative = parseRelativeTimeOnFallbackDate(proposedSlot, fallback);
  if (relative) {
    return {
      iso: relative.toISOString(),
      label: formatSlotLabel(relative),
    };
  }

  const parsed = proposedSlot ? new Date(proposedSlot) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) ? parsed : fallback;
  return {
    iso: date.toISOString(),
    label: formatSlotLabel(date),
  };
}

function parseRelativeTimeOnFallbackDate(text, fallbackDate) {
  const match = String(text || '').match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|bajy|baje|bajay)\b/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toLowerCase();
  if (!Number.isFinite(hour) || hour < 1 || hour > 12 || !Number.isFinite(minute) || minute > 59) return null;
  if (meridiem === 'pm' && hour !== 12) {
    hour += 12;
  } else if (meridiem === 'am' && hour === 12) {
    hour = 0;
  } else if (['bajy', 'baje', 'bajay'].includes(meridiem)) {
    hour = inferHourFromFallback(hour, fallbackDate);
  }

  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fallbackDate).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});

  return new Date(`${dateParts.year}-${dateParts.month}-${dateParts.day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:00`);
}

function inferHourFromFallback(hour, fallbackDate) {
  const fallbackHour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    hour: 'numeric',
    hour12: false,
  }).format(fallbackDate));
  if (!Number.isFinite(fallbackHour)) return hour;
  if (hour === 12) return 12;
  return hour > fallbackHour ? hour : hour + 12;
}

function formatSlotLabel(date) {
  return new Intl.DateTimeFormat('en-PK', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Karachi',
  }).format(date);
}

module.exports = {
  addMessage,
  approveAction,
  ensureConversation,
  getConversationForBooking,
  handleProviderInbound,
  matchLatestActiveBookingByProvider,
  matchLatestPendingProviderResponseBooking,
  rejectAction,
  sendUserMessage,
};
