import { createModuleLogger } from '../lib/logger';
import { db } from "../db";
import { sentNotifications, transactions, notificationSettings } from "@shared/schema";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";

const log = createModuleLogger('slack-notifications');

const SLACK_API_BASE = "https://slack.com/api";

function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function getEndOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

export interface NotificationPreferences {
  documentUploads: boolean;
  closingReminders: boolean;
  marketingAssets: boolean;
  reminder14Days: boolean;
  reminder7Days: boolean;
  reminder3Days: boolean;
  reminderDayOf: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  documentUploads: false,
  closingReminders: false,
  marketingAssets: false,
  reminder14Days: false,
  reminder7Days: false,
  reminder3Days: false,
  reminderDayOf: false,
};

export async function getUserNotificationSettings(userId: string): Promise<NotificationPreferences> {
  if (!userId) {
    return DEFAULT_PREFERENCES;
  }

  const settings = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  if (settings.length === 0) {
    return DEFAULT_PREFERENCES;
  }

  const s = settings[0];
  const closingReminders = s.closingReminders ?? false;
  
  // PARENT TOGGLE ENFORCEMENT: If closingReminders is OFF, all reminder schedules are OFF
  // Only use the 4 supported reminder types: 14, 7, 3, day of (ignore 30 days and 1 day)
  return {
    documentUploads: s.documentUploads ?? false,
    closingReminders,
    marketingAssets: s.marketingAssets ?? false,
    reminder14Days: closingReminders ? (s.reminder14Days ?? false) : false,
    reminder7Days: closingReminders ? (s.reminder7Days ?? false) : false,
    reminder3Days: closingReminders ? (s.reminder3Days ?? false) : false,
    reminderDayOf: closingReminders ? (s.reminderDayOf ?? false) : false,
  };
}

export async function updateUserNotificationSettings(
  userId: string, 
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  let updatedPrefs = { ...prefs };
  if (prefs.closingReminders === false) {
    updatedPrefs = {
      ...updatedPrefs,
      reminder14Days: false,
      reminder7Days: false,
      reminder3Days: false,
      reminderDayOf: false,
    };
  }

  const existing = await db
    .select()
    .from(notificationSettings)
    .where(eq(notificationSettings.userId, userId))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(notificationSettings).values({
      userId,
      documentUploads: updatedPrefs.documentUploads ?? false,
      closingReminders: updatedPrefs.closingReminders ?? false,
      marketingAssets: updatedPrefs.marketingAssets ?? false,
      reminder14Days: updatedPrefs.reminder14Days ?? false,
      reminder7Days: updatedPrefs.reminder7Days ?? false,
      reminder3Days: updatedPrefs.reminder3Days ?? false,
      reminderDayOf: updatedPrefs.reminderDayOf ?? false,
    });
  } else {
    await db
      .update(notificationSettings)
      .set({
        ...updatedPrefs,
        updatedAt: new Date(),
      })
      .where(eq(notificationSettings.userId, userId));
  }

  return getUserNotificationSettings(userId);
}

async function wasNotificationSentToday(
  transactionId: string,
  notificationType: string,
  channelId: string
): Promise<boolean> {
  const today = new Date();
  const startOfDay = getStartOfDay(today);
  const endOfDay = getEndOfDay(today);

  const existing = await db
    .select()
    .from(sentNotifications)
    .where(
      and(
        eq(sentNotifications.transactionId, transactionId),
        eq(sentNotifications.notificationType, notificationType),
        eq(sentNotifications.channelId, channelId),
        gte(sentNotifications.sentAt, startOfDay),
        lte(sentNotifications.sentAt, endOfDay)
      )
    )
    .limit(1);

  return existing.length > 0;
}

async function recordNotificationSent(
  transactionId: string,
  notificationType: string,
  channelId: string,
  messageTs?: string
): Promise<void> {
  await db.insert(sentNotifications).values({
    transactionId,
    notificationType,
    channelId,
    messageTs,
  });
}

async function sendSlackMessage(channelId: string, message: string): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        text: message,
        mrkdwn: true,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      return { ok: false, error: data.error };
    }
    return { ok: true, ts: data.ts };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Unknown error' };
  }
}

async function sendNotificationIfNotSent(
  transaction: any,
  notificationType: string,
  channelId: string,
  message: string
): Promise<{ sent: boolean; reason?: string }> {
  const alreadySent = await wasNotificationSentToday(
    transaction.id,
    notificationType,
    channelId
  );

  if (alreadySent) {
    log.info({ notificationType, address: transaction.propertyAddress }, 'SKIPPED (already sent today)');
    return { sent: false, reason: 'already_sent_today' };
  }

  const result = await sendSlackMessage(channelId, message);

  if (result.ok) {
    await recordNotificationSent(
      transaction.id,
      notificationType,
      channelId,
      result.ts
    );
    log.info({ notificationType, address: transaction.propertyAddress }, 'SENT');
    return { sent: true };
  } else {
    log.error({ error: result.error }, 'Send failed');
    return { sent: false, reason: 'send_failed' };
  }
}

