import { db } from '../db';
import { transactions, activities, userNotificationPreferences } from '../../shared/schema';
import { eq, isNotNull, desc, and } from 'drizzle-orm';

const SLACK_API_BASE = "https://slack.com/api";

interface DiagnosticResult {
  timestamp: string;
  environment: string;
  notificationFlags: {
    DISABLE_SLACK_NOTIFICATIONS: string;
    SLACK_BOT_TOKEN_DISABLE: string;
    SLACK_API_TOKEN_DISABLE: string;
    notificationsEnabled: boolean;
  };
  tokens: {
    hasBotToken: boolean;
    hasApiToken: boolean;
  };
  uatMode: {
    enabled: boolean;
    testEmails: string[];
  };
  slackConnection: {
    authTest: {
      status: 'pass' | 'fail' | 'skipped';
      team?: string;
      user?: string;
      botId?: string;
      error?: string;
    };
    channelAccess: Array<{
      name: string;
      id: string;
      status: 'pass' | 'fail';
      isMember?: boolean;
      error?: string;
    }>;
  };
  scheduler: {
    notificationCronStatus: string;
    nodeEnv: string;
  };
  database: {
    totalTransactions: number;
    withClosingDates: number;
    withSlackChannels: number;
    upcomingClosings7Days: Array<{
      id: string;
      address: string;
      closingDate: string;
      daysUntil: number;
      hasSlackChannel: boolean;
    }>;
    upcomingClosings14Days: Array<{
      id: string;
      address: string;
      closingDate: string;
      daysUntil: number;
      hasSlackChannel: boolean;
    }>;
  };
  userPreferences: Array<{
    userId: string;
    closingReminders: boolean;
    reminder3Days: boolean;
    reminder7Days: boolean;
    reminder14Days: boolean;
    reminderDayOf: boolean;
  }>;
  recentNotifications: Array<{
    id: string;
    type: string;
    description: string;
    createdAt: Date | null;
    transactionId: string;
  }>;
  readiness: {
    tokensConfigured: boolean;
    notificationsDisabled: boolean;
    schedulerSafe: boolean;
    ready: boolean;
  };
}

const UAT_TEST_EMAILS = [
  'daryl@spyglassrealty.com',
  'ryan@spyglassrealty.com'
];

const CHANNELS_TO_CHECK = [
  { name: '#coming-soon-listings', id: 'C09J6327HQS' },
];

async function testSlackAuth(): Promise<DiagnosticResult['slackConnection']['authTest']> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { status: 'skipped', error: 'SLACK_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`${SLACK_API_BASE}/auth.test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const data = await response.json();
    
    if (data.ok) {
      return {
        status: 'pass',
        team: data.team,
        user: data.user,
        botId: data.bot_id,
      };
    } else {
      return { status: 'fail', error: data.error };
    }
  } catch (error: any) {
    return { status: 'fail', error: error.message };
  }
}

