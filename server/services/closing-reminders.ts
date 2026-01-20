import { storage } from "../storage";
import { sendClosingReminder } from "../slack";

const REMINDER_INTERVALS = [30, 14, 7, 3, 1, 0];
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour (will only send once per day at configured time)

let reminderIntervalId: NodeJS.Timeout | null = null;
let lastCheckDate: string | null = null;

function getDaysUntilClosing(closingDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const closing = new Date(closingDate);
  closing.setHours(0, 0, 0, 0);
  
  const diffTime = closing.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

function getReminderKey(daysRemaining: number): string {
  if (daysRemaining === 0) return 'reminderDayOf';
  if (daysRemaining === 1) return 'reminder1Day';
  if (daysRemaining === 3) return 'reminder3Days';
  if (daysRemaining === 7) return 'reminder7Days';
  if (daysRemaining === 14) return 'reminder14Days';
  if (daysRemaining === 30) return 'reminder30Days';
  return '';
}

async function checkAndSendReminders(): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Only run once per day
  if (lastCheckDate === today) {
    return;
  }
  
  console.log(`[ClosingReminders] Running daily reminder check for ${today}`);
  lastCheckDate = today;
  
  try {
    const transactions = await storage.getTransactionsWithClosingReminders();
    console.log(`[ClosingReminders] Found ${transactions.length} transactions with closing dates and Slack channels`);
    
    let sentCount = 0;
    
    for (const transaction of transactions) {
      if (!transaction.closingDate || !transaction.slackChannelId) continue;
      
      const daysRemaining = getDaysUntilClosing(transaction.closingDate);
      
      // Check if this is a reminder day
      if (!REMINDER_INTERVALS.includes(daysRemaining)) continue;
      
      // Check notification settings if user exists
      if (transaction.userId) {
        try {
          const settings = await storage.getNotificationSettings(
            transaction.userId, 
            transaction.id
          );
          
          // If settings exist, check if closing reminders are enabled
          if (settings) {
            if (!settings.closingReminders) {
              console.log(`[ClosingReminders] Skipping ${transaction.propertyAddress}: closing reminders disabled`);
              continue;
            }
            
            // Check specific interval setting
            const reminderKey = getReminderKey(daysRemaining);
            if (reminderKey && !(settings as any)[reminderKey]) {
              console.log(`[ClosingReminders] Skipping ${transaction.propertyAddress}: ${reminderKey} disabled`);
              continue;
            }
          }
        } catch (settingsError) {
          // If we can't get settings, proceed with sending (defaults to enabled)
          console.log(`[ClosingReminders] Could not get settings for ${transaction.propertyAddress}, proceeding with reminder`);
        }
      }
      
      // Send the reminder
      try {
        await sendClosingReminder(
          transaction.slackChannelId,
          transaction.propertyAddress,
          transaction.closingDate,
          daysRemaining
        );
        sentCount++;
        
        // Log activity
        await storage.createActivity({
          transactionId: transaction.id,
          type: 'closing_reminder_sent',
          description: `Closing reminder sent: ${daysRemaining === 0 ? 'Closing day!' : `${daysRemaining} days remaining`}`,
          category: 'communication',
        });
      } catch (sendError) {
        console.error(`[ClosingReminders] Failed to send reminder for ${transaction.propertyAddress}:`, sendError);
      }
    }
    
    console.log(`[ClosingReminders] Sent ${sentCount} closing reminders`);
  } catch (error) {
    console.error("[ClosingReminders] Error checking reminders:", error);
  }
}

export function startClosingRemindersScheduler(): void {
  // STOP ALL NOTIFICATIONS - Environment variable kill switch
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log('[ClosingReminders] DISABLED via DISABLE_SLACK_NOTIFICATIONS environment variable');
    return;
  }
  
  // Only run in production (Render) - prevents duplicate notifications from dev instances
  if (process.env.NODE_ENV !== 'production') {
    console.log('[ClosingReminders] Skipping - not in production environment (NODE_ENV:', process.env.NODE_ENV, ')');
    return;
  }
  
  if (reminderIntervalId) {
    console.log("[ClosingReminders] Scheduler already running");
    return;
  }
  
  console.log("[ClosingReminders] Starting closing reminders scheduler (hourly check)");
  
  // Run immediately on startup
  checkAndSendReminders();
  
  // Then check every hour (will only send once per day)
  reminderIntervalId = setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
  
  console.log("[ClosingReminders] Scheduler initialized");
}

export function stopClosingRemindersScheduler(): void {
  if (reminderIntervalId) {
    clearInterval(reminderIntervalId);
    reminderIntervalId = null;
    console.log("[ClosingReminders] Scheduler stopped");
  }
}

// Force a check (useful for testing)
export async function forceReminderCheck(): Promise<void> {
  lastCheckDate = null;
  await checkAndSendReminders();
}
