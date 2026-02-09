// Real Slack API integration using SLACK_BOT_TOKEN
import OpenAI from "openai";

const SLACK_API_BASE = "https://slack.com/api";

/**
 * Summarize a property description using AI for Slack notifications
 */
export async function summarizeDescription(description: string, maxLength: number = 200): Promise<string> {
  // If already short enough, return as-is
  if (!description || description.length <= maxLength) {
    return description;
  }

  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a real estate assistant. Summarize property descriptions concisely while keeping the most important selling points. Keep it under 200 characters. Do not use quotes around the summary.'
        },
        {
          role: 'user',
          content: `Summarize this property description:\n\n${description}`
        }
      ],
      max_tokens: 100,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() || description.substring(0, maxLength) + '...';
  } catch (error) {
    console.error('Failed to summarize description:', error);
    // Fallback to simple truncation if AI fails
    return description.substring(0, maxLength) + '...';
  }
}

// Global notification kill switch - blocks ALL Slack API calls that send messages
function isSlackNotificationsDisabled(): boolean {
  const disabled = process.env.DISABLE_SLACK_NOTIFICATIONS === 'true';
  return disabled;
}

// Verbose logging helper for Slack operations
function logSlackOp(emoji: string, message: string, data?: Record<string, any>): void {
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[SLACK] ${emoji} ${message}${dataStr}`);
}

async function slackRequest(method: string, body: Record<string, any>): Promise<any> {
  // KILL SWITCH: Block all message-sending API calls when notifications are disabled
  const messageMethods = ['chat.postMessage', 'chat.update', 'files.upload', 'files.uploadV2'];
  if (isSlackNotificationsDisabled() && messageMethods.includes(method)) {
    logSlackOp('⛔', `BLOCKED ${method} - notifications disabled`, { channel: body.channel || 'unknown' });
    return { ok: true, blocked: true, message: 'Notifications disabled via DISABLE_SLACK_NOTIFICATIONS' };
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    logSlackOp('❌', 'SLACK_BOT_TOKEN not configured');
    throw new Error("SLACK_BOT_TOKEN not configured");
  }

  logSlackOp('📡', `API call: ${method}`, { 
    channel: body.channel || body.name || 'N/A',
    tokenPrefix: token.substring(0, 15) + '...'
  });

  try {
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
      logSlackOp('❌', `API error: ${method}`, { 
        error: data.error, 
        needed: data.needed,
        provided: data.provided 
      });
      throw new Error(`Slack API error: ${data.error}`);
    }
    
    logSlackOp('✅', `API success: ${method}`, { 
      channelId: data.channel?.id,
      channelName: data.channel?.name,
      ts: data.ts
    });
    return data;
  } catch (error: any) {
    logSlackOp('💥', `API exception: ${method}`, { 
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });
    throw error;
  }
}

export async function createSlackChannel(name: string): Promise<{ channelId: string; channelName: string } | null> {
  logSlackOp('🔨', 'createSlackChannel called', {
    channelName: name,
    DISABLE_SLACK_NOTIFICATIONS: process.env.DISABLE_SLACK_NOTIFICATIONS,
    SLACK_BOT_TOKEN_exists: !!process.env.SLACK_BOT_TOKEN,
    tokenPrefix: process.env.SLACK_BOT_TOKEN?.substring(0, 15) + '...'
  });

  if (isSlackNotificationsDisabled()) {
    logSlackOp('⛔', `Channel creation SKIPPED - notifications disabled`, { channelName: name });
    return null; // Return null so caller knows channel wasn't created
  }
  
  const cleanName = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);

  logSlackOp('🏗️', `Creating channel with sanitized name`, { original: name, sanitized: cleanName });

  try {
    const data = await slackRequest("conversations.create", {
      name: cleanName,
      is_private: false,
    });

    logSlackOp('✅', 'Channel created successfully', {
      channelId: data.channel.id,
      channelName: data.channel.name
    });

    return {
      channelId: data.channel.id,
      channelName: data.channel.name,
    };
  } catch (error: any) {
    logSlackOp('❌', 'Channel creation FAILED', {
      error: error.message,
      channelName: cleanName
    });
    throw error;
  }
}

export async function inviteUsersToChannel(channelId: string, userIds: string[]): Promise<void> {
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have invited users to channel ${channelId}: ${userIds.join(', ')}`);
    return;
  }
  
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
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have posted to channel ${channelId}: ${text.substring(0, 100)}...`);
    return;
  }
  
  await slackRequest("chat.postMessage", {
    channel: channelId,
    text,
  });
}

interface DocumentUploadNotification {
  documentName: string;
  documentType: string;
  fileFormat: string;
  fileSize: string;
  notes?: string;
  propertyAddress: string;
  uploadedBy: string;
}

/**
 * Send a detailed Block Kit notification about a document upload
 */
export async function postDocumentUploadNotification(
  channelId: string,
  doc: DocumentUploadNotification
): Promise<void> {
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have sent document upload notification for: ${doc.documentName} at ${doc.propertyAddress}`);
    return;
  }
  
  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "New Document Uploaded",
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Document Name:*\n${doc.documentName}`
        },
        {
          type: "mrkdwn",
          text: `*Document Type:*\n${doc.documentType}`
        },
        {
          type: "mrkdwn",
          text: `*File Format:*\n${doc.fileFormat.toUpperCase()}`
        },
        {
          type: "mrkdwn",
          text: `*File Size:*\n${doc.fileSize}`
        }
      ]
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Property:*\n${doc.propertyAddress}`
        },
        {
          type: "mrkdwn",
          text: `*Uploaded By:*\n${doc.uploadedBy}`
        }
      ]
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Uploaded on ${timestamp}`
        }
      ]
    }
  ];

  // Add notes section if notes exist
  if (doc.notes && doc.notes.trim()) {
    blocks.splice(3, 0, {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Notes:*\n${doc.notes}`
      }
    });
  }

  await slackRequest("chat.postMessage", {
    channel: channelId,
    text: `New document uploaded: ${doc.documentName}`,
    blocks,
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

/**
 * Upload an image from a URL to a Slack channel
 */
export async function uploadImageFromUrl(
  channelId: string,
  imageUrl: string,
  filename: string,
  altText?: string
): Promise<{ fileId: string } | null> {
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have uploaded image to channel ${channelId}: ${filename}`);
    return { fileId: 'disabled' };
  }
  
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log("Slack not configured, skipping image upload");
    return null;
  }

  try {
    console.log(`[Slack] Downloading image from: ${imageUrl}`);
    
    // Download the image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error(`[Slack] Failed to download image: ${imageResponse.status}`);
      return null;
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    console.log(`[Slack] Downloaded image: ${imageBuffer.length} bytes`);

    // Step 1: Get upload URL
    const getUploadUrlResponse = await fetch("https://slack.com/api/files.getUploadURLExternal", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        filename: filename,
        length: imageBuffer.length.toString(),
      }),
    });

    const uploadUrlData = await getUploadUrlResponse.json();
    if (!uploadUrlData.ok) {
      console.error("[Slack] Failed to get upload URL:", uploadUrlData.error);
      return null;
    }

    const { upload_url, file_id } = uploadUrlData;

    // Step 2: Upload file
    const uploadResponse = await fetch(upload_url, {
      method: "POST",
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      console.error("[Slack] Failed to upload image:", uploadResponse.status);
      return null;
    }

    // Step 3: Complete upload
    const completeResponse = await fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [{ id: file_id, title: altText || filename }],
        channel_id: channelId,
      }),
    });

    const completeData = await completeResponse.json();
    if (!completeData.ok) {
      console.error("[Slack] Failed to complete image upload:", completeData.error);
      return null;
    }

    console.log(`[Slack] Property image uploaded successfully: ${file_id}`);
    return { fileId: file_id };
  } catch (error) {
    console.error("[Slack] Failed to upload image from URL:", error);
    return null;
  }
}

interface MLSListingData {
  address: string;
  city?: string;
  state?: string;
  mlsNumber: string;
  status: string;
  listPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  yearBuilt?: string;
  propertyType?: string;
  description?: string;
  imageUrl?: string;
}

/**
 * Post MLS listing data to Slack with Block Kit formatting and proper image handling
 */
export async function postMLSListingNotification(
  channelId: string,
  listing: MLSListingData
): Promise<void> {
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have sent MLS listing notification for: ${listing.address}`);
    return;
  }
  
  const priceFormatted = listing.listPrice 
    ? `$${listing.listPrice.toLocaleString()}` 
    : "Price not listed";

  // Build address line
  const fullAddress = [listing.address, listing.city, listing.state]
    .filter(Boolean)
    .join(", ");

  // Summarize description using AI
  let summaryDescription = "";
  if (listing.description) {
    summaryDescription = await summarizeDescription(listing.description, 200);
  }

  // Build the Block Kit message
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: ":house: MLS Listing Data",
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Address:*\n${fullAddress}`
        },
        {
          type: "mrkdwn",
          text: `*MLS #:*\n${listing.mlsNumber}`
        }
      ]
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Status:*\n${listing.status}`
        },
        {
          type: "mrkdwn",
          text: `*List Price:*\n${priceFormatted}`
        }
      ]
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Beds:* ${listing.bedrooms || "N/A"} | *Baths:* ${listing.bathrooms || "N/A"} | *Sqft:* ${listing.sqft ? listing.sqft.toLocaleString() : "N/A"}`
        },
        {
          type: "mrkdwn",
          text: listing.yearBuilt ? `*Year Built:* ${listing.yearBuilt}` : ""
        }
      ]
    }
  ];

  // Add property type if available
  if (listing.propertyType) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Property Type:* ${listing.propertyType}`
      }
    });
  }

  // Add AI-summarized description
  if (summaryDescription) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: summaryDescription
      }
    });
  }

  // Post the text blocks first
  await slackRequest("chat.postMessage", {
    channel: channelId,
    text: `MLS Listing: ${fullAddress}`,
    blocks,
  });

  // Upload property image separately for reliable display
  if (listing.imageUrl) {
    try {
      await uploadImageFromUrl(
        channelId,
        listing.imageUrl,
        `property-${listing.mlsNumber}.jpg`,
        `Photo of ${fullAddress}`
      );
    } catch (imageError) {
      console.error("[Slack] Failed to upload property image:", imageError);
      // Fallback: try posting image URL directly
      await postToChannel(channelId, listing.imageUrl);
    }
  }
}

export async function uploadFileToChannel(
  channelId: string,
  fileData: string,
  fileName: string,
  title: string,
  initialComment?: string
): Promise<{ fileId: string } | null> {
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have uploaded file to channel ${channelId}: ${fileName}`);
    return { fileId: 'disabled' };
  }
  
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    process.stderr.write(`[Slack] No SLACK_BOT_TOKEN configured, skipping file upload\n`);
    return null;
  }

  try {
    process.stderr.write(`[Slack] Starting file upload: ${fileName} to channel ${channelId}\n`);
    
    // Convert base64 to buffer if it's a data URL
    let fileBuffer: Buffer;
    if (fileData.startsWith("data:")) {
      const base64Data = fileData.split(",")[1];
      fileBuffer = Buffer.from(base64Data, "base64");
    } else {
      fileBuffer = Buffer.from(fileData, "base64");
    }
    
    process.stderr.write(`[Slack] File buffer size: ${fileBuffer.length} bytes\n`);

    // Step 1: Get upload URL using files.getUploadURLExternal
    const getUploadUrlResponse = await fetch("https://slack.com/api/files.getUploadURLExternal", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        filename: fileName,
        length: fileBuffer.length.toString(),
      }),
    });

    const uploadUrlData = await getUploadUrlResponse.json();
    if (!uploadUrlData.ok) {
      process.stderr.write(`[Slack] Failed to get upload URL: ${uploadUrlData.error}\n`);
      return null;
    }

    const { upload_url, file_id } = uploadUrlData;
    process.stderr.write(`[Slack] Got upload URL for file_id: ${file_id}\n`);

    // Step 2: Upload file to the URL
    const uploadResponse = await fetch(upload_url, {
      method: "POST",
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      process.stderr.write(`[Slack] Failed to upload file to URL: ${uploadResponse.status}\n`);
      return null;
    }
    process.stderr.write(`[Slack] File uploaded successfully\n`);

    // Step 3: Complete the upload with files.completeUploadExternal
    const completeResponse = await fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [{ id: file_id, title: title }],
        channel_id: channelId,
        initial_comment: initialComment || undefined,
      }),
    });

    const completeData = await completeResponse.json();
    if (!completeData.ok) {
      process.stderr.write(`[Slack] Failed to complete upload: ${completeData.error}\n`);
      return null;
    }

    process.stderr.write(`[Slack] File upload completed successfully: ${file_id}\n`);
    return { fileId: file_id };
  } catch (error) {
    process.stderr.write(`[Slack] Failed to upload file: ${error}\n`);
    return null;
  }
}

