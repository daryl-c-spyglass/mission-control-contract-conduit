import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
export async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

// Create a Gmail label for a property address
export async function createPropertyLabel(propertyAddress: string): Promise<string | null> {
  try {
    const gmail = await getUncachableGmailClient();
    
    // Clean the address for use as a label name
    const labelName = `Property: ${propertyAddress.split(',')[0].trim()}`;
    
    // Check if label already exists
    const labelsResponse = await gmail.users.labels.list({ userId: 'me' });
    const existingLabel = labelsResponse.data.labels?.find(l => l.name === labelName);
    
    if (existingLabel) {
      return existingLabel.id || null;
    }
    
    // Create new label
    const createResponse = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: labelName,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      }
    });
    
    return createResponse.data.id || null;
  } catch (error) {
    console.error('Error creating Gmail label:', error);
    return null;
  }
}

// Create a filter to automatically label emails containing the property address
export async function createPropertyFilter(propertyAddress: string, labelId: string): Promise<string | null> {
  try {
    const gmail = await getUncachableGmailClient();
    
    // Create filter that matches emails containing the property address
    const streetAddress = propertyAddress.split(',')[0].trim();
    
    const filterResponse = await gmail.users.settings.filters.create({
      userId: 'me',
      requestBody: {
        criteria: {
          query: `"${streetAddress}"`,
        },
        action: {
          addLabelIds: [labelId],
        }
      }
    });
    
    return filterResponse.data.id || null;
  } catch (error) {
    console.error('Error creating Gmail filter:', error);
    return null;
  }
}

// Combined function to set up Gmail for a transaction
export async function setupGmailForTransaction(propertyAddress: string): Promise<{ labelId: string | null; filterId: string | null }> {
  const labelId = await createPropertyLabel(propertyAddress);
  
  if (!labelId) {
    return { labelId: null, filterId: null };
  }
  
  const filterId = await createPropertyFilter(propertyAddress, labelId);
  
  return { labelId, filterId };
}
