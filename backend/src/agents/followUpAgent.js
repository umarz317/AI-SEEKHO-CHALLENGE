// agents/followUpAgent.js — Agent 6: Follow-up / Reminder
// Schedules provider and user reminders for confirmed bookings

const store = require('../storage/localStore');
const { runWithAdapter, googleStubs } = require('../tools/mode');

/**
 * @param {{ bookingId: string, providerName: string, slot: string, slotLabel?: string, formattedLocation: string, serviceType?: string }} input
 * @returns {object} reminder info
 */
async function run(input) {
  const { bookingId, providerName, slot, slotLabel, formattedLocation, serviceType } = input;

  const mockImpl = async () => {
    if (!bookingId || !slot) {
      return { reminderId: null, status: 'skipped', reason: 'missing_data' };
    }

    // Reminder 1 hour before
    const slotDate = new Date(slot);
    const reminderDate = new Date(slotDate.getTime() - 60 * 60 * 1000);

    const h = reminderDate.getHours();
    const m = reminderDate.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const reminderTimeLabel = `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;

    const providerMessage = `Reminder: booking ${bookingId} is coming up. ${serviceType || 'Service'} in ${formattedLocation || 'the customer area'} at ${slotLabel || formatSlotTime(slotDate)}.`;
    const userMessage = `Reminder: ${providerName || 'Your provider'} will visit at ${slotLabel || formatSlotTime(slotDate)} for ${serviceType || 'your service'} in ${formattedLocation || 'your location'}.`;
    const createdAt = new Date().toISOString();
    const base = {
      bookingId,
      reminderTime: reminderDate.toISOString(),
      scheduledFor: reminderDate.toISOString(),
      reminderTimeLabel,
      completionCheckScheduled: true,
      status: 'scheduled',
      sentAt: null,
      error: null,
      createdAt,
    };

    const reminders = [
      {
        ...base,
        reminderId: `REM-${bookingId}-provider`,
        recipientType: 'provider',
        channel: 'twilio_whatsapp',
        message: providerMessage,
        reminderMessage: providerMessage,
      },
      {
        ...base,
        reminderId: `REM-${bookingId}-user`,
        recipientType: 'user',
        channel: 'expo_push',
        message: userMessage,
        reminderMessage: userMessage,
      },
    ];

    for (const reminder of reminders) {
      store.upsertById('reminders', 'reminderId', reminder.reminderId, reminder);
      store.upsertById('notifications', 'notificationId', `NOTIF-${reminder.reminderId}`, {
        notificationId: `NOTIF-${reminder.reminderId}`,
        bookingId,
        type: 'reminder',
        recipientType: reminder.recipientType,
        channel: reminder.channel,
        message: reminder.message,
        scheduledFor: reminder.scheduledFor,
        status: reminder.status,
        sentAt: reminder.sentAt,
        error: reminder.error,
        createdAt: reminder.createdAt,
      });
    }

    return {
      reminderId: `REM-${bookingId}`,
      bookingId,
      reminders,
      reminderTime: base.reminderTime,
      scheduledFor: base.scheduledFor,
      reminderTimeLabel,
      reminderMessage: userMessage,
      status: 'scheduled',
      createdAt,
    };
  };

  return runWithAdapter('reminder', mockImpl, googleStubs.reminder);
}

function getAllReminders() {
  return store.list('reminders');
}

function getAllNotifications() {
  return store.list('notifications');
}

function formatSlotTime(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

module.exports = { run, getAllReminders, getAllNotifications };
