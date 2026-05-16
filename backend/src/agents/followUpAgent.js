// agents/followUpAgent.js — Agent 6: Follow-up / Reminder
// Schedules a simulated reminder for the booking

const store = require('../storage/localStore');
const { runWithAdapter, googleStubs } = require('../tools/mode');

/**
 * @param {{ bookingId: string, providerName: string, slot: string, formattedLocation: string }} input
 * @returns {object} reminder info
 */
async function run(input) {
  const { bookingId, providerName, slot, formattedLocation } = input;

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

    const reminder = {
      reminderId: `REM-${bookingId}`,
      bookingId,
      reminderTime: reminderDate.toISOString(),
      reminderTimeLabel,
      reminderMessage: `Reminder: ${providerName} will visit today at ${formatSlotTime(slotDate)} for service in ${formattedLocation || 'your location'}.`,
      completionCheckScheduled: true,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    store.insert('reminders', reminder);
    store.insert('notifications', {
      notificationId: `NOTIF-${bookingId}`,
      bookingId,
      type: 'reminder',
      channel: 'mock_log',
      message: reminder.reminderMessage,
      scheduledFor: reminder.reminderTime,
      status: 'scheduled',
      createdAt: reminder.createdAt,
    });

    return reminder;
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
