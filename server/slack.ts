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
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log("Slack not configured, skipping file upload");
    return null;
  }

  try {
    console.log(`[Slack] Starting file upload: ${fileName} to channel ${channelId}`);
    
    // Convert base64 to buffer if it's a data URL
    let fileBuffer: Buffer;
    if (fileData.startsWith("data:")) {
      const base64Data = fileData.split(",")[1];
      fileBuffer = Buffer.from(base64Data, "base64");
    } else {
      fileBuffer = Buffer.from(fileData, "base64");
    }
    
    console.log(`[Slack] File buffer size: ${fileBuffer.length} bytes`);

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
      console.error("[Slack] Failed to get upload URL:", uploadUrlData.error);
      return null;
    }

    const { upload_url, file_id } = uploadUrlData;
    console.log(`[Slack] Got upload URL for file_id: ${file_id}`);

    // Step 2: Upload file to the URL
    const uploadResponse = await fetch(upload_url, {
      method: "POST",
      body: fileBuffer,
    });

    if (!uploadResponse.ok) {
      console.error("[Slack] Failed to upload file to URL:", uploadResponse.status);
      return null;
    }
    console.log(`[Slack] File uploaded successfully`);

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
      console.error("[Slack] Failed to complete upload:", completeData.error);
      return null;
    }

    console.log(`[Slack] File upload completed successfully: ${file_id}`);
    return { fileId: file_id };
  } catch (error) {
    console.error("[Slack] Failed to upload file:", error);
    return null;
  }
}