/**
 * Send a closing date reminder to a Slack channel
 */
export async function sendClosingReminder(
  channelId: string,
  propertyAddress: string,
  closingDate: string,
  daysRemaining: number
): Promise<void> {
  // KILL SWITCH - check FIRST before any Slack API calls
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[Slack] 🔴 BLOCKED sendClosingReminder - DISABLE_SLACK_NOTIFICATIONS=true`);
    console.log(`[Slack] Would have sent: ${propertyAddress} (${daysRemaining} days remaining)`);
    return;
  }
  
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error("[Slack] No Slack token available for closing reminder");
    return;
  }

  // Format the closing date for display
  const formattedDate = new Date(closingDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // Determine urgency emoji and text
  let urgencyEmoji = "";
  let urgencyText = "";
  if (daysRemaining === 0) {
    urgencyEmoji = "";
    urgencyText = "TODAY is closing day!";
  } else if (daysRemaining === 1) {
    urgencyEmoji = "";
    urgencyText = "1 day remaining - Final preparations!";
  } else if (daysRemaining <= 3) {
    urgencyEmoji = "";
    urgencyText = `${daysRemaining} days remaining`;
  } else if (daysRemaining <= 7) {
    urgencyEmoji = "";
    urgencyText = `${daysRemaining} days remaining`;
  } else {
    urgencyEmoji = "";
    urgencyText = `${daysRemaining} days remaining`;
  }

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${urgencyEmoji} Closing Reminder`,
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Property:*\n${propertyAddress}`
        },
        {
          type: "mrkdwn",
          text: `*Expected Closing:*\n${formattedDate}`
        }
      ]
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*${urgencyText}*`
      }
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Review action items and ensure all documents are in order before closing."
        }
      ]
    }
  ];

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: channelId,
        blocks,
        text: `Closing Reminder: ${propertyAddress} - ${urgencyText}`,
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error("[Slack] Failed to send closing reminder:", data.error);
    } else {
      console.log(`[Slack] Closing reminder sent for ${propertyAddress}: ${daysRemaining} days remaining`);
    }
  } catch (error) {
    console.error("[Slack] Failed to send closing reminder:", error);
  }
}