async function checkChannelAccess(): Promise<DiagnosticResult['slackConnection']['channelAccess']> {
  const token = process.env.SLACK_BOT_TOKEN;
  const results: DiagnosticResult['slackConnection']['channelAccess'] = [];

  if (!token) {
    return CHANNELS_TO_CHECK.map(ch => ({
      name: ch.name,
      id: ch.id,
      status: 'fail' as const,
      error: 'No bot token configured',
    }));
  }

  for (const channel of CHANNELS_TO_CHECK) {
    try {
      const response = await fetch(`${SLACK_API_BASE}/conversations.info?channel=${channel.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (data.ok) {
        results.push({
          name: channel.name,
          id: channel.id,
          status: 'pass',
          isMember: data.channel?.is_member,
        });
      } else {
        results.push({
          name: channel.name,
          id: channel.id,
          status: 'fail',
          error: data.error,
        });
      }
    } catch (error: any) {
      results.push({
        name: channel.name,
        id: channel.id,
        status: 'fail',
        error: error.message,
      });
    }
  }

  return results;
}

export async function runSlackDiagnostics(): Promise<DiagnosticResult> {
  const disableNotifications = process.env.DISABLE_SLACK_NOTIFICATIONS || 'not set';
  const disableBotToken = process.env.SLACK_BOT_TOKEN_DISABLE || 'not set';
  const disableApiToken = process.env.SLACK_API_TOKEN_DISABLE || 'not set';
  
  const notificationsEnabled = !(
    disableNotifications === 'true' ||
    disableBotToken === 'true' ||
    disableApiToken === 'true'
  );

  const hasBotToken = !!process.env.SLACK_BOT_TOKEN;
  const hasApiToken = !!process.env.SLACK_API_TOKEN;
  const uatModeEnabled = process.env.UAT_MODE === 'true';

  const authTest = await testSlackAuth();
  const channelAccess = await checkChannelAccess();

  let allTransactions: any[] = [];
  let userPrefs: any[] = [];
  let recentNotifications: any[] = [];

  try {
    allTransactions = await db.select().from(transactions);
  } catch (e) {
    console.error('Error fetching transactions:', e);
  }

  try {
    userPrefs = await db.select().from(userNotificationPreferences);
  } catch (e) {
    console.error('Error fetching user preferences:', e);
  }

  try {
    recentNotifications = await db
      .select()
      .from(activities)
      .where(eq(activities.type, 'notification'))
      .orderBy(desc(activities.createdAt))
      .limit(10);
  } catch (e) {
    console.error('Error fetching notifications:', e);
  }

  const withClosingDates = allTransactions.filter(t => t.closingDate && t.closingDate !== '');
  const withSlackChannels = allTransactions.filter(t => t.slackChannelId);

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const upcomingClosings7Days = withClosingDates
    .filter(t => {
      try {
        const closing = new Date(t.closingDate);
        return closing >= now && closing <= in7Days;
      } catch {
        return false;
      }
    })
    .map(t => {
      const closing = new Date(t.closingDate);
      return {
        id: t.id,
        address: t.propertyAddress || 'Unknown',
        closingDate: t.closingDate,
        daysUntil: Math.ceil((closing.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        hasSlackChannel: !!t.slackChannelId,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const upcomingClosings14Days = withClosingDates
    .filter(t => {
      try {
        const closing = new Date(t.closingDate);
        return closing > in7Days && closing <= in14Days;
      } catch {
        return false;
      }
    })
    .map(t => {
      const closing = new Date(t.closingDate);
      return {
        id: t.id,
        address: t.propertyAddress || 'Unknown',
        closingDate: t.closingDate,
        daysUntil: Math.ceil((closing.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
        hasSlackChannel: !!t.slackChannelId,
      };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const schedulerStatus = process.env.DISABLE_SLACK_NOTIFICATIONS === 'true' 
    ? 'DISABLED (kill switch active)' 
    : (process.env.NODE_ENV === 'production' ? 'ENABLED (production)' : 'PAUSED (not production)');

  const tokensConfigured = hasBotToken || hasApiToken;
  const notificationsDisabled = !notificationsEnabled;
  const schedulerSafe = schedulerStatus.includes('DISABLED') || schedulerStatus.includes('PAUSED');

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    notificationFlags: {
      DISABLE_SLACK_NOTIFICATIONS: disableNotifications,
      SLACK_BOT_TOKEN_DISABLE: disableBotToken,
      SLACK_API_TOKEN_DISABLE: disableApiToken,
      notificationsEnabled,
    },
    tokens: {
      hasBotToken,
      hasApiToken,
    },
    uatMode: {
      enabled: uatModeEnabled,
      testEmails: UAT_TEST_EMAILS,
    },
    slackConnection: {
      authTest,
      channelAccess,
    },
    scheduler: {
      notificationCronStatus: schedulerStatus,
      nodeEnv: process.env.NODE_ENV || 'development',
    },
    database: {
      totalTransactions: allTransactions.length,
      withClosingDates: withClosingDates.length,
      withSlackChannels: withSlackChannels.length,
      upcomingClosings7Days,
      upcomingClosings14Days,
    },
    userPreferences: userPrefs.map(p => ({
      userId: p.userId,
      closingReminders: p.notifyClosingReminders ?? false,
      reminder3Days: p.reminder3Days ?? false,
      reminder7Days: p.reminder7Days ?? false,
      reminder14Days: p.reminder14Days ?? false,
      reminderDayOf: p.reminderDayOf ?? false,
    })),
    recentNotifications: recentNotifications.map(n => ({
      id: n.id,
      type: n.type,
      description: n.description || '',
      createdAt: n.createdAt,
      transactionId: n.transactionId,
    })),
    readiness: {
      tokensConfigured,
      notificationsDisabled,
      schedulerSafe,
      ready: tokensConfigured && notificationsDisabled && schedulerSafe,
    },
  };
}

export function formatDiagnosticsReport(diagnostics: DiagnosticResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔════════════════════════════════════════════════════════════════╗');
  lines.push('║           SLACK NOTIFICATIONS DIAGNOSTIC REPORT                ║');
  lines.push('║                   Pre-UAT Friday Testing                       ║');
  lines.push('╠════════════════════════════════════════════════════════════════╣');
  lines.push(`║ Run Time: ${diagnostics.timestamp.padEnd(52)}║`);
  lines.push(`║ Environment: ${diagnostics.environment.padEnd(49)}║`);
  lines.push('╚════════════════════════════════════════════════════════════════╝');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 1. NOTIFICATION FLAGS                                           │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  lines.push(`│ DISABLE_SLACK_NOTIFICATIONS:  ${diagnostics.notificationFlags.DISABLE_SLACK_NOTIFICATIONS.padEnd(33)}│`);
  lines.push(`│ SLACK_BOT_TOKEN_DISABLE:      ${diagnostics.notificationFlags.SLACK_BOT_TOKEN_DISABLE.padEnd(33)}│`);
  lines.push(`│ SLACK_API_TOKEN_DISABLE:      ${diagnostics.notificationFlags.SLACK_API_TOKEN_DISABLE.padEnd(33)}│`);
  lines.push('│                                                                 │');
  if (diagnostics.notificationFlags.notificationsEnabled) {
    lines.push('│ Status: 🟢 NOTIFICATIONS ENABLED                                │');
  } else {
    lines.push('│ Status: 🔴 NOTIFICATIONS DISABLED (safe for pre-UAT)            │');
  }
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 2. SLACK TOKENS                                                 │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  lines.push(`│ SLACK_BOT_TOKEN:  ${diagnostics.tokens.hasBotToken ? '✅ Set (hidden)' : '❌ Missing'.padEnd(45)}│`);
  lines.push(`│ SLACK_API_TOKEN:  ${diagnostics.tokens.hasApiToken ? '✅ Set (hidden)' : '❌ Missing'.padEnd(45)}│`);
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 3. SLACK API CONNECTION (Read-Only Test)                        │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  const auth = diagnostics.slackConnection.authTest;
  lines.push(`│ Auth Test: ${auth.status === 'pass' ? '✅ PASS' : auth.status === 'skipped' ? '⏭️ SKIPPED' : '❌ FAIL'.padEnd(52)}│`);
  if (auth.team) lines.push(`│   Team: ${auth.team.padEnd(55)}│`);
  if (auth.user) lines.push(`│   User: ${auth.user.padEnd(55)}│`);
  if (auth.error) lines.push(`│   Error: ${auth.error.substring(0, 53).padEnd(54)}│`);
  lines.push('│                                                                 │');
  lines.push('│ Channel Access:                                                 │');
  for (const ch of diagnostics.slackConnection.channelAccess) {
    const status = ch.status === 'pass' ? (ch.isMember ? '✅ Member' : '⚠️ Not Member') : '❌ Failed';
    lines.push(`│   ${ch.name.padEnd(30)} ${status.padEnd(29)}│`);
  }
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 4. SCHEDULER STATUS                                             │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  lines.push(`│ Notification Cron: ${diagnostics.scheduler.notificationCronStatus.padEnd(44)}│`);
  lines.push(`│ NODE_ENV: ${diagnostics.scheduler.nodeEnv.padEnd(53)}│`);
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 5. UAT TEST MODE                                                │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  lines.push(`│ UAT_MODE: ${diagnostics.uatMode.enabled ? 'true' : 'not set / false'.padEnd(53)}│`);
  lines.push('│ Test Users:                                                     │');
  for (const email of diagnostics.uatMode.testEmails) {
    lines.push(`│   • ${email.padEnd(59)}│`);
  }
  lines.push('│                                                                 │');
  if (diagnostics.uatMode.enabled) {
    lines.push('│ Status: 🧪 UAT MODE - Only test users receive notifications     │');
  } else {
    lines.push('│ Status: 🚀 PRODUCTION MODE (or disabled)                        │');
  }
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 6. DATABASE STATUS                                              │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  lines.push(`│ Total Transactions: ${String(diagnostics.database.totalTransactions).padEnd(43)}│`);
  lines.push(`│ With Closing Dates: ${String(diagnostics.database.withClosingDates).padEnd(43)}│`);
  lines.push(`│ With Slack Channels: ${String(diagnostics.database.withSlackChannels).padEnd(42)}│`);
  lines.push('│                                                                 │');
  lines.push(`│ Upcoming Closings (next 7 days): ${String(diagnostics.database.upcomingClosings7Days.length).padEnd(30)}│`);
  for (const closing of diagnostics.database.upcomingClosings7Days.slice(0, 5)) {
    const addr = closing.address.substring(0, 35);
    lines.push(`│   • ${addr} (${closing.daysUntil} days)`.padEnd(65) + '│');
  }
  lines.push('│                                                                 │');
  lines.push(`│ Upcoming Closings (8-14 days): ${String(diagnostics.database.upcomingClosings14Days.length).padEnd(32)}│`);
  for (const closing of diagnostics.database.upcomingClosings14Days.slice(0, 3)) {
    const addr = closing.address.substring(0, 35);
    lines.push(`│   • ${addr} (${closing.daysUntil} days)`.padEnd(65) + '│');
  }
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 7. USER NOTIFICATION PREFERENCES                                │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  if (diagnostics.userPreferences.length === 0) {
    lines.push('│ No user preferences configured                                  │');
  } else {
    for (const pref of diagnostics.userPreferences) {
      lines.push(`│ User: ${pref.userId.substring(0, 20).padEnd(57)}│`);
      lines.push(`│   Closing Reminders: ${pref.closingReminders ? '✅' : '❌'}  3-Day: ${pref.reminder3Days ? '✅' : '❌'}  7-Day: ${pref.reminder7Days ? '✅' : '❌'}  14-Day: ${pref.reminder14Days ? '✅' : '❌'}  Day-Of: ${pref.reminderDayOf ? '✅' : '❌'} │`);
    }
  }
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('┌─────────────────────────────────────────────────────────────────┐');
  lines.push('│ 8. RECENT NOTIFICATION ACTIVITY                                 │');
  lines.push('├─────────────────────────────────────────────────────────────────┤');
  if (diagnostics.recentNotifications.length === 0) {
    lines.push('│ No recent notification activity found                           │');
  } else {
    for (const notif of diagnostics.recentNotifications.slice(0, 5)) {
      const desc = notif.description.substring(0, 55);
      lines.push(`│ • ${desc.padEnd(61)}│`);
    }
  }
  lines.push('└─────────────────────────────────────────────────────────────────┘');
  lines.push('');

  lines.push('╔════════════════════════════════════════════════════════════════╗');
  lines.push('║                     READINESS SUMMARY                          ║');
  lines.push('╠════════════════════════════════════════════════════════════════╣');
  lines.push('║                                                                ║');
  lines.push(`║  ${diagnostics.readiness.tokensConfigured ? '✅' : '❌'} Slack tokens configured                                    ║`);
  lines.push(`║  ${diagnostics.readiness.notificationsDisabled ? '✅' : '⚠️'} Notifications currently OFF (safe)                         ║`);
  lines.push(`║  ${diagnostics.readiness.schedulerSafe ? '✅' : '⚠️'} Scheduler safe (disabled or paused)                         ║`);
  lines.push('║                                                                ║');
  if (diagnostics.readiness.ready) {
    lines.push('║  🟢 SYSTEM READY FOR UAT TESTING                               ║');
  } else {
    lines.push('║  🟡 REVIEW ITEMS ABOVE BEFORE ENABLING                         ║');
  }
  lines.push('║                                                                ║');
  lines.push('║  📋 TO ENABLE FOR FRIDAY UAT:                                  ║');
  lines.push('║     1. Set UAT_MODE = true (limit to test users)               ║');
  lines.push('║     2. Set DISABLE_SLACK_NOTIFICATIONS = false                 ║');
  lines.push('║     3. Set SLACK_BOT_TOKEN_DISABLE = false                     ║');
  lines.push('║     4. Set SLACK_API_TOKEN_DISABLE = false                     ║');
  lines.push('║     5. Test with ONE transaction first                         ║');
  lines.push('║                                                                ║');
  lines.push('╚════════════════════════════════════════════════════════════════╝');
  lines.push('');

  return lines.join('\n');
}
