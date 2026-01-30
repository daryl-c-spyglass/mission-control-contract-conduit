import { db } from "../db";
import { sentNotifications, transactions, notificationSettings } from "@shared/schema";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";

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
    console.log(`[Slack] SKIPPED (already sent today): ${notificationType} for "${transaction.propertyAddress}"`);
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
    console.log(`[Slack] ✅ SENT: ${notificationType} for "${transaction.propertyAddress}"`);
    return { sent: true };
  } else {
    console.error(`[Slack] ❌ ERROR: ${result.error}`);
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
    console.log(`[Slack] 🔴 DISABLED - DISABLE_SLACK_NOTIFICATIONS=true`);
    console.log(`[Slack] ⚠️ Skipping all closing date notifications`);
    return stats;
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    console.log(`[Slack] ⚠️ Bot token not configured`);
    return stats;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`\n========================================`);
  console.log(`[Slack] Starting notification check: ${today.toDateString()}`);
  console.log(`========================================\n`);

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

    console.log(`[Slack] Found ${transactionsToCheck.length} transactions to check`);

    for (const transaction of transactionsToCheck) {
      stats.processed++;
      
      if (!transaction.closingDate || !transaction.slackChannelId) {
        continue;
      }

      // User-specific notification lookup - each transaction owner controls their own settings
      const userPrefs = await getUserNotificationSettings(transaction.userId || '');
      
      console.log(`[Slack] Processing: "${transaction.propertyAddress}"`);
      console.log(`[Slack]   Owner userId: ${transaction.userId || '(none)'}`);
      console.log(`[Slack]   Channel: ${transaction.slackChannelId}`);
      console.log(`[Slack]   User prefs: closingReminders=${userPrefs.closingReminders}, 3days=${userPrefs.reminder3Days}, dayOf=${userPrefs.reminderDayOf}`);

      if (!userPrefs.closingReminders) {
        console.log(`[Slack] SKIPPED (closing reminders disabled): "${transaction.propertyAddress}"`);
        stats.disabled++;
        continue;
      }

      const closingDate = new Date(transaction.closingDate);
      closingDate.setHours(0, 0, 0, 0);
      
      const daysUntilClosing = Math.ceil(
        (closingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log(`[Slack] Checking "${transaction.propertyAddress}" - ${daysUntilClosing} days until closing`);

      for (const config of REMINDER_CONFIGS) {
        if (daysUntilClosing === config.daysBeforeClosing) {
          if (!userPrefs[config.settingKey]) {
            console.log(`[Slack] SKIPPED (${config.settingKey} disabled): "${transaction.propertyAddress}"`);
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
    console.error(`[Slack] Error:`, error);
    stats.errors++;
  }

  console.log(`\n========================================`);
  console.log(`[Slack] Notification check complete:`);
  console.log(`  ✅ Sent: ${stats.sent}`);
  console.log(`  ⏭️ Skipped (already sent): ${stats.skipped}`);
  console.log(`  🔕 Disabled by user: ${stats.disabled}`);
  console.log(`  ❌ Errors: ${stats.errors}`);
  console.log(`  📊 Total processed: ${stats.processed}`);
  console.log(`========================================\n`);

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