/**
 * Send a marketing asset notification to a Slack channel (auto-notification)
 */
export async function sendMarketingNotification(
  channelId: string,
  propertyAddress: string,
  assetType: string,
  createdBy: string,
  imageData?: string,
  fileName?: string
): Promise<void> {
  if (process.env.DISABLE_SLACK_NOTIFICATIONS === 'true') {
    console.log(`[NOTIFICATIONS DISABLED] Would have sent marketing notification for: ${propertyAddress} (${assetType})`);
    return;
  }
  
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.error("[Slack] No Slack token available for marketing notification");
    return;
  }

  const typeLabels: Record<string, string> = {
    facebook: 'Facebook Post (16:9)',
    instagram: 'Instagram Post (1:1)',
    story: 'Instagram Story (9:16)',
    alt_style: 'Alternative Style',
    flyer: 'Property Flyer',
  };
  const typeLabel = typeLabels[assetType] || assetType;

  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // If we have image data, upload the file with the notification
  if (imageData && fileName) {
    const initialComment = [
      `*Marketing Materials Created*`,
      ``,
      `*Property:* ${propertyAddress}`,
      `*Type:* ${typeLabel}`,
      `*Created by:* ${createdBy}`,
      `*Time:* ${timestamp}`,
    ].join('\n');

    await uploadFileToChannel(channelId, imageData, fileName, `${typeLabel} - ${propertyAddress}`, initialComment);
  } else {
    // Just send a text message without attachment
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "Marketing Materials Created",
          emoji: true
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Property:*\n${propertyAddress}` },
          { type: "mrkdwn", text: `*Type:*\n${typeLabel}` }
        ]
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Created by:*\n${createdBy}` },
          { type: "mrkdwn", text: `*Time:*\n${timestamp}` }
        ]
      }
    ];

    try {
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel: channelId,
          blocks,
          text: `Marketing asset created: ${typeLabel} for ${propertyAddress}`,
        }),
      });

      const data = await response.json();
      if (!data.ok) {
        console.error("[Slack] Failed to send marketing notification:", data.error);
      }
    } catch (error) {
      console.error("[Slack] Failed to send marketing notification:", error);
    }
  }
}

