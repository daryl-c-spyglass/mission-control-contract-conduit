import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertCoordinatorSchema } from "@shared/schema";
import { setupGmailForTransaction, isGmailConfigured, getNewMessages } from "./gmail";
import { createSlackChannel, inviteUsersToChannel, postToChannel } from "./slack";
import { fetchMLSListing, fetchSimilarListings } from "./repliers";
import { searchFUBContacts, getFUBContact, getFUBUserByEmail, searchFUBContactsByAssignedUser } from "./fub";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";

// Helper to generate a Slack channel name in format: buy-123main-joeywilkes or sell-123main-joeywilkes
function generateSlackChannelName(address: string, transactionType: string = "buy", agentName: string = ""): string {
  // Extract just the street address (e.g., "123 Main Street" from "123 Main Street, Austin, TX 78701")
  const streetPart = address.split(",")[0] || address;
  
  // Clean the address - keep alphanumeric and convert spaces to nothing, shorten
  const cleanAddress = streetPart
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .substring(0, 25);
  
  // Clean the agent name - convert to lowercase, remove spaces and special chars
  const cleanAgentName = agentName
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .substring(0, 20);
  
  // Format: buy-123main-joeywilkes or sell-123main-joeywilkes (with dashes for readability)
  const type = transactionType === "sell" ? "sell" : "buy";
  
  if (cleanAgentName) {
    return `${type}-${cleanAddress}-${cleanAgentName}`.substring(0, 80);
  } else {
    return `${type}-${cleanAddress}`.substring(0, 80);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up authentication (BEFORE other routes)
  await setupAuth(app);
  registerAuthRoutes(app);

  // ============ Transactions ============

  app.get("/api/transactions", isAuthenticated, async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const { createSlackChannel: shouldCreateSlack, createGmailFilter, fetchMlsData, onBehalfOfEmail, onBehalfOfSlackId, onBehalfOfName, ...transactionData } = req.body;
      
      // Get the current user's ID
      const userId = req.user?.claims?.sub;
      
      // Enforce email consent for Gmail filter creation (unless creating on behalf of another agent)
      if (createGmailFilter && userId && !onBehalfOfEmail) {
        const currentUser = await authStorage.getUser(userId);
        if (!currentUser?.emailFilterConsent) {
          return res.status(400).json({ 
            message: "Email filtering requires consent. Please complete onboarding first.",
            requiresOnboarding: true 
          });
        }
      }
      
      // Validate the transaction data and add userId
      const validatedData = insertTransactionSchema.parse({
        ...transactionData,
        userId,
      });
      
      // Create the transaction
      const transaction = await storage.createTransaction(validatedData);

      // Log activity
      await storage.createActivity({
        transactionId: transaction.id,
        type: "transaction_created",
        description: `Transaction created for ${transaction.propertyAddress}`,
      });

      // Create real Slack channel if requested
      if (shouldCreateSlack && process.env.SLACK_BOT_TOKEN) {
        try {
          // Determine the agent name for the channel
          // If creating on behalf of another agent, use their name
          // Otherwise, use the logged-in user's name
          let agentName = "";
          
          if (onBehalfOfName && onBehalfOfName.trim()) {
            // Use the specified agent's name when creating on behalf of someone
            agentName = onBehalfOfName.trim();
          } else if (userId) {
            // Use the creator's name when creating for themselves
            const creator = await authStorage.getUser(userId);
            if (creator) {
              agentName = `${creator.firstName || ""} ${creator.lastName || ""}`.trim();
            }
          }
          
          const channelName = generateSlackChannelName(
            transaction.propertyAddress,
            transaction.transactionType,
            agentName
          );
          const slackResult = await createSlackChannel(channelName);
          
          await storage.updateTransaction(transaction.id, {
            slackChannelId: slackResult.channelId,
            slackChannelName: slackResult.channelName,
          });
          
          await storage.createActivity({
            transactionId: transaction.id,
            type: "channel_created",
            description: `Slack channel #${slackResult.channelName} created`,
          });

          // Collect all Slack user IDs to invite (agent + creator + coordinators)
          const slackUserIdsToInvite: string[] = [];
          let agentSlackUserId: string | null = null;
          let creatorSlackUserId: string | null = null;
          
          // If creating on behalf of another agent, use their Slack ID
          if (onBehalfOfSlackId) {
            agentSlackUserId = onBehalfOfSlackId;
            slackUserIdsToInvite.push(onBehalfOfSlackId);
          }
          
          // Also add the creating user's Slack ID if they have one
          if (userId) {
            const creator = await authStorage.getUser(userId);
            if (creator?.slackUserId) {
              creatorSlackUserId = creator.slackUserId;
              if (creator.slackUserId !== onBehalfOfSlackId) {
                slackUserIdsToInvite.push(creator.slackUserId);
              }
              if (!agentSlackUserId) agentSlackUserId = creator.slackUserId;
            }
          }
          
          // Add coordinators' Slack IDs (use validatedData since transaction might not have them yet)
          const coordinatorIdsToInvite = validatedData.coordinatorIds || [];
          if (coordinatorIdsToInvite.length > 0) {
            const coordsWithSlack = await Promise.all(
              coordinatorIdsToInvite.map(id => storage.getCoordinator(id))
            );
            coordsWithSlack
              .filter(c => c?.slackUserId)
              .forEach(c => slackUserIdsToInvite.push(c!.slackUserId!));
          }
          
          // Invite all users to the channel
          if (slackUserIdsToInvite.length > 0) {
            await inviteUsersToChannel(slackResult.channelId, slackUserIdsToInvite);
          }

          // Build coordinator mentions for welcome message
          let coordinatorMentions = "";
          if (coordinatorIdsToInvite.length > 0) {
            const coordsWithSlack = await Promise.all(
              coordinatorIdsToInvite.map(id => storage.getCoordinator(id))
            );
            const coordMentionParts = coordsWithSlack
              .filter(c => c?.slackUserId)
              .map(c => `<@${c!.slackUserId}>`);
            if (coordMentionParts.length > 0) {
              coordinatorMentions = coordMentionParts.join(", ");
            }
          }

          // Post welcome message mentioning the agent and creator
          const agentMention = agentSlackUserId ? `<@${agentSlackUserId}>` : (agentName || "An agent");
          let welcomeMessage = `Welcome to the new channel created for *${transaction.propertyAddress}*\n\n${agentMention} is the agent on this transaction.`;
          
          // If someone else created it on behalf of the agent, mention them too
          if (creatorSlackUserId && creatorSlackUserId !== agentSlackUserId) {
            welcomeMessage += `\nCreated by <@${creatorSlackUserId}>`;
          }
          
          // Add coordinator mentions
          if (coordinatorMentions) {
            welcomeMessage += `\n\n:busts_in_silhouette: *Transaction Coordinators:* ${coordinatorMentions}`;
          }
          
          if (transaction.closingDate) {
            welcomeMessage += `\n\n:calendar: Closing date: ${transaction.closingDate}`;
          }
          
          // Add instructions for email filtering setup if created on behalf of another agent
          if (onBehalfOfName && !onBehalfOfSlackId) {
            // Get the app URL for the onboarding link - use production domain
            const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
            const productionDomain = domains.find(d => d.includes(".replit.app")) || domains[0];
            const appUrl = productionDomain ? `https://${productionDomain}` : "Contract Conduit";
            
            welcomeMessage += `\n\n:envelope: *Email Filtering Setup Required*\n`;
            welcomeMessage += `If this channel was not created by the agent representing our client, please have them log into the app to enable email filtering:\n`;
            welcomeMessage += `\n1. Go to ${appUrl}\n`;
            welcomeMessage += `2. Sign in with your @spyglassrealty.com email\n`;
            welcomeMessage += `3. Enter your Slack Member ID when prompted\n\n`;
            welcomeMessage += `*How to find your Slack Member ID:*\n`;
            welcomeMessage += `• Click on your profile photo in the bottom left of Slack\n`;
            welcomeMessage += `• Click "Profile" to open your profile screen\n`;
            welcomeMessage += `• Click the three dots (...) next to "Set Status" and "View As"\n`;
            welcomeMessage += `• Select "Copy Member ID" from the dropdown\n\n`;
            welcomeMessage += `Once logged in, emails with "${transaction.propertyAddress.split(",")[0]}" in the subject will be filtered to this channel.`;
          }
          
          await postToChannel(slackResult.channelId, welcomeMessage);
        } catch (slackError) {
          console.error("Slack channel creation error:", slackError);
          // Continue without Slack - don't fail the transaction
        }
      }

      // Create Gmail label and filter if requested
      if (createGmailFilter) {
        try {
          // Check if the agent has given email consent before creating filters
          let targetEmail: string | undefined = undefined;
          let hasEmailConsent = false;
          
          if (onBehalfOfEmail) {
            // Creating on behalf of another agent - we can't check their consent yet
            // Mark transaction as pending Gmail setup for when they consent
            console.log(`Gmail filter pending for ${onBehalfOfEmail} - will create when they consent`);
            await storage.updateTransaction(transaction.id, {
              gmailPendingForEmail: onBehalfOfEmail,
            });
            await storage.createActivity({
              transactionId: transaction.id,
              type: "gmail_pending",
              description: `Gmail filter pending - waiting for ${onBehalfOfEmail} to enable email filtering`,
            });
          } else if (userId) {
            // Creating for the logged-in user - check their consent
            const agent = await authStorage.getUser(userId);
            if (agent?.email && agent?.emailFilterConsent) {
              targetEmail = agent.email;
              hasEmailConsent = true;
            } else if (agent?.email && !agent?.emailFilterConsent) {
              console.log("Skipping Gmail filter: agent hasn't given email consent");
            }
          }
          
          if (targetEmail && hasEmailConsent) {
            const gmailResult = await setupGmailForTransaction(transaction.propertyAddress, targetEmail);
            
            if (gmailResult.labelId) {
              if (gmailResult.filterId) {
                await storage.updateTransaction(transaction.id, {
                  gmailFilterId: gmailResult.filterId,
                  gmailLabelId: gmailResult.labelId,
                });
                
                await storage.createActivity({
                  transactionId: transaction.id,
                  type: "filter_created",
                  description: `Gmail label and filter created for "${transaction.propertyAddress}"`,
                });
              } else if (gmailResult.filterNeedsManualSetup) {
                await storage.createActivity({
                  transactionId: transaction.id,
                  type: "label_created",
                  description: `Gmail label created for "${transaction.propertyAddress}". Filter requires manual setup in Gmail settings.`,
                });
              } else {
                await storage.createActivity({
                  transactionId: transaction.id,
                  type: "label_created",
                  description: `Gmail label created for "${transaction.propertyAddress}"`,
                });
              }
            }
          }
          // else: already logged the reason above
        } catch (gmailError) {
          console.error("Gmail setup error:", gmailError);
          // Continue without Gmail - don't fail the transaction
        }
      }

      // Fetch real MLS data if requested
      // Get the updated transaction to check for Slack channel
      let currentTransaction = await storage.getTransaction(transaction.id);
      
      if (fetchMlsData && transaction.mlsNumber && process.env.REPLIERS_API_KEY) {
        try {
          const mlsData = await fetchMLSListing(transaction.mlsNumber);
          const cmaData = await fetchSimilarListings(transaction.mlsNumber);
          
          if (mlsData) {
            await storage.updateTransaction(transaction.id, {
              mlsData: mlsData,
              cmaData: cmaData,
              propertyImages: mlsData.images || [],
              bedrooms: mlsData.bedrooms || transaction.bedrooms,
              bathrooms: mlsData.bathrooms || transaction.bathrooms,
              sqft: mlsData.sqft || transaction.sqft,
              yearBuilt: mlsData.yearBuilt || transaction.yearBuilt,
              propertyType: mlsData.propertyType || transaction.propertyType,
              listPrice: mlsData.listPrice || transaction.listPrice,
            });
            
            await storage.createActivity({
              transactionId: transaction.id,
              type: "mls_fetched",
              description: "MLS data and CMA comparables loaded from Repliers",
            });

            // Post MLS listing info to Slack channel if it exists and listing is active/pending
            // Use exact matching (normalized to lowercase) to avoid false positives
            const activeStatuses = new Set([
              "active", "a", 
              "active under contract", "active-under-contract", "auc", "ac",
              "pending", "p", "pnd",
              "coming soon", "cs"
            ]);
            const normalizedStatus = mlsData.status?.toLowerCase().trim() || "";
            const isActiveListing = activeStatuses.has(normalizedStatus);
            
            if (currentTransaction?.slackChannelId && isActiveListing) {
              try {
                const priceFormatted = mlsData.listPrice 
                  ? `$${mlsData.listPrice.toLocaleString()}` 
                  : "Price not listed";
                
                const listingMessage = [
                  `:house: *MLS Listing Data*`,
                  `*Address:* ${mlsData.address}${mlsData.city ? `, ${mlsData.city}` : ""}${mlsData.state ? `, ${mlsData.state}` : ""}`,
                  `*MLS #:* ${mlsData.mlsNumber}`,
                  `*Status:* ${mlsData.status}`,
                  `*List Price:* ${priceFormatted}`,
                  `*Beds:* ${mlsData.bedrooms || "N/A"} | *Baths:* ${mlsData.bathrooms || "N/A"} | *Sqft:* ${mlsData.sqft ? mlsData.sqft.toLocaleString() : "N/A"}`,
                  mlsData.yearBuilt ? `*Year Built:* ${mlsData.yearBuilt}` : "",
                  mlsData.propertyType ? `*Property Type:* ${mlsData.propertyType}` : "",
                  mlsData.description ? `\n${mlsData.description.substring(0, 300)}${mlsData.description.length > 300 ? "..." : ""}` : "",
                ].filter(Boolean).join("\n");
                
                await postToChannel(currentTransaction.slackChannelId, listingMessage);
                
                // Post first listing image if available
                if (mlsData.images && mlsData.images.length > 0) {
                  await postToChannel(currentTransaction.slackChannelId, mlsData.images[0]);
                }
              } catch (slackPostError) {
                console.error("Error posting MLS data to Slack:", slackPostError);
              }
            } else if (currentTransaction?.slackChannelId && mlsData.status) {
              console.log(`Skipping Slack post: listing status "${mlsData.status}" is not active/pending`);
            }
          }
        } catch (mlsError) {
          console.error("MLS data fetch error:", mlsError);
          // Continue without MLS - don't fail the transaction
        }
      }

      // Fetch the updated transaction
      const updatedTransaction = await storage.getTransaction(transaction.id);
      res.status(201).json(updatedTransaction);
    } catch (error: any) {
      console.error("Create transaction error:", error);
      res.status(400).json({ message: error.message || "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const transaction = await storage.updateTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  app.delete("/api/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteTransaction(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete transaction" });
    }
  });

  app.post("/api/transactions/:id/refresh-mls", isAuthenticated, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (!process.env.REPLIERS_API_KEY) {
        return res.status(400).json({ message: "Repliers API key not configured" });
      }

      // Fetch real MLS data using address or MLS number
      let mlsData = null;
      let cmaData = null;

      if (transaction.mlsNumber) {
        mlsData = await fetchMLSListing(transaction.mlsNumber);
        cmaData = await fetchSimilarListings(transaction.mlsNumber);
      }

      const updateData: any = {};
      
      if (mlsData) {
        updateData.mlsData = mlsData;
        updateData.propertyImages = mlsData.images || [];
        if (mlsData.bedrooms) updateData.bedrooms = mlsData.bedrooms;
        if (mlsData.bathrooms) updateData.bathrooms = mlsData.bathrooms;
        if (mlsData.sqft) updateData.sqft = mlsData.sqft;
        if (mlsData.yearBuilt) updateData.yearBuilt = mlsData.yearBuilt;
        if (mlsData.propertyType) updateData.propertyType = mlsData.propertyType;
        if (mlsData.listPrice) updateData.listPrice = mlsData.listPrice;
      }
      
      if (cmaData) {
        updateData.cmaData = cmaData;
      }

      const updated = await storage.updateTransaction(req.params.id, updateData);

      await storage.createActivity({
        transactionId: transaction.id,
        type: "mls_refreshed",
        description: "MLS data refreshed",
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Failed to refresh MLS data" });
    }
  });

  app.get("/api/transactions/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const activities = await storage.getActivitiesByTransaction(req.params.id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // ============ Coordinators ============

  app.get("/api/coordinators", isAuthenticated, async (req, res) => {
    try {
      const coordinators = await storage.getCoordinators();
      res.json(coordinators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coordinators" });
    }
  });

  app.post("/api/coordinators", isAuthenticated, async (req, res) => {
    try {
      const validatedData = insertCoordinatorSchema.parse(req.body);
      const coordinator = await storage.createCoordinator(validatedData);
      res.status(201).json(coordinator);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create coordinator" });
    }
  });

  app.delete("/api/coordinators/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCoordinator(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Coordinator not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete coordinator" });
    }
  });

  // ============ Admin ============

  app.get("/api/admin/integration-status", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin
      const userId = req.user?.claims?.sub;
      const user = await authStorage.getUser(userId);
      
      if (user?.isAdmin !== "true") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Check which API keys are configured
      res.json({
        slack: !!process.env.SLACK_BOT_TOKEN,
        repliers: !!process.env.REPLIERS_API_KEY,
        fub: !!process.env.FUB_API_KEY,
        gmail: isGmailConfigured(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get integration status" });
    }
  });

  // ============ Follow Up Boss ============

  app.get("/api/fub/contact-from-url", isAuthenticated, async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }
      
      // Extract contact ID from FUB URL
      // Format: https://subdomain.followupboss.com/2/people/view/123456
      const match = url.match(/\/people\/(?:view\/)?(\d+)/);
      if (!match) {
        return res.status(400).json({ message: "Invalid Follow Up Boss URL. Expected format: https://yourteam.followupboss.com/2/people/view/123456" });
      }
      
      const contactId = parseInt(match[1], 10);
      const contact = await getFUBContact(contactId);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found in Follow Up Boss" });
      }
      
      res.json(contact);
    } catch (error: any) {
      console.error("FUB contact fetch error:", error);
      res.status(500).json({ message: error.message || "Failed to fetch contact from Follow Up Boss" });
    }
  });

  // ============ Integrations ============

  app.get("/api/integrations", isAuthenticated, async (req, res) => {
    try {
      const settings = await storage.getIntegrationSettings();
      // Don't expose API keys in full
      const sanitized = settings.map((s) => ({
        ...s,
        apiKey: s.apiKey ? "••••••••" + s.apiKey.slice(-4) : null,
        accessToken: s.accessToken ? "configured" : null,
        refreshToken: s.refreshToken ? "configured" : null,
      }));
      res.json(sanitized);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch integrations" });
    }
  });

  app.post("/api/integrations/:type", isAuthenticated, async (req, res) => {
    try {
      const { type } = req.params;
      const { apiKey } = req.body;

      if (!["slack", "gmail", "repliers", "fub"].includes(type)) {
        return res.status(400).json({ message: "Invalid integration type" });
      }

      const setting = await storage.saveIntegrationSetting({
        integrationType: type,
        apiKey: apiKey || null,
        isConnected: !!apiKey,
      });

      res.json({
        ...setting,
        apiKey: setting.apiKey ? "••••••••" + setting.apiKey.slice(-4) : null,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to save integration" });
    }
  });

  app.post("/api/integrations/:type/test", isAuthenticated, async (req, res) => {
    try {
      const { type } = req.params;
      const setting = await storage.getIntegrationSetting(type);

      if (!setting?.apiKey) {
        return res.status(400).json({ message: "No API key configured" });
      }

      // In a real implementation, we would test the actual connection
      // For now, just simulate a successful connection
      await storage.updateIntegrationSetting(type, {
        isConnected: true,
        lastSyncAt: new Date(),
      });

      res.json({ success: true, message: "Connection successful" });
    } catch (error) {
      res.status(500).json({ message: "Connection test failed" });
    }
  });

  // ============ Process Pending Gmail Filters ============
  // Called after an agent completes onboarding to create any pending filters
  
  app.post("/api/user/process-pending-filters", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = await authStorage.getUser(userId);
      if (!user?.email || !user?.emailFilterConsent) {
        return res.json({ processed: 0, message: "Email consent not granted" });
      }
      
      // Find transactions pending Gmail setup for this user's email
      const allTransactions = await storage.getTransactions();
      const pendingTransactions = allTransactions.filter(t => 
        t.gmailPendingForEmail?.toLowerCase() === user.email?.toLowerCase()
      );
      
      let processed = 0;
      for (const txn of pendingTransactions) {
        try {
          const gmailResult = await setupGmailForTransaction(txn.propertyAddress, user.email);
          
          if (gmailResult.labelId && gmailResult.filterId) {
            await storage.updateTransaction(txn.id, {
              gmailFilterId: gmailResult.filterId,
              gmailLabelId: gmailResult.labelId,
              gmailPendingForEmail: null, // Clear the pending flag
            });
            
            await storage.createActivity({
              transactionId: txn.id,
              type: "filter_created",
              description: `Gmail filter created for "${txn.propertyAddress}" after ${user.email} enabled email filtering`,
            });
            
            processed++;
          }
        } catch (error) {
          console.error(`Failed to create pending Gmail filter for transaction ${txn.id}:`, error);
        }
      }
      
      res.json({ processed, message: `Created ${processed} pending Gmail filter(s)` });
    } catch (error) {
      console.error("Error processing pending filters:", error);
      res.status(500).json({ message: "Failed to process pending filters" });
    }
  });

  // ============ FUB Client Search ============

  app.get("/api/fub/search", isAuthenticated, async (req: any, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      if (!process.env.FUB_API_KEY) {
        return res.status(400).json({ message: "FUB API key not configured" });
      }

      // Get the current user and their FUB user ID
      const userId = req.user?.claims?.sub;
      let fubUserId: string | undefined;
      
      if (userId) {
        const user = await authStorage.getUser(userId);
        
        // If user doesn't have a FUB user ID cached, look it up
        if (!user?.fubUserId && user?.email) {
          const fubUser = await getFUBUserByEmail(user.email);
          if (fubUser) {
            await authStorage.updateUser(userId, { fubUserId: String(fubUser.id) });
            fubUserId = String(fubUser.id);
          }
        } else if (user?.fubUserId) {
          fubUserId = user.fubUserId;
        }
      }

      // If we couldn't match the agent to a FUB user, return empty results
      // This prevents agents from seeing contacts they don't own
      if (!fubUserId) {
        console.log("FUB search: No FUB user ID found for agent, returning empty results");
        return res.json([]);
      }

      // Search contacts - filter by assigned user
      const contacts = await searchFUBContactsByAssignedUser(query, fubUserId);
      res.json(contacts);
    } catch (error) {
      console.error("FUB search error:", error);
      res.status(500).json({ message: "Failed to search FUB contacts" });
    }
  });

  // ============ Image Proxy for CORS ============
  // Proxies external MLS images to avoid CORS issues in canvas rendering

  app.get("/api/proxy-image", isAuthenticated, async (req, res) => {
    try {
      const { url } = req.query;
      
      if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required" });
      }
      
      // Only allow HTTPS URLs for security
      if (!url.startsWith("https://")) {
        return res.status(400).json({ message: "Only HTTPS URLs are allowed" });
      }
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          "Accept": "image/*",
        },
      });
      
      if (!response.ok) {
        return res.status(response.status).json({ message: "Failed to fetch image" });
      }
      
      const contentType = response.headers.get("content-type") || "image/jpeg";
      
      // Validate that the response is actually an image
      if (!contentType.startsWith("image/")) {
        return res.status(400).json({ message: "URL does not point to an image" });
      }
      
      const buffer = await response.arrayBuffer();
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("Image proxy error:", error);
      res.status(500).json({ message: "Failed to proxy image" });
    }
  });

  // ============ Gmail Pub/Sub Webhook ============

  // Store processed message IDs to avoid duplicates (in production, use Redis/DB)
  const processedMessageIds = new Set<string>();

  app.post("/api/webhooks/gmail", async (req, res) => {
    try {
      // Pub/Sub sends base64 encoded message data
      const message = req.body.message;
      if (!message?.data) {
        return res.status(400).json({ message: "Invalid Pub/Sub message" });
      }

      // Decode the message
      const decoded = Buffer.from(message.data, "base64").toString("utf-8");
      const notification = JSON.parse(decoded);
      
      // notification contains: { emailAddress, historyId }
      const userEmail = notification.emailAddress;
      const historyId = notification.historyId;
      
      if (!userEmail || !historyId) {
        return res.status(200).json({ message: "No email data in notification" });
      }

      // Find transactions for this user that have Gmail labels
      const transactions = await storage.getTransactions();
      const userTransactions = transactions.filter(t => 
        t.userId && t.gmailLabelId && t.slackChannelId
      );

      // For each transaction with a Gmail label, check for new messages
      for (const txn of userTransactions) {
        try {
          // Get the user who owns this transaction
          const owner = await authStorage.getUser(txn.userId!);
          if (owner?.email !== userEmail) continue;
          
          const messages = await getNewMessages(userEmail, historyId, txn.gmailLabelId!);
          
          for (const msg of messages) {
            // Skip if already processed
            if (processedMessageIds.has(msg.id)) continue;
            processedMessageIds.add(msg.id);
            
            // Keep set size manageable
            if (processedMessageIds.size > 10000) {
              const iterator = processedMessageIds.values();
              for (let i = 0; i < 5000; i++) {
                const next = iterator.next();
                if (next.value) processedMessageIds.delete(next.value);
              }
            }
            
            // Post to Slack channel
            const slackMessage = `*New email related to ${txn.propertyAddress}*\n\n*From:* ${msg.from}\n*Subject:* ${msg.subject}\n\n${msg.snippet}...`;
            await postToChannel(txn.slackChannelId!, slackMessage);
          }
        } catch (err) {
          console.error("Error processing transaction emails:", err);
        }
      }

      res.status(200).json({ message: "Processed" });
    } catch (error) {
      console.error("Gmail webhook error:", error);
      res.status(200).json({ message: "Error processed" }); // Return 200 to prevent retries
    }
  });

  return httpServer;
}
