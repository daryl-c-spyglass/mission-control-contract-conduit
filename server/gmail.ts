// Gmail API integration using service account with domain-wide delegation
// This allows Mission Control to create filters and watch emails for all agents in the domain

import { google } from "googleapis";

interface GmailServiceAccount {
  client_email: string;
  private_key: string;
}

let serviceAccountCredentials: GmailServiceAccount | null = null;

function getServiceAccountCredentials(): GmailServiceAccount | null {
  if (serviceAccountCredentials) return serviceAccountCredentials;
  
  const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credentialsJson) return null;
  
  try {
    serviceAccountCredentials = JSON.parse(credentialsJson);
    return serviceAccountCredentials;
  } catch (error) {
    console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON:", error);
    return null;
  }
}

function getGmailClient(userEmail: string) {
  const credentials = getServiceAccountCredentials();
  if (!credentials) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not configured");
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/gmail.labels",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    subject: userEmail, // Impersonate this user via domain-wide delegation
  });

  return google.gmail({ version: "v1", auth });
}

export function isGmailConfigured(): boolean {
  return !!getServiceAccountCredentials();
}

export async function createGmailLabelAndFilter(
  userEmail: string,
  propertyAddress: string,
  transactionId: string
): Promise<{ labelId: string; filterId: string } | null> {
  if (!isGmailConfigured()) {
    console.log("Gmail not configured, skipping label/filter creation");
    return null;
  }

  try {
    const gmail = getGmailClient(userEmail);

    // Extract street number and name for matching (without the street type suffix)
    // Handle formats like "123 Main Street, Austin, TX 78701" -> "123 Main"
    // Common street type suffixes to remove
    const streetTypeSuffixes = /\s+(street|st|avenue|ave|drive|dr|road|rd|lane|ln|boulevard|blvd|way|circle|cir|court|ct|place|pl|terrace|ter|trail|trl|parkway|pkwy|highway|hwy)$/i;
    
    const addressParts = propertyAddress.match(/^(\d+)\s+(.+?)(?:,|$)/);
    if (!addressParts) {
      console.log("Could not parse address for filter:", propertyAddress);
      return null;
    }
    
    const streetNumber = addressParts[1];
    // Remove street type suffix to get just the street name
    const fullStreetName = addressParts[2].trim();
    const streetName = fullStreetName.replace(streetTypeSuffixes, "").trim();
    
    // Create a label for this transaction (use full name for label)
    const labelName = `MC/${streetNumber} ${streetName}`;
    
    // Check if label already exists
    const labelsResponse = await gmail.users.labels.list({ userId: "me" });
    const existingLabel = labelsResponse.data.labels?.find(l => l.name === labelName);
    
    let labelId: string;
    if (existingLabel?.id) {
      labelId = existingLabel.id;
    } else {
      // Create the label
      const labelResponse = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: labelName,
          labelListVisibility: "labelShow",
          messageListVisibility: "show",
        },
      });
      labelId = labelResponse.data.id || "";
    }

    if (!labelId) {
      throw new Error("Failed to create Gmail label");
    }

    // Create filter to match emails with just street number + street name
    // "123 Main Street" -> filter on "123 Main"
    // "1701 Testing Avenue" -> filter on "1701 Testing"
    // This handles abbreviations like Ave/Avenue, St/Street, etc.
    const subjectPattern = `${streetNumber} ${streetName}`;
    
    console.log(`Creating Gmail filter for subject containing: "${subjectPattern}"`);
    
    const filterResponse = await gmail.users.settings.filters.create({
      userId: "me",
      requestBody: {
        criteria: {
          subject: subjectPattern,
        },
        action: {
          addLabelIds: [labelId],
        },
      },
    });

    const filterId = filterResponse.data.id;
    if (!filterId) {
      throw new Error("Failed to create Gmail filter");
    }

    console.log(`Created Gmail label "${labelName}" and filter for ${userEmail}`);
    
    return { labelId, filterId };
  } catch (error: any) {
    console.error("Failed to create Gmail label/filter:", error.message);
    return null;
  }
}

export async function watchUserMailbox(
  userEmail: string,
  labelIds: string[]
): Promise<{ historyId: string; expiration: string } | null> {
  if (!isGmailConfigured()) return null;

  const topicName = process.env.GOOGLE_PUBSUB_TOPIC;
  if (!topicName) {
    console.log("GOOGLE_PUBSUB_TOPIC not configured, skipping watch");
    return null;
  }

  try {
    const gmail = getGmailClient(userEmail);
    
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds,
        labelFilterBehavior: "INCLUDE",
      },
    });

    return {
      historyId: response.data.historyId || "",
      expiration: response.data.expiration || "",
    };
  } catch (error: any) {
    console.error("Failed to watch mailbox:", error.message);
    return null;
  }
}

export async function getNewMessages(
  userEmail: string,
  historyId: string,
  labelId: string
): Promise<Array<{ id: string; subject: string; from: string; snippet: string; date: string }>> {
  if (!isGmailConfigured()) return [];

  try {
    const gmail = getGmailClient(userEmail);
    
    // Get history since last check
    const historyResponse = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      labelId: labelId,
      historyTypes: ["messageAdded"],
    });

    const messages: Array<{ id: string; subject: string; from: string; snippet: string; date: string }> = [];
    
    for (const history of historyResponse.data.history || []) {
      for (const added of history.messagesAdded || []) {
        if (added.message?.id) {
          // Fetch full message details
          const msgResponse = await gmail.users.messages.get({
            userId: "me",
            id: added.message.id,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });

          const headers = msgResponse.data.payload?.headers || [];
          const subject = headers.find(h => h.name === "Subject")?.value || "(no subject)";
          const from = headers.find(h => h.name === "From")?.value || "unknown";
          const date = headers.find(h => h.name === "Date")?.value || "";

          messages.push({
            id: added.message.id,
            subject,
            from,
            snippet: msgResponse.data.snippet || "",
            date,
          });
        }
      }
    }

    return messages;
  } catch (error: any) {
    console.error("Failed to get new messages:", error.message);
    return [];
  }
}

export async function deleteGmailFilter(userEmail: string, filterId: string): Promise<boolean> {
  if (!isGmailConfigured()) return false;

  try {
    const gmail = getGmailClient(userEmail);
    await gmail.users.settings.filters.delete({
      userId: "me",
      id: filterId,
    });
    return true;
  } catch (error: any) {
    console.error("Failed to delete Gmail filter:", error.message);
    return false;
  }
}

// Combined function to set up Gmail for a transaction (backward compatibility)
export async function setupGmailForTransaction(
  propertyAddress: string,
  userEmail?: string
): Promise<{ 
  labelId: string | null; 
  filterId: string | null;
  filterNeedsManualSetup?: boolean;
}> {
  if (!userEmail) {
    console.log("No user email provided for Gmail setup");
    return { labelId: null, filterId: null };
  }
  
  const result = await createGmailLabelAndFilter(userEmail, propertyAddress, "");
  
  if (!result) {
    return { labelId: null, filterId: null };
  }
  
  return { labelId: result.labelId, filterId: result.filterId };
}
