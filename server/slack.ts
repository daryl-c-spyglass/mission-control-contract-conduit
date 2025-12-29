// Real Slack API integration using SLACK_BOT_TOKEN

const SLACK_API_BASE = "https://slack.com/api";

async function slackRequest(method: string, body: Record<string, any>): Promise<any> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new Error("SLACK_BOT_TOKEN not configured");
  }

  const response = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack API error: ${data.error}`);
  }
  return data;
}

export async function createSlackChannel(name: string): Promise<{ channelId: string; channelName: string }> {
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);

  const data = await slackRequest("conversations.create", {
    name: cleanName,
    is_private: false,
  });

  return {
    channelId: data.channel.id,
    channelName: data.channel.name,
  };
}

export async function inviteUsersToChannel(channelId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;

  // Filter out empty/invalid user IDs
  const validUserIds = userIds.filter(id => id && id.trim());
  if (validUserIds.length === 0) return;

  try {
    await slackRequest("conversations.invite", {
      channel: channelId,
      users: validUserIds.join(","),
    });
  } catch (error: any) {
    // Handle common cases where invite fails but isn't a real error
    const errorMessage = error?.message || "";
    if (errorMessage.includes("already_in_channel") || 
        errorMessage.includes("is_archived") ||
        errorMessage.includes("cant_invite_self")) {
      console.log(`Slack invite non-fatal: ${errorMessage}`);
      return;
    }
    // Re-throw other errors
    console.error("Failed to invite users to Slack channel:", error);
    throw error;
  }
}

export async function postToChannel(channelId: string, text: string): Promise<void> {
  await slackRequest("chat.postMessage", {
    channel: channelId,
    text,
  });
}

export async function lookupUserByEmail(email: string): Promise<string | null> {
  try {
    const data = await slackRequest("users.lookupByEmail", { email });
    return data.user?.id || null;
  } catch {
    return null;
  }
}
