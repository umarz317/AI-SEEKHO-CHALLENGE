const cron = require('node-cron');
const bookingAgent = require('../agents/bookingAgent');
const store = require('../storage/localStore');
const { sendProviderReminder } = require('./providerMessaging');
const { sendUserReminderPush } = require('./pushNotifications');

// Default: every 30 seconds  ──  "*/30 * * * * *"
// Override via env: REMINDER_CRON="0 * * * * *" (every minute)
const DEFAULT_CRON = '*/30 * * * * *';
let task = null;
let running = false;

function notificationIdForReminder(reminderId) {
  return `NOTIF-${reminderId}`;
}

function updateReminderDelivery(reminder, patch) {
  const updatedReminder = store.updateById('reminders', 'reminderId', reminder.reminderId, {
    ...reminder,
    ...patch,
  });

  store.updateById('notifications', 'notificationId', notificationIdForReminder(reminder.reminderId), (notification) => ({
    ...notification,
    status: patch.status ?? notification.status,
    sentAt: patch.sentAt ?? notification.sentAt ?? null,
    error: patch.error ?? notification.error ?? null,
    delivery: patch.delivery ?? notification.delivery,
    updatedAt: patch.updatedAt ?? new Date().toISOString(),
  }));

  return updatedReminder;
}

function getDueReminders(now = new Date()) {
  return store.list('reminders').filter((reminder) => {
    if (reminder.status !== 'scheduled') return false;
    const scheduledFor = reminder.scheduledFor || reminder.reminderTime;
    if (!scheduledFor) return false;
    return new Date(scheduledFor).getTime() <= now.getTime();
  });
}

async function deliverReminder(reminder) {
  const booking = bookingAgent.getBooking(reminder.bookingId);
  const now = new Date().toISOString();

  if (!booking) {
    return updateReminderDelivery(reminder, {
      status: 'skipped',
      error: 'booking_not_found',
      updatedAt: now,
    });
  }

  try {
    let delivery;
    if (reminder.recipientType === 'provider') {
      delivery = await sendProviderReminder(booking);
    } else if (reminder.recipientType === 'user') {
      delivery = await sendUserReminderPush({ booking, reminder });
    } else {
      return updateReminderDelivery(reminder, {
        status: 'skipped',
        error: 'unknown_recipient_type',
        updatedAt: now,
      });
    }

    return updateReminderDelivery(reminder, {
      status: 'sent',
      sentAt: new Date().toISOString(),
      error: null,
      delivery,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const status = err.code === 'push_token_not_registered' ? 'skipped' : 'failed';
    return updateReminderDelivery(reminder, {
      status,
      error: err.message || 'reminder_delivery_failed',
      updatedAt: new Date().toISOString(),
    });
  }
}

async function processDueReminders(now = new Date()) {
  const due = getDueReminders(now);
  const results = [];
  for (const reminder of due) {
    results.push(await deliverReminder(reminder));
  }
  return results;
}

function startReminderScheduler({ cronExpression = process.env.REMINDER_CRON || DEFAULT_CRON } = {}) {
  if (task) return task;

  if (!cron.validate(cronExpression)) {
    console.error(`[reminder:scheduler] Invalid cron expression: "${cronExpression}". Falling back to default: "${DEFAULT_CRON}"`);
    cronExpression = DEFAULT_CRON;
  }

  console.log(`[reminder:scheduler] Starting with cron: "${cronExpression}"`);

  task = cron.schedule(cronExpression, async () => {
    if (running) return;
    running = true;
    try {
      await processDueReminders();
    } catch (err) {
      console.error('[reminder:scheduler] Error:', err);
    } finally {
      running = false;
    }
  });

  return task;
}

function stopReminderScheduler() {
  if (!task) return;
  task.stop();
  task = null;
}

module.exports = {
  deliverReminder,
  getDueReminders,
  processDueReminders,
  startReminderScheduler,
  stopReminderScheduler,
};

