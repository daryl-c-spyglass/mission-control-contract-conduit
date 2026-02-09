import { createModuleLogger } from '../lib/logger';
import { storage } from "../storage";
import { sendClosingReminder } from "../slack";

const log = createModuleLogger('notifications');

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
  
  log.info({ date: today }, 'Running daily reminder check');
  lastCheckDate = today;
  
  try {
    const transactions = await storage.getTransactionsWithClosingReminders();
    log.info({ count: transactions.length }, 'Found transactions with closing dates and Slack channels');
    
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
              log.info({ address: transaction.propertyAddress }, 'Skipping: closing reminders disabled');
              continue;
            }
            
            // Check specific interval setting
            const reminderKey = getReminderKey(daysRemaining);
            if (reminderKey && !(settings as any)[reminderKey]) {
              log.info({ address: transaction.propertyAddress, reminderKey }, 'Skipping: reminder interval disabled');
              continue;
            }
          }
        } catch (settingsError) {
          // If we can't get settings, proceed with sending (defaults to enabled)
          log.info({ address: transaction.propertyAddress }, 'Could not get settings, proceeding with reminder');
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
        log.error({ err: sendError, address: transaction.propertyAddress }, 'Failed to send reminder');
      }
    }
    
    log.info({ sentCount }, 'Closing reminders sent');
  } catch (error) {
    log.error({ err: error }, 'Error checking reminders');
  }
}

export function startClosingRemindersScheduler(): void {
  // STOP ALL NOTIFICATIONS - Environment variable kill switch
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    log.warn('DISABLED via DISABLE_SLACK_NOTIFICATIONS environment variable');
    return;
  }
  
  // Only run in production (Render) - prevents duplicate notifications from dev instances
  if (process.env.NODE_ENV !== 'production') {
    log.info({ nodeEnv: process.env.NODE_ENV }, 'Skipping - not in production environment');
    return;
  }
  
  if (reminderIntervalId) {
    log.info('Scheduler already running');
    return;
  }
  
  log.info('Starting closing reminders scheduler (hourly check)');
  
  // Run immediately on startup
  checkAndSendReminders();
  
  // Then check every hour (will only send once per day)
  reminderIntervalId = setInterval(checkAndSendReminders, CHECK_INTERVAL_MS);
  
  log.info('Scheduler initialized');
}

export function stopClosingRemindersScheduler(): void {
  if (reminderIntervalId) {
    clearInterval(reminderIntervalId);
    reminderIntervalId = null;
    log.info('Scheduler stopped');
  }
}

// Force a check (useful for testing)
export async function forceReminderCheck(): Promise<void> {
  lastCheckDate = null;
  await checkAndSendReminders();
}