interface ReminderConfig {
  daysBeforeClosing: number;
  notificationType: string;
  settingKey: keyof NotificationPreferences;
  messageTemplate: (address: string, closingDate: string) => string;
}

// Only 2 reminder options: 3 days before and day of closing
// Reduced from 4 options (14, 7, 3, 0) to simplify and prevent notification fatigue
const REMINDER_CONFIGS: ReminderConfig[] = [
  {
    daysBeforeClosing: 3,
    notificationType: 'closing_3_days',
    settingKey: 'reminder3Days',
    messageTemplate: (addr, date) => 
      `📅 *Closing Reminder*\n\n*${addr}* is closing in *3 days* on ${date}.\n\nFinal preparations should be underway.`,
  },
  {
    daysBeforeClosing: 0,
    notificationType: 'closing_day_of',
    settingKey: 'reminderDayOf',
    messageTemplate: (addr, date) => 
      `🎉 *Closing Day!*\n\n*${addr}* is closing *today*!\n\nGood luck with the closing!`,
  },
];

export async function processClosingDateNotifications(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  disabled: number;
  errors: number;
}> {
  const stats = { processed: 0, sent: 0, skipped: 0, disabled: 0, errors: 0 };
  
  // KILL SWITCH - check FIRST before any processing
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    log.warn('DISABLED - DISABLE_SLACK_NOTIFICATIONS=true');
    log.warn('Skipping all closing date notifications');
    return stats;
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    log.warn('Bot token not configured');
    return stats;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  log.info({ date: today.toDateString() }, 'Starting notification check');

  try {
    const transactionsToCheck = await db
      .select()
      .from(transactions)
      .where(
        and(
          isNotNull(transactions.closingDate),
          isNotNull(transactions.slackChannelId)
        )
      );

    log.info({ count: transactionsToCheck.length }, 'Found transactions to check');

    for (const transaction of transactionsToCheck) {
      stats.processed++;
      
      if (!transaction.closingDate || !transaction.slackChannelId) {
        continue;
      }

      // User-specific notification lookup - each transaction owner controls their own settings
      const userPrefs = await getUserNotificationSettings(transaction.userId || '');
      
      log.info({
        address: transaction.propertyAddress,
        userId: transaction.userId || '(none)',
        channelId: transaction.slackChannelId,
        closingReminders: userPrefs.closingReminders,
        reminder3Days: userPrefs.reminder3Days,
        reminderDayOf: userPrefs.reminderDayOf
      }, 'Processing transaction');

      if (!userPrefs.closingReminders) {
        log.info({ address: transaction.propertyAddress }, 'SKIPPED (closing reminders disabled)');
        stats.disabled++;
        continue;
      }

      const closingDate = new Date(transaction.closingDate);
      closingDate.setHours(0, 0, 0, 0);
      
      const daysUntilClosing = Math.ceil(
        (closingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      log.info({ address: transaction.propertyAddress, daysUntilClosing }, 'Checking days until closing');

      for (const config of REMINDER_CONFIGS) {
        if (daysUntilClosing === config.daysBeforeClosing) {
          if (!userPrefs[config.settingKey]) {
            log.info({ settingKey: config.settingKey, address: transaction.propertyAddress }, 'SKIPPED (setting disabled)');
            stats.disabled++;
            continue;
          }

          const message = config.messageTemplate(
            transaction.propertyAddress,
            formatDate(closingDate)
          );
          
          const result = await sendNotificationIfNotSent(
            transaction,
            config.notificationType,
            transaction.slackChannelId,
            message
          );
          
          if (result.sent) stats.sent++;
          else if (result.reason === 'already_sent_today') stats.skipped++;
          else stats.errors++;
        }
      }
    }
  } catch (error: any) {
    log.error({ err: error }, 'Error during notification processing');
    stats.errors++;
  }

  log.info({
    sent: stats.sent,
    skipped: stats.skipped,
    disabled: stats.disabled,
    errors: stats.errors,
    processed: stats.processed
  }, 'Notification check complete');

  return stats;
}

export async function sendTestNotification(channelId: string): Promise<{ success: boolean; error?: string }> {
  if (!process.env.SLACK_BOT_TOKEN) {
    return { success: false, error: 'Slack bot not configured' };
  }

  const result = await sendSlackMessage(
    channelId,
    `✅ *Test Notification*\n\nSlack bot is connected!\n\nTime: ${new Date().toLocaleString()}`
  );

  return { success: result.ok, error: result.error };
}

export function getNotificationStatus(): {
  botConfigured: boolean;
  notificationsEnabled: boolean;
  environment: string;
  availableReminders: string[];
} {
  return {
    botConfigured: !!process.env.SLACK_BOT_TOKEN,
    notificationsEnabled: process.env.DISABLE_SLACK_NOTIFICATIONS !== 'true',
    environment: process.env.NODE_ENV || 'development',
    availableReminders: ['3 days', 'Day of closing'],
  };
}
