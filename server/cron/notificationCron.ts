import { processClosingDateNotifications, getNotificationStatus } from "../services/slackNotificationService";

let isProcessing = false;
let cronIntervalId: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null;

export function initializeNotificationCron(): void {
  // KILL SWITCH - check FIRST before any initialization
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NotificationCron] 🔴 DISABLED - DISABLE_SLACK_NOTIFICATIONS=true`);
    console.log(`[NotificationCron] ⚠️ No closing date reminders will be sent`);
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log(`[NotificationCron] Skipping - not in production environment (NODE_ENV: ${process.env.NODE_ENV})`);
    return;
  }

  if (cronIntervalId) {
    clearInterval(cronIntervalId);
  }

  cronIntervalId = setInterval(async () => {
    const now = new Date();
    const hour = now.getHours();
    const today = now.toISOString().split('T')[0];

    if (hour !== 9 || lastRunDate === today) {
      return;
    }

    if (isProcessing) {
      console.log("[NotificationCron] ⚠️ Already running, skipping...");
      return;
    }

    lastRunDate = today;
    isProcessing = true;
    console.log("[NotificationCron] 🚀 Starting daily notification job (9 AM CT)...");

    try {
      await processClosingDateNotifications();
    } catch (error) {
      console.error("[NotificationCron] ❌ Job failed:", error);
    } finally {
      isProcessing = false;
    }
  }, 60000);

  console.log("[NotificationCron] ✅ Notification cron initialized - runs daily at 9:00 AM CT");
}

export function stopNotificationCron(): void {
  if (cronIntervalId) {
    clearInterval(cronIntervalId);
    cronIntervalId = null;
    console.log("[NotificationCron] 🛑 Notification cron stopped");
  }
}

export async function triggerNotificationsNow(bypassDisable: boolean = false): Promise<any> {
  // Allow manual bypass for testing (default: false)
  if (!bypassDisable && process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    return { 
      success: false, 
      error: "Notifications disabled via environment variable. Use bypassDisable=true to test.",
      hint: "POST with { bypassDisable: true } to run in test mode (will still respect user preferences)"
    };
  }

  if (isProcessing) {
    return { success: false, error: "Already processing" };
  }

  isProcessing = true;
  try {
    const stats = await processClosingDateNotifications();
    return { success: true, stats, bypassUsed: bypassDisable };
  } finally {
    isProcessing = false;
  }
}

export function getCronStatus() {
  return {
    isRunning: cronIntervalId !== null,
    isProcessing,
    schedule: "Daily at 9:00 AM CT",
    lastRunDate,
    notificationStatus: getNotificationStatus(),
  };
}