// Coming Soon channel ID
const COMING_SOON_CHANNEL_ID = 'C09J6327HQS';

interface ComingSoonNotification {
  propertyAddress: string;
  listPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  goLiveDate?: string | null;
  description?: string | null;
  transactionId: string;
  agentName: string;
  agentEmail?: string | null;
  agentPhone?: string | null;
  heroPhotoUrl?: string | null;
}

function formatPrice(price: number | null | undefined): string {
  if (!price) return 'TBD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatGoLiveDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Post a Coming Soon listing notification to #coming-soon-listings channel
 * @returns true if notification was successfully posted, false otherwise
 */
export async function postComingSoonNotification(data: ComingSoonNotification): Promise<boolean> {
  logSlackOp('📢', 'postComingSoonNotification called', {
    propertyAddress: data.propertyAddress,
    transactionId: data.transactionId,
    DISABLE_SLACK_NOTIFICATIONS: process.env.DISABLE_SLACK_NOTIFICATIONS,
    targetChannel: COMING_SOON_CHANNEL_ID
  });

  if (isSlackNotificationsDisabled()) {
    logSlackOp('⛔', 'Coming Soon notification SKIPPED - notifications disabled', { propertyAddress: data.propertyAddress });
    return false;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    logSlackOp('❌', 'SLACK_BOT_TOKEN not configured - skipping Coming Soon notification');
    return false;
  }

  const appUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'https://mission-control-contract-conduit.onrender.com';

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "Coming Soon Listing",
        emoji: true
      }
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Address:*\n${data.propertyAddress}`
        },
        {
          type: "mrkdwn",
          text: `*List Price:*\n${formatPrice(data.listPrice)}`
        }
      ]
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Details:*\n${data.bedrooms || '-'} bed | ${data.bathrooms || '-'} bath | ${data.sqft?.toLocaleString() || '-'} sqft`
        },
        {
          type: "mrkdwn",
          text: `*Expected Live Date:*\n${formatGoLiveDate(data.goLiveDate)}`
        }
      ]
    },
    {
      type: "section",
      fields: [
        {
          type: "mrkdwn",
          text: `*Agent:*\n${data.agentName}`
        },
        {
          type: "mrkdwn",
          text: `*Contact:*\n${data.agentPhone || data.agentEmail || 'N/A'}`
        }
      ]
    }
  ];

  // Add description if available (summarize if too long)
  if (data.description) {
    const shortDesc = data.description.length > 500 
      ? data.description.substring(0, 497) + '...'
      : data.description;
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Description:*\n${shortDesc}`
      }
    });
  }

  // Add property photo if available
  if (data.heroPhotoUrl) {
    blocks.push({
      type: "image",
      image_url: data.heroPhotoUrl,
      alt_text: "Property Photo"
    });
  }

  // Add action button
  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "View in Contract Conduit",
          emoji: true
        },
        url: `${appUrl}/transactions/${data.transactionId}`,
        style: "primary"
      }
    ]
  });

  try {
    // Ensure bot is in the #coming-soon-listings channel
    try {
      const joinResponse = await fetch("https://slack.com/api/conversations.join", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel: COMING_SOON_CHANNEL_ID }),
      });
      const joinResult = await joinResponse.json();
      if (!joinResult.ok && joinResult.error !== 'already_in_channel') {
        logSlackOp('⚠️', 'Could not join #coming-soon-listings (non-fatal)', { error: joinResult.error });
      }
    } catch (joinErr: any) {
      logSlackOp('⚠️', 'Join channel error (non-fatal)', { error: joinErr.message });
    }
    
    logSlackOp('📡', 'Posting to #coming-soon-listings', {
      channel: COMING_SOON_CHANNEL_ID,
      propertyAddress: data.propertyAddress,
      tokenPrefix: token.substring(0, 15) + '...'
    });

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: COMING_SOON_CHANNEL_ID,
        blocks,
        text: `Coming Soon: ${data.propertyAddress}`,
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      logSlackOp('❌', 'Coming Soon notification FAILED', {
        error: result.error,
        channel: COMING_SOON_CHANNEL_ID,
        propertyAddress: data.propertyAddress
      });
      return false;
    } else {
      logSlackOp('✅', 'Coming Soon notification POSTED', {
        channel: COMING_SOON_CHANNEL_ID,
        propertyAddress: data.propertyAddress,
        ts: result.ts
      });
      return true;
    }
  } catch (error: any) {
    logSlackOp('💥', 'Coming Soon notification EXCEPTION', {
      error: error.message,
      propertyAddress: data.propertyAddress
    });
    return false;
  }
}

// Photography Request channel ID
const PHOTOGRAPHY_CHANNEL_ID = process.env.PHOTOGRAPHY_CHANNEL_ID || 'C0A9019MYT1';

interface PhotographyRequestData {
  propertyAddress: string;
  transactionId: string;
  agentName: string;
  agentEmail?: string | null;
  agentPhone?: string | null;
  mlsNumber?: string | null;
  photographyNotes?: string | null;
  photographyAppointmentDate?: string | null;
  appUrl?: string;
}

export async function postPhotographyRequest(data: PhotographyRequestData): Promise<boolean> {
  logSlackOp('📸', 'postPhotographyRequest called', {
    propertyAddress: data.propertyAddress,
    transactionId: data.transactionId,
    targetChannel: PHOTOGRAPHY_CHANNEL_ID
  });

  if (isSlackNotificationsDisabled()) {
    logSlackOp('⛔', 'Photography request SKIPPED - notifications disabled', { propertyAddress: data.propertyAddress });
    return false;
  }

  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    logSlackOp('⛔', 'Photography request SKIPPED - no SLACK_BOT_TOKEN', { propertyAddress: data.propertyAddress });
    return false;
  }

  const appointmentDate = data.photographyAppointmentDate
    ? new Date(data.photographyAppointmentDate).toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      })
    : 'TBD \u2014 Agent will follow up';

  const agentContact = data.agentPhone || data.agentEmail || 'N/A';
  const viewUrl = `${data.appUrl || 'https://mission-control-contract-conduit.onrender.com'}/transactions/${data.transactionId}`;

  const blocks: any[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "New Photography Request", emoji: true }
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Full Address:*\n${data.propertyAddress}` },
        { type: "mrkdwn", text: `*MLS #:*\n${data.mlsNumber?.trim() || 'Pending'}` },
        { type: "mrkdwn", text: `*Agent:*\n${data.agentName || 'N/A'}` },
      ]
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Photo Order Status:*\nPhotos Requested` },
        { type: "mrkdwn", text: `*Listing Status:*\nPre-Listing` },
      ]
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Preferred Appointment Date:*\n${appointmentDate}` },
        { type: "mrkdwn", text: `*Agent Contact:*\n${agentContact}` },
      ]
    },
  ];

  if (data.photographyNotes) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Notes for James:*\n${data.photographyNotes}` }
    });
  }

  blocks.push(
    { type: "divider" },
    {
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "View in Contract Conduit", emoji: true },
        url: viewUrl,
        style: "primary"
      }]
    }
  );

  try {
    // Join the channel first
    await fetch("https://slack.com/api/conversations.join", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel: PHOTOGRAPHY_CHANNEL_ID }),
    });

    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        channel: PHOTOGRAPHY_CHANNEL_ID,
        blocks,
        text: `New Photography Request: ${data.propertyAddress}`,
      }),
    });

    const result = await response.json();

    if (!result.ok) {
      logSlackOp('❌', 'Photography request FAILED', {
        error: result.error,
        channel: PHOTOGRAPHY_CHANNEL_ID,
        propertyAddress: data.propertyAddress
      });
      return false;
    } else {
      logSlackOp('✅', 'Photography request POSTED', {
        channel: PHOTOGRAPHY_CHANNEL_ID,
        propertyAddress: data.propertyAddress,
        ts: result.ts
      });
      return true;
    }
  } catch (error: any) {
    logSlackOp('💥', 'Photography request EXCEPTION', {
      error: error.message,
      propertyAddress: data.propertyAddress
    });
    return false;
  }
}
