import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertTransactionSchema, insertCoordinatorSchema, insertMarketingAssetSchema, insertCmaSchema, insertNotificationSettingsSchema } from "@shared/schema";
import { setupGmailForTransaction, isGmailConfigured, getNewMessages, watchUserMailbox } from "./gmail";
import { createSlackChannel, inviteUsersToChannel, postToChannel, uploadFileToChannel, postDocumentUploadNotification, postMLSListingNotification, sendMarketingNotification } from "./slack";
import { fetchMLSListing, fetchSimilarListings, searchByAddress, testRepliersAccess, getBestPhotosForFlyer, searchNearbyComparables, type CMASearchFilters } from "./repliers";
import { isRentalOrLease } from "../shared/lib/listings";
import { searchFUBContacts, getFUBContact, getFUBUserByEmail, searchFUBContactsByAssignedUser } from "./fub";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { getSyncStatus, triggerManualSync } from "./repliers-sync";
import OpenAI from "openai";
import { generatePrintFlyer, formatAddressForFlyer, type FlyerData, type OutputType } from "./services/flyer-generator";
import { generateGraphic, type GraphicsFormat, type GraphicsData } from "./services/graphics-generator";

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
  
  // Set up object storage routes
  registerObjectStorageRoutes(app);

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
      
      // Enrich CMA comparables with coordinates if they're missing
      if (transaction.cmaData && Array.isArray(transaction.cmaData) && transaction.cmaData.length > 0) {
        const cmaComparables = transaction.cmaData as any[];
        const missingCount = cmaComparables.filter(c => !c.map && c.mlsNumber).length;
        
        if (missingCount > 0) {
          console.log(`[CMA Enrich] Transaction ${req.params.id} has ${missingCount}/${cmaComparables.length} comparables without coordinates`);
          try {
            const { enrichCMAWithCoordinates } = await import("./repliers");
            const enrichedCMA = await enrichCMAWithCoordinates(cmaComparables);
            
            // Check how many were enriched
            const enrichedCount = enrichedCMA.filter((c: any) => c.map).length;
            console.log(`[CMA Enrich] Enriched ${enrichedCount}/${cmaComparables.length} comparables with coordinates`);
            
            // Update the transaction in database with enriched coordinates
            await storage.updateTransaction(req.params.id, { cmaData: enrichedCMA });
            
            // Return enriched data
            return res.json({ ...transaction, cmaData: enrichedCMA });
          } catch (enrichError) {
            console.error("Error enriching CMA coordinates:", enrichError);
            // Fall through to return original data
          }
        }
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const { 
        createSlackChannel: shouldCreateSlack, 
        createGmailFilter, 
        fetchMlsData, 
        onBehalfOfEmail, 
        onBehalfOfSlackId, 
        onBehalfOfName, 
        isUnderContract,
        isOffMarket,
        isCompanyLead,
        // Off-market property details
        propertyDescription,
        listPrice,
        propertyType,
        sqft,
        lotSizeAcres,
        bedrooms,
        bathrooms,
        halfBaths,
        ...transactionData 
      } = req.body;
      
      // Handle off-market transactions
      if (isOffMarket) {
        transactionData.isOffMarket = true;
        transactionData.offMarketListingDate = new Date();
        transactionData.propertyDescription = propertyDescription || null;
        transactionData.listPrice = listPrice ? parseInt(listPrice) : null;
        transactionData.propertyType = propertyType || null;
        transactionData.sqft = sqft ? parseInt(sqft) : null;
        transactionData.lotSizeAcres = lotSizeAcres || null;
        transactionData.bedrooms = bedrooms ? parseInt(bedrooms) : null;
        transactionData.bathrooms = bathrooms ? parseInt(bathrooms) : null;
        transactionData.halfBaths = halfBaths ? parseInt(halfBaths) : null;
        transactionData.status = "active"; // Off-market listings are active, not in contract
        // Clear MLS number for off-market listings
        transactionData.mlsNumber = null;
      } else {
        transactionData.isOffMarket = false;
      }
      
      // Set company lead flag
      transactionData.isCompanyLead = isCompanyLead === true || isCompanyLead === 'true';
      
      // Set the status based on whether property is under contract (for non-off-market)
      if (!isOffMarket) {
        if (isUnderContract === false) {
          transactionData.status = "active";
        } else {
          transactionData.status = "in_contract";
        }
      }
      
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
        category: "transaction",
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
            category: "team",
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
          
          // Add FUB contact link if available
          if (transaction.fubClientId) {
            const fubClientLink = `https://www.followupboss.com/2/people/view/${transaction.fubClientId}`;
            const clientName = transaction.fubClientName || "Client";
            welcomeMessage += `\n\n:bust_in_silhouette: *Follow Up Boss Contact:* <${fubClientLink}|${clientName}>`;
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
              category: "communication",
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
                
                // Set up Gmail watch on this label to receive push notifications
                const watchResult = await watchUserMailbox(targetEmail, [gmailResult.labelId]);
                if (watchResult) {
                  console.log(`Gmail watch set up for ${targetEmail}, historyId: ${watchResult.historyId}`);
                }
                
                await storage.createActivity({
                  transactionId: transaction.id,
                  type: "filter_created",
                  description: `Gmail label and filter created for "${transaction.propertyAddress}"`,
                  category: "communication",
                });
              } else if (gmailResult.filterNeedsManualSetup) {
                await storage.createActivity({
                  transactionId: transaction.id,
                  type: "label_created",
                  description: `Gmail label created for "${transaction.propertyAddress}". Filter requires manual setup in Gmail settings.`,
                  category: "communication",
                });
              } else {
                await storage.createActivity({
                  transactionId: transaction.id,
                  type: "label_created",
                  description: `Gmail label created for "${transaction.propertyAddress}"`,
                  category: "communication",
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
          const mlsResult = await fetchMLSListing(transaction.mlsNumber);
          
          if (mlsResult) {
            const { mlsData, comparables } = mlsResult;
            
            // GLOBAL RENTAL EXCLUSION: Reject rental/lease listings
            // Check both rawData and mlsData itself (rawData may be absent for cached/normalized records)
            if (isRentalOrLease(mlsData.rawData ?? mlsData)) {
              // Delete the transaction we just created
              await storage.deleteTransaction(transaction.id);
              return res.status(422).json({
                message: "Rental/Lease listings are not supported.",
                code: "RENTAL_EXCLUDED",
                mlsNumber: transaction.mlsNumber,
              });
            }
            // Use comparables from listing, fallback to separate API call if none found
            let cmaData = comparables;
            if (!cmaData || cmaData.length === 0) {
              cmaData = await fetchSimilarListings(transaction.mlsNumber);
            }
            
            await storage.updateTransaction(transaction.id, {
              mlsData: mlsData,
              cmaData: cmaData,
              // Note: propertyImages is for user uploads only, MLS photos come from mlsData
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
              category: "mls",
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
                // Use the new Block Kit function with AI summary and proper image handling
                await postMLSListingNotification(currentTransaction.slackChannelId, {
                  address: mlsData.address,
                  city: mlsData.city,
                  state: mlsData.state,
                  mlsNumber: mlsData.mlsNumber,
                  status: mlsData.status,
                  listPrice: mlsData.listPrice,
                  bedrooms: typeof mlsData.bedrooms === 'number' ? mlsData.bedrooms : (mlsData.bedrooms ? parseInt(String(mlsData.bedrooms)) : undefined),
                  bathrooms: typeof mlsData.bathrooms === 'number' ? mlsData.bathrooms : (mlsData.bathrooms ? parseInt(String(mlsData.bathrooms)) : undefined),
                  sqft: typeof mlsData.sqft === 'number' ? mlsData.sqft : (mlsData.sqft ? parseInt(String(mlsData.sqft)) : undefined),
                  yearBuilt: mlsData.yearBuilt ? String(mlsData.yearBuilt) : undefined,
                  propertyType: mlsData.propertyType,
                  description: mlsData.description,
                  imageUrl: mlsData.images?.[0] || undefined,
                });
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
      // Get current transaction to check for date changes
      const currentTransaction = await storage.getTransaction(req.params.id);
      if (!currentTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const transaction = await storage.updateTransaction(req.params.id, req.body);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Log activity if dates were changed
      const dateChanges: string[] = [];
      if (req.body.contractDate !== undefined && req.body.contractDate !== currentTransaction.contractDate) {
        const newDate = req.body.contractDate ? new Date(req.body.contractDate).toLocaleDateString() : 'removed';
        dateChanges.push(`Contract Date updated to ${newDate}`);
      }
      if (req.body.closingDate !== undefined && req.body.closingDate !== currentTransaction.closingDate) {
        const newDate = req.body.closingDate ? new Date(req.body.closingDate).toLocaleDateString() : 'removed';
        dateChanges.push(`Expected Closing updated to ${newDate}`);
      }
      
      if (dateChanges.length > 0) {
        await storage.createActivity({
          transactionId: req.params.id,
          type: 'dates_updated',
          description: dateChanges.join('; '),
          category: 'update',
        });
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

  // Add MLS number to off-market listing (convert to active listing)
  app.patch("/api/transactions/:id/add-mls", isAuthenticated, async (req, res) => {
    try {
      const { mlsNumber } = req.body;
      
      if (!mlsNumber) {
        return res.status(400).json({ message: "MLS number is required" });
      }
      
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Normalize MLS number with ACT prefix
      let normalizedMLS = mlsNumber.trim().toUpperCase();
      if (!normalizedMLS.startsWith('ACT')) {
        normalizedMLS = `ACT${normalizedMLS}`;
      }
      
      // Update transaction to no longer be off-market and add MLS number
      const updated = await storage.updateTransaction(req.params.id, {
        mlsNumber: normalizedMLS,
        isOffMarket: false,
      });
      
      // Try to sync MLS data
      try {
        const mlsResult = await fetchMLSListing(normalizedMLS);
        if (mlsResult && mlsResult.mlsData) {
          const mlsData = mlsResult.mlsData;
          await storage.updateTransaction(req.params.id, {
            mlsData,
            mlsLastSyncedAt: new Date(),
            listPrice: mlsData.listPrice || undefined,
            bedrooms: mlsData.bedrooms || undefined,
            bathrooms: mlsData.bathrooms || undefined,
            sqft: mlsData.sqft || undefined,
            yearBuilt: mlsData.yearBuilt || undefined,
            propertyType: mlsData.propertyType || undefined,
            // Note: propertyImages is for user uploads only, MLS photos come from mlsData
          });
          
          // Log activity
          await storage.createActivity({
            transactionId: req.params.id,
            type: 'mls_added',
            category: 'mls',
            description: `MLS listing ${normalizedMLS} added. Property converted from off-market to active listing.`,
          });
        }
      } catch (mlsError) {
        console.error('Failed to sync MLS data after adding MLS number:', mlsError);
        // Still return success since the MLS number was added
      }
      
      // Get the updated transaction
      const finalTransaction = await storage.getTransaction(req.params.id);
      res.json(finalTransaction);
    } catch (error) {
      console.error('Error adding MLS number to transaction:', error);
      res.status(500).json({ message: "Failed to add MLS number" });
    }
  });

  // Archive a transaction - saves notification settings and disables all reminders
  app.patch("/api/transactions/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Get current notification settings to save before archiving
      const userId = req.user?.id || req.user?.claims?.sub;
      let previousReminderSettings = null;
      
      if (userId) {
        const currentSettings = await storage.getNotificationSettings(userId, req.params.id);
        if (currentSettings) {
          previousReminderSettings = {
            closingReminders: currentSettings.closingReminders,
            reminder14Days: currentSettings.reminder14Days,
            reminder7Days: currentSettings.reminder7Days,
            reminder3Days: currentSettings.reminder3Days,
            reminderDayOf: currentSettings.reminderDayOf,
            documentUploads: currentSettings.documentUploads,
            marketingAssets: currentSettings.marketingAssets,
          };
          
          // Disable all notifications for this transaction
          await storage.upsertNotificationSettings({
            userId,
            transactionId: req.params.id,
            closingReminders: false,
            reminder14Days: false,
            reminder7Days: false,
            reminder3Days: false,
            reminderDayOf: false,
            documentUploads: false,
            marketingAssets: false,
          });
        }
      }
      
      const updated = await storage.updateTransaction(req.params.id, {
        isArchived: true,
        archivedAt: new Date(),
        previousReminderSettings,
      });
      
      // Log activity
      await storage.createActivity({
        transactionId: req.params.id,
        type: 'transaction_archived',
        category: 'transaction',
        description: 'Transaction archived - all notifications disabled',
      });
      
      console.log(`[Archive] Transaction ${req.params.id} archived. All notifications disabled.`);
      
      res.json(updated);
    } catch (error) {
      console.error('Error archiving transaction:', error);
      res.status(500).json({ message: "Failed to archive transaction" });
    }
  });
  
  // Unarchive/restore a transaction with optional notification restoration
  app.patch("/api/transactions/:id/unarchive", isAuthenticated, async (req: any, res) => {
    try {
      const { restoreNotifications = false } = req.body;
      
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const userId = req.user?.id || req.user?.claims?.sub;
      let notificationsRestored = false;
      
      // Optionally restore notification settings
      if (restoreNotifications && transaction.previousReminderSettings && userId) {
        const prevSettings = transaction.previousReminderSettings as any;
        
        await storage.upsertNotificationSettings({
          userId,
          transactionId: req.params.id,
          closingReminders: prevSettings.closingReminders ?? false,
          reminder14Days: prevSettings.reminder14Days ?? false,
          reminder7Days: prevSettings.reminder7Days ?? false,
          reminder3Days: prevSettings.reminder3Days ?? false,
          reminderDayOf: prevSettings.reminderDayOf ?? false,
          documentUploads: prevSettings.documentUploads ?? false,
          marketingAssets: prevSettings.marketingAssets ?? false,
        });
        
        notificationsRestored = prevSettings.closingReminders ?? false;
        console.log(`[Unarchive] Transaction ${req.params.id} - Restoring notification settings`);
      }
      
      const updated = await storage.updateTransaction(req.params.id, {
        isArchived: false,
        archivedAt: null,
        previousReminderSettings: null, // Clear saved settings
      });
      
      // Log activity
      await storage.createActivity({
        transactionId: req.params.id,
        type: 'transaction_restored',
        category: 'transaction',
        description: notificationsRestored 
          ? 'Transaction restored from archive with notifications re-enabled'
          : 'Transaction restored from archive - notifications remain OFF',
      });
      
      console.log(`[Unarchive] Transaction ${req.params.id} restored. Notifications: ${notificationsRestored ? 'RESTORED' : 'OFF'}`);
      
      res.json({
        ...updated,
        notificationsRestored,
      });
    } catch (error) {
      console.error('Error unarchiving transaction:', error);
      res.status(500).json({ message: "Failed to unarchive transaction" });
    }
  });

  // Delete all archived transactions permanently
  app.delete("/api/transactions/archived/delete-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const allTransactions = await storage.getTransactions();
      const archivedTransactions = allTransactions.filter(t => t.isArchived === true);
      
      if (archivedTransactions.length === 0) {
        return res.json({ deleted: 0, message: "No archived transactions to delete" });
      }

      console.log(`[DeleteAllArchived] Deleting ${archivedTransactions.length} archived transactions for user ${userId}`);

      let deletedCount = 0;
      const errors: string[] = [];

      for (const transaction of archivedTransactions) {
        try {
          // Delete the transaction - this cascades to activities, open houses, etc.
          await storage.deleteTransaction(transaction.id);
          deletedCount++;
          console.log(`[DeleteAllArchived] Deleted transaction: ${transaction.propertyAddress}`);
        } catch (err) {
          console.error(`[DeleteAllArchived] Failed to delete transaction ${transaction.id}:`, err);
          errors.push(transaction.propertyAddress);
        }
      }

      console.log(`[DeleteAllArchived] Complete: ${deletedCount} deleted, ${errors.length} failed`);
      
      res.json({ 
        deleted: deletedCount, 
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully deleted ${deletedCount} archived transaction${deletedCount !== 1 ? 's' : ''}`
      });
    } catch (error) {
      console.error('Error deleting all archived transactions:', error);
      res.status(500).json({ message: "Failed to delete archived transactions" });
    }
  });

  // Connect Slack channel to an existing transaction
  app.post("/api/transactions/:id/connect-slack", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Check if already connected
      if (transaction.slackChannelId) {
        return res.status(400).json({ 
          message: "Transaction already has a Slack channel connected",
          slackChannelId: transaction.slackChannelId,
          slackChannelName: transaction.slackChannelName
        });
      }

      if (!process.env.SLACK_BOT_TOKEN) {
        return res.status(400).json({ message: "Slack is not configured" });
      }

      // Get the current user's info for channel naming
      const userId = req.user?.claims?.sub;
      let agentName = "";
      
      if (userId) {
        const creator = await authStorage.getUser(userId);
        if (creator) {
          agentName = `${creator.firstName || ""} ${creator.lastName || ""}`.trim();
        }
      }

      // Generate channel name and create channel
      const channelName = generateSlackChannelName(
        transaction.propertyAddress,
        transaction.transactionType,
        agentName
      );
      
      console.log(`[Slack] Creating channel for existing transaction: ${channelName}`);
      const slackResult = await createSlackChannel(channelName);
      
      // Update transaction with Slack channel info
      await storage.updateTransaction(transaction.id, {
        slackChannelId: slackResult.channelId,
        slackChannelName: slackResult.channelName,
      });

      // Log activity
      await storage.createActivity({
        transactionId: transaction.id,
        type: "channel_created",
        description: `Slack channel #${slackResult.channelName} connected`,
        category: "team",
      });

      // Invite relevant users to the channel
      const slackUserIdsToInvite: string[] = [];
      
      // Add the creating user's Slack ID
      if (userId) {
        const creator = await authStorage.getUser(userId);
        if (creator?.slackUserId) {
          slackUserIdsToInvite.push(creator.slackUserId);
        }
      }
      
      // Add coordinators' Slack IDs
      if (transaction.coordinatorIds && transaction.coordinatorIds.length > 0) {
        const coordsWithSlack = await Promise.all(
          transaction.coordinatorIds.map(id => storage.getCoordinator(id))
        );
        coordsWithSlack
          .filter(c => c?.slackUserId)
          .forEach(c => slackUserIdsToInvite.push(c!.slackUserId!));
      }
      
      // Invite all users to the channel
      if (slackUserIdsToInvite.length > 0) {
        await inviteUsersToChannel(slackResult.channelId, slackUserIdsToInvite);
      }

      // Post a welcome message
      await postToChannel(
        slackResult.channelId,
        `:house: *Slack channel connected for ${transaction.propertyAddress}*\n\nThis channel has been connected to an existing transaction in Mission Control.`
      );

      // Return updated transaction
      const updatedTransaction = await storage.getTransaction(transaction.id);
      res.json({
        success: true,
        slackChannelId: slackResult.channelId,
        slackChannelName: slackResult.channelName,
        transaction: updatedTransaction
      });
    } catch (error: any) {
      console.error("Connect Slack error:", error);
      res.status(500).json({ message: error.message || "Failed to connect Slack channel" });
    }
  });

  app.post("/api/transactions/:id/refresh-mls", isAuthenticated, async (req, res) => {
    console.log("=== REFRESH MLS REQUEST ===", req.params.id);
    try {
      const transaction = await storage.getTransaction(req.params.id);
      console.log("Transaction found:", transaction?.id, "MLS#:", transaction?.mlsNumber);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (!process.env.REPLIERS_API_KEY) {
        console.log("REPLIERS_API_KEY not configured");
        return res.status(400).json({ message: "Repliers API key not configured" });
      }
      console.log("Calling Repliers API for MLS#:", transaction.mlsNumber);

      let mlsData = null;
      let cmaData: any[] = [];

      if (transaction.mlsNumber) {
        const mlsResult = await fetchMLSListing(transaction.mlsNumber);
        if (mlsResult) {
          mlsData = mlsResult.mlsData;
          cmaData = mlsResult.comparables;
          console.log("MLS Data returned:", "found", mlsData?.photos?.length, "photos");
          
          // GLOBAL RENTAL EXCLUSION: Reject rental/lease listings on refresh
          // Check both rawData and mlsData itself (rawData may be absent for cached/normalized records)
          if (isRentalOrLease(mlsData.rawData ?? mlsData)) {
            return res.status(422).json({
              message: "Rental/Lease listings are not supported.",
              code: "RENTAL_EXCLUDED",
              mlsNumber: transaction.mlsNumber,
            });
          }
          
          // Fallback to separate API call if no comparables in listing
          if (!cmaData || cmaData.length === 0) {
            cmaData = await fetchSimilarListings(transaction.mlsNumber);
          }
          
          // Fallback for closed listings: use coordinate-based search if fetchSimilarListings returned empty
          // The /listings/similar endpoint returns 404 for closed listings, so we use searchNearbyComparables
          if ((!cmaData || cmaData.length === 0) && mlsData.coordinates?.latitude && mlsData.coordinates?.longitude) {
            const status = mlsData.status?.toLowerCase() || (mlsData as any).standardStatus?.toLowerCase() || '';
            const isClosed = status.includes('closed') || status.includes('sold');
            
            if (isClosed) {
              console.log(`[RefreshMLS] Using coordinate-based search for closed listing ${transaction.mlsNumber}`);
              const defaultFilters: CMASearchFilters = {
                radius: 5,
                maxResults: 10,
                statuses: ['Closed', 'Active', 'Active Under Contract', 'Pending'],
                soldWithinMonths: 6,
              };
              
              cmaData = await searchNearbyComparables(
                mlsData.coordinates.latitude,
                mlsData.coordinates.longitude,
                transaction.mlsNumber,
                defaultFilters
              );
              console.log(`[RefreshMLS] Coordinate search found ${cmaData.length} comparables for closed listing`);
            }
          }
        } else {
          console.log("MLS Data returned: null");
        }
      } else {
        console.log("No MLS number on transaction");
      }

      const updateData: any = {};
      
      if (mlsData) {
        updateData.mlsData = mlsData;
        // Note: propertyImages is for user uploads only, MLS photos come from mlsData
        updateData.propertyDescription = mlsData.description || "";
        if (mlsData.bedrooms) updateData.bedrooms = mlsData.bedrooms;
        if (mlsData.bathrooms) updateData.bathrooms = mlsData.bathrooms;
        if (mlsData.sqft) updateData.sqft = mlsData.sqft;
        if (mlsData.yearBuilt) updateData.yearBuilt = mlsData.yearBuilt;
        if (mlsData.propertyType) updateData.propertyType = mlsData.propertyType;
        if (mlsData.listPrice) updateData.listPrice = mlsData.listPrice;
      }
      
      if (cmaData && cmaData.length > 0) {
        updateData.cmaData = cmaData;
      }

      console.log("Updating transaction with:", Object.keys(updateData));
      const updated = await storage.updateTransaction(req.params.id, updateData);

      await storage.createActivity({
        transactionId: transaction.id,
        type: "mls_refreshed",
        description: mlsData ? `MLS data refreshed with ${mlsData.photos?.length || 0} photos` : "MLS data refresh attempted (no data found)",
        category: "mls",
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error refreshing MLS data:", error);
      res.status(500).json({ message: error.message || "Failed to refresh MLS data" });
    }
  });

  // POST /api/transactions/:id/generate-cma-fallback
  // Generates CMA data using coordinate-based search for closed listings
  app.post("/api/transactions/:id/generate-cma-fallback", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const { radius = 5 } = req.body;

      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const mlsData = transaction.mlsData as any;
      if (!mlsData) {
        return res.status(400).json({ 
          error: "No MLS data available",
          message: "This transaction does not have MLS data to extract coordinates from."
        });
      }

      const latitude = mlsData.coordinates?.latitude || mlsData.map?.latitude || mlsData.latitude;
      const longitude = mlsData.coordinates?.longitude || mlsData.map?.longitude || mlsData.longitude;

      if (!latitude || !longitude) {
        return res.status(400).json({ 
          error: "No coordinates available",
          message: "This property does not have latitude/longitude coordinates in the MLS data."
        });
      }

      const subjectPrice = mlsData.listPrice || mlsData.soldPrice || mlsData.closePrice;
      const subjectBeds = mlsData.bedrooms || mlsData.bedroomsTotal;

      const filters: CMASearchFilters = {
        radius: radius,
        maxResults: 15,
        statuses: ['Closed', 'Active', 'Active Under Contract', 'Pending'],
        soldWithinMonths: 6,
      };

      if (subjectPrice) {
        filters.minPrice = Math.round(subjectPrice * 0.75);
        filters.maxPrice = Math.round(subjectPrice * 1.25);
      }

      if (subjectBeds) {
        filters.minBeds = Math.max(1, subjectBeds - 1);
      }

      console.log(`[CMA Fallback] Generating for transaction ${id} at (${latitude}, ${longitude})`);

      const comparables = await searchNearbyComparables(
        latitude,
        longitude,
        transaction.mlsNumber || '',
        filters
      );

      if (!comparables || comparables.length === 0) {
        return res.status(200).json({ 
          success: false,
          message: "No comparable properties found within the search radius.",
          comparablesCount: 0
        });
      }

      await storage.updateTransaction(id, {
        cmaData: comparables,
        cmaSource: "coordinate_fallback",
        cmaGeneratedAt: new Date(),
      });

      await storage.createActivity({
        transactionId: id,
        type: "cma_generated",
        description: `Generated ${comparables.length} comparables using nearby property search`,
        category: "cma",
      });

      console.log(`[CMA Fallback] Success: ${comparables.length} comparables found for transaction ${id}`);

      res.json({ 
        success: true,
        message: `Found ${comparables.length} comparable properties`,
        comparablesCount: comparables.length,
      });

    } catch (error: any) {
      console.error("[CMA Fallback] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE /api/transactions/:id/cma
  // Clears CMA data from a transaction
  app.delete("/api/transactions/:id/cma", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;

      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      await storage.updateTransaction(id, {
        cmaData: null,
        cmaSource: null,
        cmaGeneratedAt: null,
      });

      await storage.createActivity({
        transactionId: id,
        type: "cma_cleared",
        description: "Comparative market analysis data was removed",
        category: "cma",
      });

      console.log(`[CMA] Cleared CMA data for transaction ${id}`);

      res.json({ success: true, message: "CMA data cleared" });

    } catch (error: any) {
      console.error("[CMA Clear] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/transactions/:id/activities", isAuthenticated, async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      let activities = await storage.getActivitiesByTransaction(req.params.id);
      
      // Filter by category if specified
      if (category && category !== 'all') {
        activities = activities.filter(a => a.category === category);
      }
      
      // Sort by newest first
      activities.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // ============ Listing Search (Templates) ============
  // Search MLS listing by address or MLS number for template generation
  app.get("/api/listings/search", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.query;
      if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Query parameter required" });
      }

      if (!process.env.REPLIERS_API_KEY) {
        return res.status(400).json({ message: "Repliers API key not configured" });
      }

      let listing = null;

      // If it looks like an MLS number (mostly digits), search by MLS number first
      const isLikelyMLS = /^[A-Za-z]?\d+$/.test(query.replace(/\s/g, ""));
      
      if (isLikelyMLS) {
        const mlsResult = await fetchMLSListing(query.replace(/\s/g, ""));
        if (mlsResult) {
          // GLOBAL RENTAL EXCLUSION: Check if this is a rental/lease listing
          // Check both rawData and mlsData itself (rawData may be absent for cached/normalized records)
          if (isRentalOrLease(mlsResult.mlsData.rawData ?? mlsResult.mlsData)) {
            return res.status(422).json({
              message: "Rental/Lease listings are not supported.",
              code: "RENTAL_EXCLUDED",
              mlsNumber: query,
            });
          }
          listing = mlsResult.mlsData;
        }
      }
      
      // If not found by MLS, try address search (already has rental filter in searchByAddress)
      if (!listing) {
        const addressResult = await searchByAddress(query);
        if (addressResult) {
          // GLOBAL RENTAL EXCLUSION: Double-check address search results
          // Check both rawData and addressResult itself (rawData may be absent for cached/normalized records)
          if (isRentalOrLease(addressResult.rawData ?? addressResult)) {
            return res.status(422).json({
              message: "Rental/Lease listings are not supported.",
              code: "RENTAL_EXCLUDED",
            });
          }
          listing = addressResult;
        }
      }

      if (!listing) {
        return res.status(404).json({ message: "No listing found for the provided query" });
      }

      res.json(listing);
    } catch (error) {
      console.error("Error searching listings:", error);
      res.status(500).json({ message: "Failed to search listings" });
    }
  });

  // ============ MLS Autocomplete Search ============

  // Helper: Normalize MLS Number Input
  // Handles: "2572987" → "ACT2572987"
  //          "ACT2572987" → "ACT2572987"
  //          "act2572987" → "ACT2572987"
  function normalizeMlsNumber(input: string): { 
    normalized: string; 
    isPartial: boolean;
    numbersOnly: string;
  } {
    const cleaned = input.trim().toUpperCase();
    const numbersOnly = cleaned.replace(/[^0-9]/g, '');
    
    if (cleaned.startsWith('ACT')) {
      return {
        normalized: `ACT${numbersOnly}`,
        isPartial: numbersOnly.length < 7,
        numbersOnly,
      };
    }
    
    if (/^\d+$/.test(cleaned)) {
      return {
        normalized: `ACT${cleaned}`,
        isPartial: cleaned.length < 7,
        numbersOnly: cleaned,
      };
    }
    
    return {
      normalized: cleaned,
      isPartial: true,
      numbersOnly,
    };
  }

  // Helper: Format address from Repliers listing
  function formatAddressFromRepliers(listing: any): string {
    if (listing.address) {
      if (typeof listing.address === 'string') {
        return listing.address;
      }
      const parts = [
        listing.address.streetNumber,
        listing.address.streetName,
        listing.address.streetSuffix,
        listing.address.unitNumber ? `#${listing.address.unitNumber}` : null,
      ].filter(Boolean);
      if (parts.length > 0) {
        return parts.join(' ');
      }
    }
    
    const parts = [
      listing.streetNumber,
      listing.streetName, 
      listing.streetSuffix,
      listing.unitNumber ? `#${listing.unitNumber}` : null,
    ].filter(Boolean);
    
    return parts.join(' ') || listing.unparsedAddress || 'Unknown Address';
  }

  function formatFullAddressFromRepliers(listing: any): string {
    const street = formatAddressFromRepliers(listing);
    const city = listing.address?.city || listing.city || '';
    const state = listing.address?.state || listing.address?.stateOrProvince || listing.stateOrProvince || 'TX';
    const zip = listing.address?.postalCode || listing.postalCode || '';
    
    const cityStateZip = [city, state].filter(Boolean).join(', ');
    return street ? `${street}, ${cityStateZip} ${zip}`.trim() : `${cityStateZip} ${zip}`.trim();
  }

  // Helper: Map Repliers Listing to Result
  function mapListingToSearchResult(listing: any) {
    return {
      mlsNumber: listing.mlsNumber || listing.listingId || '',
      address: formatAddressFromRepliers(listing),
      fullAddress: formatFullAddressFromRepliers(listing),
      listPrice: listing.listPrice,
      status: listing.standardStatus || listing.mlsStatus || listing.status,
      beds: listing.bedroomsTotal || listing.bedrooms,
      baths: listing.bathroomsTotal || listing.bathrooms,
      sqft: listing.livingArea || listing.squareFeet || listing.sqft,
      propertyType: listing.propertyType,
      yearBuilt: listing.yearBuilt,
      daysOnMarket: listing.daysOnMarket,
      photos: listing.images?.slice(0, 3) || listing.photos?.slice(0, 3) || [],
    };
  }

  // Search Properties by Address (autocomplete)
  // GET /api/places/autocomplete?query=13106+New+Boston
  // Uses Google Places API for address suggestions
  app.get("/api/places/autocomplete", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 3) {
        return res.json({ predictions: [] });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('[Places API] GOOGLE_MAPS_API_KEY not configured');
        return res.json({ predictions: [] });
      }

      console.log(`[Places API] Searching for: "${query}"`);

      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.append('input', query);
      url.searchParams.append('types', 'address');
      url.searchParams.append('components', 'country:us');
      url.searchParams.append('key', apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.error(`[Places API] Error: ${response.status}`);
        return res.json({ predictions: [] });
      }

      const data = await response.json();
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error(`[Places API] Status: ${data.status}`);
        return res.json({ predictions: [] });
      }

      const predictions = (data.predictions || []).map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || '',
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));
      
      console.log(`[Places API] Found ${predictions.length} suggestions`);
      res.json({ predictions });
    } catch (error: any) {
      console.error('[Places API] Error:', error.message);
      res.json({ predictions: [] });
    }
  });

  // GET /api/mls/search/address?query=13106+New+Boston
  // Now uses the full address to search MLS (called after selecting from Places)
  app.get("/api/mls/search/address", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 3) {
        return res.json({ results: [] });
      }

      console.log(`[MLS Search] Searching by address: "${query}"`);

      if (!process.env.REPLIERS_API_KEY) {
        return res.json({ results: [] });
      }

      // Use the repliersRequest from repliers.ts
      const REPLIERS_API_BASE = "https://api.repliers.io";
      const apiKey = process.env.REPLIERS_API_KEY;
      
      const url = new URL(`${REPLIERS_API_BASE}/listings`);
      // Use 'address' parameter for address search
      url.searchParams.append('address', query);
      url.searchParams.append('resultsPerPage', '8');
      url.searchParams.append('status', 'A,U,P,S');
      url.searchParams.append('sortBy', 'updatedOn');
      url.searchParams.append('sortOrder', 'desc');
      url.searchParams.append('class', 'residential');
      url.searchParams.append('type', 'Sale');

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "REPLIERS-API-KEY": apiKey,
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        console.error(`[MLS Search] Address search error: ${response.status}`);
        return res.json({ results: [] });
      }

      const data = await response.json();
      const results = (data.listings || [])
        .filter((l: any) => !isRentalOrLease(l))
        .map(mapListingToSearchResult);
      
      console.log(`[MLS Search] Found ${results.length} properties for address: "${query}"`);
      res.json({ results });
    } catch (error: any) {
      console.error('[MLS Search Address] Error:', error.message);
      res.json({ results: [] });
    }
  });

  // Search Properties by MLS Number (autocomplete)
  // GET /api/mls/search/mlsNumber?query=2572987
  // GET /api/mls/search/mlsNumber?query=ACT2572987
  app.get("/api/mls/search/mlsNumber", isAuthenticated, async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.length < 3) {
        return res.json({ results: [] });
      }

      console.log(`[MLS Search] Searching by MLS#: "${query}"`);

      if (!process.env.REPLIERS_API_KEY) {
        return res.json({ results: [] });
      }

      const { normalized, isPartial, numbersOnly } = normalizeMlsNumber(query);
      const results: any[] = [];
      const REPLIERS_API_BASE = "https://api.repliers.io";
      const apiKey = process.env.REPLIERS_API_KEY;

      // Strategy 1: Try exact match with normalized MLS number
      if (!isPartial && normalized) {
        try {
          console.log(`[MLS Search] Trying exact match: ${normalized}`);
          const exactUrl = `${REPLIERS_API_BASE}/listings/${normalized}`;
          const exactResponse = await fetch(exactUrl, {
            method: "GET",
            headers: {
              "REPLIERS-API-KEY": apiKey,
              "Accept": "application/json",
            },
          });
          
          if (exactResponse.ok) {
            const exactMatch = await exactResponse.json();
            if (exactMatch && (exactMatch.mlsNumber || exactMatch.listingId)) {
              if (!isRentalOrLease(exactMatch)) {
                results.push(mapListingToSearchResult(exactMatch));
                console.log(`[MLS Search] Exact match found: ${normalized}`);
              }
            }
          }
        } catch (e) {
          console.log(`[MLS Search] No exact match for ${normalized}`);
        }
      }

      // Strategy 2: If no exact match or partial input, search listings
      if (results.length === 0) {
        try {
          const url = new URL(`${REPLIERS_API_BASE}/listings`);
          url.searchParams.append('search', normalized);
          url.searchParams.append('resultsPerPage', '8');
          url.searchParams.append('type', 'Sale');

          const response = await fetch(url.toString(), {
            method: "GET",
            headers: {
              "REPLIERS-API-KEY": apiKey,
              "Accept": "application/json",
            },
          });

          if (response.ok) {
            const searchData = await response.json();
            if (searchData.listings && searchData.listings.length > 0) {
              searchData.listings.forEach((listing: any) => {
                if (!isRentalOrLease(listing)) {
                  const mlsNum = (listing.mlsNumber || listing.listingId || '').toString();
                  if (mlsNum.toLowerCase().includes(numbersOnly.toLowerCase())) {
                    results.push(mapListingToSearchResult(listing));
                  }
                }
              });
            }
          }
        } catch (e) {
          console.log(`[MLS Search] Search failed for ${normalized}`);
        }
      }

      // Remove duplicates
      const uniqueResults = results.filter((item, index, self) => 
        index === self.findIndex(t => t.mlsNumber === item.mlsNumber)
      );

      console.log(`[MLS Search] Found ${uniqueResults.length} properties for MLS#: "${query}"`);
      res.json({ results: uniqueResults });
    } catch (error: any) {
      console.error('[MLS Search MLS#] Error:', error.message);
      res.json({ results: [] });
    }
  });

  // Get Single Listing by MLS Number
  // GET /api/mls/listing/ACT2572987
  // GET /api/mls/listing/2572987 (also works)
  app.get("/api/mls/listing/:mlsNumber", isAuthenticated, async (req, res) => {
    try {
      let { mlsNumber } = req.params;
      const { normalized } = normalizeMlsNumber(mlsNumber);
      console.log(`[MLS Listing] Fetching: ${normalized}`);

      const result = await fetchMLSListing(normalized);
      
      if (!result || !result.mlsData) {
        return res.status(404).json({ error: "Listing not found" });
      }

      // Check if rental
      if (isRentalOrLease(result.mlsData.rawData ?? result.mlsData)) {
        return res.status(422).json({
          message: "Rental/Lease listings are not supported.",
          code: "RENTAL_EXCLUDED",
        });
      }

      const listing = result.mlsData;
      res.json({
        mlsNumber: listing.mlsNumber,
        address: listing.address,
        fullAddress: `${listing.address}, ${listing.city}, ${listing.state} ${listing.zipCode}`,
        listPrice: listing.listPrice,
        status: listing.status,
        beds: listing.bedrooms,
        baths: listing.bathrooms,
        sqft: listing.sqft,
        propertyType: listing.propertyType,
        yearBuilt: listing.yearBuilt,
        daysOnMarket: listing.daysOnMarket,
        photos: listing.photos?.slice(0, 5) || [],
        description: listing.description,
        city: listing.city,
        state: listing.state,
        postalCode: listing.zipCode,
        listDate: listing.listDate,
        originalPrice: listing.originalPrice,
        pricePerSqft: listing.listPrice && listing.sqft 
          ? Math.round(listing.listPrice / listing.sqft) 
          : null,
      });
    } catch (error: any) {
      console.error('[MLS Listing] Error:', error.message);
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // ============ Coordinators ============
  // Note: Coordinators are internal team data, no auth required for read
  app.get("/api/coordinators", async (req, res) => {
    try {
      console.log("[coordinators] Fetching coordinators...");
      const coordinators = await storage.getCoordinators();
      console.log(`[coordinators] Found ${coordinators.length} coordinators:`, coordinators.map(c => c.name));
      res.json(coordinators);
    } catch (error) {
      console.error("[coordinators] Error fetching coordinators:", error);
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

  // ============ Marketing Assets ============
  
  // Photo recommendations endpoint for Create Graphics dialog
  app.get("/api/transactions/:id/recommended-photos", isAuthenticated, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const mlsData = transaction.mlsData as any;
      const photos = mlsData?.images || transaction.propertyImages || [];
      
      if (!photos.length) {
        return res.json({ photos: [], recommendations: [] });
      }
      
      // Score photos based on position and metadata/filename heuristics
      const scoredPhotos = photos.map((photo: string | object, index: number) => {
        let score = 0;
        const reasons: string[] = [];
        const url = typeof photo === 'string' ? photo : (photo as any).url || '';
        const urlLower = url.toLowerCase();
        const description = (typeof photo === 'object' ? (photo as any).description || (photo as any).caption || '' : '').toLowerCase();
        
        // First photo is usually the hero/front exterior - highest priority
        if (index === 0) {
          score += 15;
          reasons.push('Primary listing photo');
        }
        
        // Check photo description/tags if available
        if (description.includes('front') || description.includes('exterior')) {
          score += 8;
          reasons.push('Exterior view');
        }
        if (description.includes('kitchen')) {
          score += 6;
          reasons.push('Kitchen');
        }
        if (description.includes('living') || description.includes('great room')) {
          score += 5;
          reasons.push('Living area');
        }
        if (description.includes('master') || description.includes('primary')) {
          score += 4;
          reasons.push('Primary bedroom');
        }
        if (description.includes('pool') || description.includes('backyard')) {
          score += 5;
          reasons.push('Outdoor amenity');
        }
        
        // Fallback: check URL/filename for hints when no description available
        if (!description) {
          if (urlLower.includes('front') || urlLower.includes('exterior') || urlLower.includes('_01') || urlLower.includes('-01')) {
            score += 6;
            reasons.push('Likely exterior (filename hint)');
          }
          if (urlLower.includes('kitchen')) {
            score += 4;
            reasons.push('Kitchen (filename hint)');
          }
          if (urlLower.includes('living') || urlLower.includes('family')) {
            score += 3;
            reasons.push('Living area (filename hint)');
          }
        }
        
        // Top 5 photos get a bonus (they're usually curated by listing agent)
        if (index < 5) {
          score += (5 - index);
        }
        
        return {
          url,
          index,
          score,
          reasons,
          isRecommended: score >= 6
        };
      });
      
      // Get top 5 recommendations sorted by score
      const recommendations = [...scoredPhotos]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => p.index);
      
      res.json({
        photos: scoredPhotos,
        recommendations
      });
    } catch (error) {
      console.error("Error getting recommended photos:", error);
      res.status(500).json({ message: "Failed to get photo recommendations" });
    }
  });

  app.get("/api/transactions/:id/marketing-assets", isAuthenticated, async (req, res) => {
    try {
      const assets = await storage.getMarketingAssetsByTransaction(req.params.id);
      res.json(assets);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch marketing assets" });
    }
  });

  app.post("/api/transactions/:id/marketing-assets", isAuthenticated, async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const { type, imageData, fileName, postToSlack } = req.body;
      
      if (!type || !imageData || !fileName) {
        return res.status(400).json({ message: "type, imageData, and fileName are required" });
      }

      const asset = await storage.createMarketingAsset({
        transactionId: req.params.id,
        type,
        imageData,
        fileName,
        metadata: { createdBy: (req as any).user?.claims?.sub },
      });

      await storage.createActivity({
        transactionId: req.params.id,
        type: "marketing_created",
        description: `Marketing asset created: ${type}`,
        category: "marketing",
      });

      const userId = (req as any).user?.claims?.sub;
      const createdBy = (req as any).user?.claims?.email || userId || 'Unknown';

      // Check notification settings and send to Slack
      if (transaction.slackChannelId) {
        let shouldNotify = postToSlack; // If explicitly requested, honor that
        
        // If not explicitly requested, check user's notification settings
        if (postToSlack === undefined && userId) {
          try {
            const settings = await storage.getNotificationSettings(userId, transaction.id);
            shouldNotify = settings?.marketingAssets ?? true; // Default to true
          } catch (e) {
            shouldNotify = true; // Default to enabled if can't get settings
          }
        }
        
        if (shouldNotify) {
          try {
            await sendMarketingNotification(
              transaction.slackChannelId,
              transaction.propertyAddress,
              type,
              createdBy,
              imageData,
              fileName
            );
          } catch (slackError) {
            console.error("Failed to send marketing notification to Slack:", slackError);
          }
        }
      }

      res.status(201).json(asset);
    } catch (error: any) {
      console.error("Marketing asset creation error:", error);
      res.status(400).json({ message: error.message || "Failed to create marketing asset" });
    }
  });

  app.patch("/api/transactions/:transactionId/marketing-assets/:id", isAuthenticated, async (req, res) => {
    try {
      const existing = await storage.getMarketingAsset(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Marketing asset not found" });
      }

      const { imageData, fileName, metadata, type } = req.body;
      
      const updateData: any = {};
      if (imageData) updateData.imageData = imageData;
      if (fileName) updateData.fileName = fileName;
      if (metadata) updateData.metadata = metadata;
      if (type) updateData.type = type;

      const updated = await storage.updateMarketingAsset(req.params.id, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("Marketing asset update error:", error);
      res.status(500).json({ message: error.message || "Failed to update marketing asset" });
    }
  });

  app.delete("/api/transactions/:transactionId/marketing-assets/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Get the asset before deleting to have details for notification
      const asset = await storage.getMarketingAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ message: "Marketing asset not found" });
      }

      const deleted = await storage.deleteMarketingAsset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Marketing asset not found" });
      }

      // Get asset type label
      const assetTypeLabels: Record<string, string> = {
        'instagram-post': 'Instagram Post',
        'instagram-story': 'Instagram Story', 
        'facebook-post': 'Facebook Post',
        'flyer': 'Property Flyer',
      };
      const assetTypeLabel = assetTypeLabels[asset.type] || asset.type;

      // Log activity
      await storage.createActivity({
        transactionId: req.params.transactionId,
        type: "marketing_deleted",
        description: `Marketing asset deleted: ${assetTypeLabel}`,
        category: "marketing",
      });

      // Send Slack notification
      const transaction = await storage.getTransaction(req.params.transactionId);
      if (transaction?.slackChannelId) {
        const userId = req.user?.claims?.sub;
        let shouldNotify = true;

        if (userId) {
          try {
            const settings = await storage.getNotificationSettings(userId, transaction.id);
            shouldNotify = settings?.marketingAssets ?? true;
          } catch (e) {
            shouldNotify = true;
          }
        }

        if (shouldNotify) {
          try {
            const address = transaction.propertyAddress || 'Unknown Property';
            const message = `:wastebasket: *Marketing Asset Deleted*\n• Type: ${assetTypeLabel}\n• Property: ${address}`;
            await postToChannel(transaction.slackChannelId, message);
          } catch (slackError) {
            console.error("Failed to send Slack notification for marketing deletion:", slackError);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marketing asset" });
    }
  });

  // ============ Property Photos (Off Market) ============

  // Upload property photos for off-market listings
  app.post("/api/transactions/:id/photos", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Get the private object directory for uploads
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) {
        return res.status(500).json({ message: "Object storage not configured" });
      }

      const { imageData, fileName } = req.body;
      if (!imageData) {
        return res.status(400).json({ message: "Missing image data" });
      }

      // Server-side validation for file type
      const validImagePrefixes = ['data:image/jpeg', 'data:image/png', 'data:image/gif', 'data:image/webp', 'data:image/jpg'];
      if (!validImagePrefixes.some(prefix => imageData.startsWith(prefix))) {
        return res.status(400).json({ message: "Invalid file type. Only images (JPG, PNG, GIF, WebP) are allowed." });
      }

      // Server-side validation for file size (max 10MB)
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      const fileSizeBytes = Buffer.byteLength(base64Data, 'base64');
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB
      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).json({ message: `File too large. Maximum size is 10MB. Your file is ${(fileSizeBytes / (1024 * 1024)).toFixed(2)}MB.` });
      }

      // Parse bucket name from private dir path
      const pathParts = privateDir.split('/').filter(Boolean);
      const bucketName = pathParts[0];
      
      // Create unique filename
      const timestamp = Date.now();
      const uniqueFileName = `property-photos/${transaction.id}/${timestamp}-${fileName || 'photo.jpg'}`;
      
      // Upload to object storage using signed URL
      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(`${pathParts.slice(1).join('/')}/${uniqueFileName}`);
      
      // Convert base64 to buffer (reuse base64Data from validation above)
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Determine content type
      const contentType = imageData.startsWith('data:image/png') ? 'image/png' : 
                         imageData.startsWith('data:image/gif') ? 'image/gif' : 'image/jpeg';
      
      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Get signed URL for viewing the uploaded photo
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
      });

      // Update transaction with new photo URL
      const currentImages = transaction.propertyImages || [];
      const updatedImages = [...currentImages, signedUrl];
      
      await storage.updateTransaction(transaction.id, {
        propertyImages: updatedImages,
      });

      await storage.createActivity({
        transactionId: transaction.id,
        type: "photo_uploaded",
        description: `Property photo uploaded`,
        category: "marketing",
      });

      res.json({ 
        success: true, 
        photoUrl: signedUrl,
        propertyImages: updatedImages,
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      res.status(500).json({ message: "Failed to upload photo" });
    }
  });

  // Set primary photo index
  app.patch("/api/transactions/:id/photos/primary", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const { primaryPhotoIndex } = req.body;
      if (typeof primaryPhotoIndex !== 'number' || primaryPhotoIndex < 0) {
        return res.status(400).json({ message: "Invalid photo index" });
      }

      await storage.updateTransaction(transaction.id, {
        primaryPhotoIndex,
      });

      res.json({ success: true, primaryPhotoIndex });
    } catch (error) {
      console.error("Error setting primary photo:", error);
      res.status(500).json({ message: "Failed to set primary photo" });
    }
  });

  // Delete a property photo
  app.delete("/api/transactions/:id/photos/:photoIndex", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const photoIndex = parseInt(req.params.photoIndex);
      const currentImages = transaction.propertyImages || [];
      
      if (photoIndex < 0 || photoIndex >= currentImages.length) {
        return res.status(400).json({ message: "Invalid photo index" });
      }

      // Remove the photo at the specified index
      const updatedImages = currentImages.filter((_, i) => i !== photoIndex);
      
      // Adjust primary photo index if needed
      let newPrimaryIndex = transaction.primaryPhotoIndex || 0;
      if (photoIndex === newPrimaryIndex) {
        newPrimaryIndex = 0; // Reset to first photo
      } else if (photoIndex < newPrimaryIndex) {
        newPrimaryIndex = Math.max(0, newPrimaryIndex - 1); // Shift down
      }

      await storage.updateTransaction(transaction.id, {
        propertyImages: updatedImages,
        primaryPhotoIndex: Math.min(newPrimaryIndex, Math.max(0, updatedImages.length - 1)),
      });

      await storage.createActivity({
        transactionId: transaction.id,
        type: "photo_deleted",
        description: `Property photo deleted`,
        category: "marketing",
      });

      res.json({ 
        success: true, 
        propertyImages: updatedImages,
        primaryPhotoIndex: newPrimaryIndex,
      });
    } catch (error) {
      console.error("Error deleting photo:", error);
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // ============ Contract Documents ============

  app.get("/api/transactions/:id/documents", isAuthenticated, async (req, res) => {
    try {
      const documents = await storage.getContractDocumentsByTransaction(req.params.id);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/transactions/:id/documents", isAuthenticated, async (req: any, res) => {
    process.stderr.write(`\n[DOC UPLOAD] ========== DOCUMENT UPLOAD DEBUG ==========\n`);
    process.stderr.write(`[DOC UPLOAD] Route hit for transaction: ${req.params.id}\n`);
    process.stderr.write(`[DOC UPLOAD] Content-Type: ${req.get('Content-Type')}\n`);
    process.stderr.write(`[DOC UPLOAD] Body keys: ${Object.keys(req.body || {}).join(', ')}\n`);
    
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const { name, documentType, fileName, fileData, fileType, fileSize, notes } = req.body;
      
      if (!fileName || !fileData || !fileType || !fileSize) {
        return res.status(400).json({ message: "Missing required file data" });
      }

      const doc = await storage.createContractDocument({
        transactionId: req.params.id,
        name: name || fileName.replace(/\.[^/.]+$/, ''), // Use name or filename without extension
        documentType: documentType || 'other',
        fileName,
        fileData,
        fileType,
        fileSize,
        notes: notes || null,
        uploadedBy: req.user?.claims?.email || req.user?.claims?.sub,
      });

      const docLabel = name || fileName;
      await storage.createActivity({
        transactionId: req.params.id,
        type: "document_uploaded",
        description: `Contract document uploaded: ${docLabel}`,
        category: "documents",
      });

      // Format file size for display
      const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      // Get document type label
      const docTypeLabels: Record<string, string> = {
        contract: 'Contract',
        amendment: 'Amendment',
        addendum: 'Addendum',
        disclosure: 'Disclosure',
        inspection: 'Inspection Report',
        appraisal: 'Appraisal',
        title: 'Title Document',
        insurance: 'Insurance',
        closing: 'Closing Document',
        other: 'Other',
      };
      const docTypeLabel = docTypeLabels[documentType || 'other'] || 'Other';

      // Get file extension
      const fileExt = fileName.split('.').pop()?.toLowerCase() || 'unknown';

      // Check notification settings and send Slack notification with file
      process.stderr.write(`[DOC UPLOAD] Starting Slack notification flow...\n`);
      process.stderr.write(`[DOC UPLOAD] Transaction slackChannelId: ${transaction.slackChannelId}\n`);
      
      if (transaction.slackChannelId) {
        const userId = req.user?.claims?.sub;
        let shouldNotify = true; // Default to enabled
        
        process.stderr.write(`[DOC UPLOAD] User ID: ${userId}\n`);
        
        if (userId) {
          try {
            const settings = await storage.getNotificationSettings(userId, transaction.id);
            shouldNotify = settings?.documentUploads ?? true;
            process.stderr.write(`[DOC UPLOAD] Notification settings: ${JSON.stringify(settings)}\n`);
            process.stderr.write(`[DOC UPLOAD] shouldNotify: ${shouldNotify}\n`);
          } catch (e) {
            process.stderr.write(`[DOC UPLOAD] Error getting settings, defaulting to enabled: ${e}\n`);
            shouldNotify = true; // Default to enabled if can't get settings
          }
        }
        
        if (shouldNotify) {
          process.stderr.write(`[DOC UPLOAD] Preparing to send file to Slack...\n`);
          try {
            // Build the notification message to include with file upload
            const timestamp = new Date().toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            
            const uploaderName = req.user?.claims?.email || 'Unknown User';
            const notesText = notes ? `\n*Notes:* ${notes}` : '';
            
            const initialComment = [
              `*New Document Uploaded*`,
              ``,
              `*Document:* ${docLabel}`,
              `*Type:* ${docTypeLabel}`,
              `*Format:* ${fileExt.toUpperCase()}`,
              `*Size:* ${formatFileSize(fileSize)}`,
              `*Property:* ${transaction.propertyAddress}`,
              `*Uploaded by:* ${uploaderName}`,
              `*Time:* ${timestamp}`,
              notesText,
            ].filter(Boolean).join('\n');

            // Upload the actual file to Slack with the notification as initial comment
            process.stderr.write(`[DOC UPLOAD] Calling uploadFileToChannel with:\n`);
            process.stderr.write(`[DOC UPLOAD]   - channelId: ${transaction.slackChannelId}\n`);
            process.stderr.write(`[DOC UPLOAD]   - fileName: ${fileName}\n`);
            process.stderr.write(`[DOC UPLOAD]   - fileData length: ${fileData?.length || 'undefined'}\n`);
            
            const result = await uploadFileToChannel(
              transaction.slackChannelId,
              fileData,
              fileName,
              docLabel,
              initialComment
            );
            process.stderr.write(`[DOC UPLOAD] uploadFileToChannel result: ${JSON.stringify(result)}\n`);
          } catch (slackError) {
            process.stderr.write(`[DOC UPLOAD] Failed to send document to Slack: ${slackError}\n`);
            // Don't fail the request if Slack notification fails
          }
        } else {
          process.stderr.write(`[DOC UPLOAD] shouldNotify is false, skipping Slack notification\n`);
        }
      } else {
        process.stderr.write(`[DOC UPLOAD] No slackChannelId on transaction, skipping Slack notification\n`);
      }

      res.status(201).json(doc);
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(400).json({ message: error.message || "Failed to upload document" });
    }
  });

  app.delete("/api/transactions/:transactionId/documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      // Get the document before deleting to have details for notification
      const document = await storage.getContractDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }

      const deleted = await storage.deleteContractDocument(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }

      const docLabel = document.name || document.fileName;

      // Get document type label
      const docTypeLabels: Record<string, string> = {
        contract: 'Contract',
        amendment: 'Amendment',
        addendum: 'Addendum',
        disclosure: 'Disclosure',
        inspection: 'Inspection Report',
        appraisal: 'Appraisal',
        title: 'Title Document',
        insurance: 'Insurance',
        closing: 'Closing Document',
        other: 'Other',
      };
      const docTypeLabel = docTypeLabels[document.documentType || 'other'] || 'Other';

      // Log activity
      await storage.createActivity({
        transactionId: req.params.transactionId,
        type: "document_deleted",
        description: `Contract document deleted: ${docLabel}`,
        category: "documents",
      });

      // Send Slack notification
      const transaction = await storage.getTransaction(req.params.transactionId);
      if (transaction?.slackChannelId) {
        const userId = req.user?.claims?.sub;
        let shouldNotify = true;

        if (userId) {
          try {
            const settings = await storage.getNotificationSettings(userId, transaction.id);
            shouldNotify = settings?.documentUploads ?? true;
          } catch (e) {
            shouldNotify = true;
          }
        }

        if (shouldNotify) {
          try {
            const address = transaction.propertyAddress || 'Unknown Property';
            const message = `:wastebasket: *Document Deleted*\n• Name: ${docLabel}\n• Type: ${docTypeLabel}\n• Property: ${address}`;
            await postToChannel(transaction.slackChannelId, message);
          } catch (slackError) {
            console.error("Failed to send Slack notification for document deletion:", slackError);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // ============ CMAs (Comparative Market Analysis) ============

  // Get all CMAs
  app.get("/api/cmas", isAuthenticated, async (req, res) => {
    try {
      const allCmas = await storage.getAllCmas();
      res.json(allCmas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch CMAs" });
    }
  });

  // Get CMA by ID
  app.get("/api/cmas/:id", isAuthenticated, async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json(cma);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch CMA" });
    }
  });

  // Get CMA by transaction ID
  app.get("/api/transactions/:transactionId/cma", isAuthenticated, async (req, res) => {
    try {
      const cma = await storage.getCmaByTransaction(req.params.transactionId);
      res.json(cma || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch CMA for transaction" });
    }
  });

  // Get shared CMA by public link token (no auth required for public sharing)
  app.get("/api/shared/cma/:token", async (req, res) => {
    try {
      const cma = await storage.getCmaByShareToken(req.params.token);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found or link expired" });
      }
      // Check expiration
      if (cma.expiresAt && new Date(cma.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This CMA link has expired" });
      }
      res.json(cma);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shared CMA" });
    }
  });

  // Create a new CMA
  app.post("/api/cmas", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const validatedData = insertCmaSchema.parse({
        ...req.body,
        userId,
      });
      const cma = await storage.createCma(validatedData);
      res.status(201).json(cma);
    } catch (error: any) {
      console.error("CMA creation error:", error);
      res.status(400).json({ message: error.message || "Failed to create CMA" });
    }
  });

  // Create CMA for a specific transaction
  app.post("/api/transactions/:transactionId/cma", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const userId = req.user?.claims?.sub;
      const validatedData = insertCmaSchema.parse({
        ...req.body,
        transactionId: req.params.transactionId,
        userId,
        subjectPropertyId: transaction.mlsNumber || undefined,
      });
      const cma = await storage.createCma(validatedData);
      res.status(201).json(cma);
    } catch (error: any) {
      console.error("Transaction CMA creation error:", error);
      res.status(400).json({ message: error.message || "Failed to create CMA for transaction" });
    }
  });

  // Refresh CMA comparables with new filters
  app.post("/api/transactions/:transactionId/cma/refresh", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.transactionId);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const { mlsNumber, filters } = req.body;
      if (!mlsNumber) {
        return res.status(400).json({ message: "MLS number is required" });
      }

      // Get subject property coordinates
      const subjectListing = await fetchMLSListing(mlsNumber);
      if (!subjectListing) {
        return res.status(404).json({ message: "Subject property not found in MLS" });
      }

      const coords = subjectListing.mlsData.coordinates;
      if (!coords?.latitude || !coords?.longitude) {
        return res.status(400).json({ message: "Subject property has no coordinates - cannot search nearby" });
      }

      // Build search filters with defaults
      const searchFilters: CMASearchFilters = {
        radius: filters?.radius || 2,
        minPrice: filters?.minPrice,
        maxPrice: filters?.maxPrice,
        minSqft: filters?.minSqft,
        maxSqft: filters?.maxSqft,
        minYearBuilt: filters?.minYearBuilt,
        maxYearBuilt: filters?.maxYearBuilt,
        minBeds: filters?.minBeds,
        minBaths: filters?.minBaths,
        statuses: filters?.statuses || ['Closed', 'Active', 'Active Under Contract', 'Pending'],
        soldWithinMonths: filters?.soldWithinMonths || 6,
        maxResults: filters?.maxResults || 10,
      };

      console.log(`[CMA Refresh] Searching for comparables near ${mlsNumber} with filters:`, searchFilters);

      // Search for nearby comparables
      const comparables = await searchNearbyComparables(
        coords.latitude,
        coords.longitude,
        mlsNumber,
        searchFilters
      );

      console.log(`[CMA Refresh] Found ${comparables.length} comparables`);

      // Update transaction with new CMA data
      await storage.updateTransaction(req.params.transactionId, {
        cmaData: comparables,
      });

      // Also update any existing CMA record for this transaction
      const existingCma = await storage.getCmaByTransaction(req.params.transactionId);
      if (existingCma) {
        await storage.updateCma(existingCma.id, {
          propertiesData: comparables,
        });
      }

      res.json({
        success: true,
        comparablesCount: comparables.length,
        comparables,
        appliedFilters: searchFilters,
      });
    } catch (error: any) {
      console.error("[CMA Refresh] Error:", error);
      res.status(500).json({ message: error.message || "Failed to refresh CMA comparables" });
    }
  });

  // Update CMA
  app.patch("/api/cmas/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateCma(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to update CMA" });
    }
  });

  // Generate or regenerate share link for CMA
  app.post("/api/cmas/:id/share", isAuthenticated, async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      
      // Generate a unique token
      const token = `cma_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Set expiration (default 30 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (req.body.expirationDays || 30));
      
      const updated = await storage.updateCma(req.params.id, {
        publicLink: token,
        expiresAt,
      });
      
      res.json({ publicLink: token, expiresAt });
    } catch (error) {
      res.status(500).json({ message: "Failed to generate share link" });
    }
  });

  // Delete CMA
  app.delete("/api/cmas/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteCma(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete CMA" });
    }
  });

  // Remove share link from CMA
  app.delete("/api/cmas/:id/share", isAuthenticated, async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      
      await storage.updateCma(req.params.id, {
        publicLink: null,
        expiresAt: null,
      });
      
      res.json({ message: "Share link removed" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove share link" });
    }
  });

  // Get CMA statistics
  app.get("/api/cmas/:id/statistics", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      
      // Calculate statistics from propertiesData
      const properties = (cma.propertiesData || []) as any[];
      if (properties.length === 0) {
        return res.json({
          price: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          pricePerSqFt: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          daysOnMarket: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          livingArea: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          lotSize: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          acres: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          bedrooms: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          bathrooms: { range: { min: 0, max: 0 }, average: 0, median: 0 },
          yearBuilt: { range: { min: 0, max: 0 }, average: 0, median: 0 },
        });
      }
      
      const calcStats = (values: number[]) => {
        const filtered = values.filter(v => v != null && !isNaN(v));
        if (filtered.length === 0) return { range: { min: 0, max: 0 }, average: 0, median: 0 };
        const sorted = [...filtered].sort((a, b) => a - b);
        const sum = filtered.reduce((a, b) => a + b, 0);
        const avg = sum / filtered.length;
        const mid = Math.floor(sorted.length / 2);
        const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        return { range: { min: sorted[0], max: sorted[sorted.length - 1] }, average: Math.round(avg), median: Math.round(median) };
      };
      
      const prices = properties.map(p => {
        const isClosed = p.standardStatus === 'Closed';
        return isClosed && p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0);
      }).filter(p => p > 0);
      const sqfts = properties.map(p => Number(p.livingArea || 0)).filter(s => s > 0);
      const pricePerSqft = properties
        .filter(p => p.livingArea && Number(p.livingArea) > 0)
        .map(p => {
          const isClosed = p.standardStatus === 'Closed';
          const price = isClosed && p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0);
          const sqft = Number(p.livingArea);
          return sqft > 0 ? price / sqft : 0;
        }).filter(v => v > 0 && !isNaN(v));
      const doms = properties.map(p => Number(p.daysOnMarket || p.simpleDaysOnMarket || 0)).filter(d => d > 0);
      const beds = properties.map(p => Number(p.bedroomsTotal || 0)).filter(b => b > 0);
      const baths = properties.map(p => Number(p.bathroomsTotalInteger || 0)).filter(b => b > 0);
      const years = properties.map(p => Number(p.yearBuilt || 0)).filter(y => y > 0);
      const lots = properties.map(p => Number(p.lotSizeSquareFeet || 0)).filter(l => l > 0);
      const acres = properties.map(p => Number(p.lotSizeAcres || (p.lotSizeSquareFeet ? p.lotSizeSquareFeet / 43560 : 0))).filter(a => a > 0);
      
      res.json({
        price: calcStats(prices),
        pricePerSqFt: calcStats(pricePerSqft),
        daysOnMarket: calcStats(doms),
        livingArea: calcStats(sqfts),
        lotSize: calcStats(lots),
        acres: calcStats(acres),
        bedrooms: calcStats(beds),
        bathrooms: calcStats(baths),
        yearBuilt: calcStats(years),
      });
    } catch (error) {
      console.error("CMA statistics error:", error);
      res.status(500).json({ message: "Failed to calculate CMA statistics" });
    }
  });

  // Get CMA timeline data
  app.get("/api/cmas/:id/timeline", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      
      const properties = (cma.propertiesData || []) as any[];
      const timeline = properties
        .filter(p => p.listDate || p.closeDate)
        .map(p => {
          const isClosed = p.standardStatus === 'Closed';
          return {
            date: isClosed && p.closeDate ? p.closeDate : p.listDate,
            price: isClosed && p.closePrice ? Number(p.closePrice) : Number(p.listPrice || 0),
            status: p.standardStatus || 'Active',
            propertyId: p.id || p.mlsNumber || '',
            address: p.unparsedAddress || '',
            daysOnMarket: p.daysOnMarket || p.simpleDaysOnMarket || null,
            cumulativeDaysOnMarket: p.cumulativeDaysOnMarket || null,
          };
        })
        .filter(t => t.date)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ message: "Failed to get CMA timeline" });
    }
  });

  // Get CMA report config
  app.get("/api/cmas/:id/report-config", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.getCmaReportConfig(req.params.id);
      res.json(config || {
        cmaId: req.params.id,
        includedSections: ['cover_page', 'cover_letter', 'map_all_listings', 'summary_comparables', 'property_details', 'price_per_sqft', 'comparable_stats'],
        sectionOrder: null,
        layout: 'two_photos',
        template: 'default',
        theme: 'spyglass',
        photoLayout: 'first_dozen',
        mapStyle: 'streets',
        showMapPolygon: true,
        includeAgentFooter: true,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get CMA report config" });
    }
  });

  // Update CMA report config
  app.put("/api/cmas/:id/report-config", isAuthenticated, async (req, res) => {
    try {
      const config = await storage.upsertCmaReportConfig({
        ...req.body,
        cmaId: req.params.id,
      });
      res.json(config);
    } catch (error) {
      res.status(500).json({ message: "Failed to update CMA report config" });
    }
  });

  // Get CMA adjustments
  app.get("/api/cmas/:id/adjustments", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      
      res.json(cma.adjustments || {
        rates: {
          sqftPerUnit: 50,
          bedroomValue: 10000,
          bathroomValue: 7500,
          poolValue: 25000,
          garagePerSpace: 5000,
          yearBuiltPerYear: 1000,
          lotSizePerSqft: 2,
        },
        compAdjustments: {},
        enabled: false,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get CMA adjustments" });
    }
  });

  // Update CMA adjustments
  app.put("/api/cmas/:id/adjustments", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateCma(req.params.id, {
        adjustments: req.body,
      });
      if (!updated) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json(updated.adjustments);
    } catch (error) {
      res.status(500).json({ message: "Failed to update CMA adjustments" });
    }
  });

  // Get CMA brochure
  app.get("/api/cmas/:id/brochure", async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json(cma.brochure || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to get CMA brochure" });
    }
  });

  // Delete CMA brochure
  app.delete("/api/cmas/:id/brochure", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateCma(req.params.id, {
        brochure: null,
      });
      if (!updated) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json({ message: "Brochure deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete CMA brochure" });
    }
  });

  // Save CMA brochure
  app.post("/api/cmas/:id/brochure", isAuthenticated, async (req, res) => {
    try {
      const { url, filename, type, generated } = req.body;
      const brochure = { url, filename, type, generated, uploadedAt: new Date().toISOString() };
      
      const updated = await storage.updateCma(req.params.id, { brochure });
      if (!updated) {
        return res.status(404).json({ message: "CMA not found" });
      }
      res.json(brochure);
    } catch (error) {
      res.status(500).json({ message: "Failed to save CMA brochure" });
    }
  });

  // Generate AI cover letter for CMA
  app.post("/api/ai/generate-cover-letter", isAuthenticated, async (req, res) => {
    try {
      const { context, tone } = req.body;
      
      const systemPrompt = `You are a professional real estate agent writing a cover letter for a Comparative Market Analysis (CMA) report. 
Write a personalized, compelling cover letter based on the provided property and market data.
The tone should be ${tone || 'professional'}.
Keep it concise (2-3 paragraphs) but impactful.
Include specific data points from the analysis to demonstrate expertise.
End with a clear call to action.`;

      const userPrompt = `Write a CMA cover letter with this context:
${context.clientName ? `Client: ${context.clientName}` : 'General client'}
${context.agentInfo?.name ? `Agent: ${context.agentInfo.name}` : ''}
${context.agentInfo?.brokerage ? `Brokerage: ${context.agentInfo.brokerage}` : ''}

Subject Property: ${context.subjectProperty?.address || 'Not specified'}
${context.subjectProperty?.price ? `List Price: $${context.subjectProperty.price.toLocaleString()}` : ''}
${context.subjectProperty?.beds ? `Beds: ${context.subjectProperty.beds}` : ''} ${context.subjectProperty?.baths ? `Baths: ${context.subjectProperty.baths}` : ''} ${context.subjectProperty?.sqft ? `Sq Ft: ${context.subjectProperty.sqft.toLocaleString()}` : ''}

Market Analysis:
- ${context.comparables?.count || 0} comparable properties analyzed
${context.comparables?.avgPrice ? `- Average price: $${context.comparables.avgPrice.toLocaleString()}` : ''}
${context.comparables?.medianPrice ? `- Median price: $${context.comparables.medianPrice.toLocaleString()}` : ''}
${context.comparables?.avgPricePerSqft ? `- Avg price/sqft: $${context.comparables.avgPricePerSqft.toFixed(0)}` : ''}
${context.marketStats?.avgDOM ? `- Average days on market: ${context.marketStats.avgDOM}` : ''}`;

      const openai = (await import('openai')).default;
      const client = new openai();
      
      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800,
      });

      const coverLetter = completion.choices[0]?.message?.content || '';
      res.json({ coverLetter });
    } catch (error: any) {
      console.error("AI cover letter generation error:", error);
      res.status(500).json({ message: error.message || "Failed to generate cover letter" });
    }
  });

  // Export CMA as PDF (stub - returns placeholder for now)
  app.post("/api/cmas/:id/export-pdf", isAuthenticated, async (req, res) => {
    try {
      const cma = await storage.getCma(req.params.id);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found" });
      }

      res.status(501).json({ 
        message: "PDF export is handled client-side using @react-pdf/renderer",
        note: "Use the client-side PDF generation for full presentation export"
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to export PDF" });
    }
  });

  // CMA Report Sections constant
  app.get("/api/cma/report-sections", async (req, res) => {
    res.json([
      { id: 'cover_page', name: 'Cover Page', category: 'introduction', defaultEnabled: true },
      { id: 'cover_letter', name: 'Cover Letter', category: 'introduction', defaultEnabled: true, editable: true },
      { id: 'listing_brochure', name: 'Listing Brochure', category: 'introduction', defaultEnabled: false },
      { id: 'agent_resume', name: 'Agent Resume', category: 'introduction', defaultEnabled: false, editable: true },
      { id: 'our_company', name: 'Our Company', category: 'introduction', defaultEnabled: false },
      { id: 'what_is_cma', name: 'What is a CMA?', category: 'introduction', defaultEnabled: false },
      { id: 'contact_me', name: 'Contact Me', category: 'introduction', defaultEnabled: true },
      { id: 'map_all_listings', name: 'Map of All Listings', category: 'listings', defaultEnabled: true },
      { id: 'summary_comparables', name: 'Summary of Comparable Properties', category: 'listings', defaultEnabled: true },
      { id: 'listings_header', name: 'Listings Chapter Header', category: 'listings', defaultEnabled: false },
      { id: 'property_details', name: 'Property Details', category: 'listings', defaultEnabled: true },
      { id: 'property_photos', name: 'Property Photos', category: 'listings', defaultEnabled: true },
      { id: 'adjustments', name: 'Adjustments', category: 'listings', defaultEnabled: false },
      { id: 'analysis_header', name: 'Analysis Chapter Header', category: 'analysis', defaultEnabled: false },
      { id: 'online_valuation', name: 'Online Valuation Analysis', category: 'analysis', defaultEnabled: false },
      { id: 'price_per_sqft', name: 'Average Price Per Sq. Ft.', category: 'analysis', defaultEnabled: true },
      { id: 'comparable_stats', name: 'Comparable Property Statistics', category: 'analysis', defaultEnabled: true },
    ]);
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

  // ============ MLS Sync Status ============

  app.get("/api/mls-sync/status", isAuthenticated, async (req, res) => {
    try {
      const status = getSyncStatus();
      const repliersSetting = await storage.getIntegrationSetting("repliers");
      
      res.json({
        ...status,
        lastSyncStats: repliersSetting?.metadata ? (repliersSetting.metadata as any).lastSyncStats : null,
        isConfigured: !!process.env.REPLIERS_API_KEY,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get sync status" });
    }
  });

  app.post("/api/mls-sync/trigger", isAuthenticated, async (req, res) => {
    try {
      await triggerManualSync();
      res.json({ success: true, message: "MLS sync triggered" });
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to trigger sync" });
    }
  });

  // ============ Smart Photo Selection for Flyers ============
  // Uses Image Insights to select best exterior, kitchen, and living room photos
  app.get("/api/listings/:mlsNumber/best-photos", isAuthenticated, async (req, res) => {
    try {
      const count = parseInt(req.query.count as string) || 3;
      const result = await getBestPhotosForFlyer(req.params.mlsNumber, count);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message || "Failed to get best photos" });
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
            
            // Set up Gmail watch on this label to receive push notifications
            const watchResult = await watchUserMailbox(user.email, [gmailResult.labelId]);
            if (watchResult) {
              console.log(`Gmail watch set up for ${user.email}, historyId: ${watchResult.historyId}`);
            }
            
            await storage.createActivity({
              transactionId: txn.id,
              type: "filter_created",
              description: `Gmail filter created for "${txn.propertyAddress}" after ${user.email} enabled email filtering`,
              category: "communication",
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

  // ============ Mapbox Token ============
  // Returns the Mapbox token for the property map
  app.get("/api/mapbox-token", isAuthenticated, (req, res) => {
    const token = process.env.MAPBOX_TOKEN;
    if (!token) {
      console.error('Mapbox token not found in environment');
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }
    res.json({ token });
  });

  // ============ Google Maps Embed ============
  // Returns a secure Maps Embed API URL for displaying property locations
  // The API key is kept server-side and only the embed URL is exposed
  
  app.get("/api/maps-embed", isAuthenticated, async (req, res) => {
    try {
      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(404).json({ message: "Google Maps API key not configured" });
      }
      
      const { address, lat, lng } = req.query;
      
      // Prefer coordinates if available, otherwise use address
      let embedUrl: string;
      if (lat && lng) {
        embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}&zoom=15`;
      } else if (address && typeof address === 'string') {
        embedUrl = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(address)}&zoom=15`;
      } else {
        return res.status(400).json({ message: "Address or coordinates required" });
      }
      
      res.json({ embedUrl });
    } catch (error) {
      console.error("Error generating maps embed:", error);
      res.status(500).json({ message: "Failed to generate map embed" });
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

  // Helper to extract street pattern from property address for matching
  // Removes street type suffixes (Ave, Street, etc.) for more flexible matching
  function getStreetPatternFromAddress(propertyAddress: string): { streetNumber: string; streetName: string } | null {
    const streetTypeSuffixes = /\s+(street|st|avenue|ave|drive|dr|road|rd|lane|ln|boulevard|blvd|way|circle|cir|court|ct|place|pl|terrace|ter|trail|trl|parkway|pkwy|highway|hwy)$/i;
    
    const addressParts = propertyAddress.match(/^(\d+)\s+(.+?)(?:,|$)/);
    if (!addressParts) return null;
    
    const streetNumber = addressParts[1];
    const fullStreetName = addressParts[2].trim();
    const streetName = fullStreetName.replace(streetTypeSuffixes, "").trim();
    
    return { streetNumber, streetName };
  }

  // Store processed message IDs to avoid duplicates (in production, use Redis/DB)
  const processedMessageIds = new Set<string>();

  app.post("/api/gmail/webhook", async (req, res) => {
    try {
      console.log("Gmail webhook received:", JSON.stringify(req.body).substring(0, 500));
      
      // Pub/Sub sends base64 encoded message data
      const message = req.body.message;
      if (!message?.data) {
        console.log("No message.data in webhook payload");
        return res.status(400).json({ message: "Invalid Pub/Sub message" });
      }

      // Decode the message
      const decoded = Buffer.from(message.data, "base64").toString("utf-8");
      const notification = JSON.parse(decoded);
      console.log("Decoded notification:", notification);
      
      // notification contains: { emailAddress, historyId }
      const userEmail = notification.emailAddress;
      const historyId = notification.historyId;
      
      if (!userEmail || !historyId) {
        console.log("Missing emailAddress or historyId in notification");
        return res.status(200).json({ message: "No email data in notification" });
      }

      console.log(`Processing Gmail notification for ${userEmail}, historyId: ${historyId}`);

      // Find transactions for this user that have Gmail labels
      const transactions = await storage.getTransactions();
      const userTransactions = transactions.filter(t => 
        t.userId && t.gmailLabelId && t.slackChannelId
      );
      
      console.log(`Found ${userTransactions.length} transactions with Gmail labels and Slack channels`);

      // For each transaction with a Gmail label, check for new messages
      for (const txn of userTransactions) {
        try {
          // Get the user who owns this transaction
          const owner = await authStorage.getUser(txn.userId!);
          if (owner?.email !== userEmail) continue;
          
          console.log(`Checking transaction ${txn.id} for ${txn.propertyAddress}`);
          
          const messages = await getNewMessages(userEmail, historyId, txn.gmailLabelId!);
          console.log(`Found ${messages.length} new messages for transaction ${txn.id}`);
          
          // Extract street pattern for subject line filtering
          const streetPattern = getStreetPatternFromAddress(txn.propertyAddress);
          
          for (const msg of messages) {
            // Skip if already processed
            if (processedMessageIds.has(msg.id)) {
              console.log(`Skipping already processed message ${msg.id}`);
              continue;
            }
            
            // Secondary filter: check if subject contains street number and street name
            if (streetPattern) {
              const subjectLower = msg.subject.toLowerCase();
              const hasStreetNumber = subjectLower.includes(streetPattern.streetNumber);
              const hasStreetName = subjectLower.includes(streetPattern.streetName.toLowerCase());
              
              if (!hasStreetNumber || !hasStreetName) {
                console.log(`Skipping email - subject "${msg.subject}" doesn't match "${streetPattern.streetNumber} ${streetPattern.streetName}"`);
                continue;
              }
            }
            
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
            console.log(`Posting email to Slack channel ${txn.slackChannelId}`);
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

  // Test endpoint to debug Repliers API access
  app.get("/api/test-repliers", async (req, res) => {
    try {
      console.log("Testing Repliers API access...");
      const result = await testRepliersAccess();
      res.json(result);
    } catch (error: any) {
      console.error("Repliers test error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Simple in-memory cache for image insights (5 minute TTL)
  const imageInsightsCache = new Map<string, { data: any; timestamp: number }>();
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  // Get image insights for a listing from Repliers API
  app.get("/api/repliers/listing/:listingId/image-insights", async (req, res) => {
    try {
      const { listingId } = req.params;
      const apiKey = process.env.REPLIERS_API_KEY;
      
      if (!apiKey) {
        console.error('REPLIERS_API_KEY not configured');
        return res.status(500).json({ 
          available: false,
          error: 'API key not configured',
          images: [],
        });
      }
      
      // Check cache first
      const cached = imageInsightsCache.get(listingId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return res.json(cached.data);
      }

      console.log(`Fetching image insights for listing: ${listingId}`);

      // Fetch listing with imageInsights from Repliers
      const response = await fetch(
        `https://api.repliers.io/listings/${listingId}`,
        {
          method: 'GET',
          headers: {
            'REPLIERS-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Repliers API error:', response.status, errorText);
        return res.status(response.status).json({
          available: false,
          error: `Repliers API error: ${response.status}`,
          images: [],
        });
      }
      
      const data = await response.json();
      
      // Helper to ensure URLs are full CDN URLs
      const REPLIERS_CDN_BASE = "https://cdn.repliers.io/";
      const ensureFullUrl = (url: string | undefined): string => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return `${REPLIERS_CDN_BASE}${url}`;
      };
      
      // Check if Image Insights is available in the response
      if (data.imageInsights?.images && data.imageInsights.images.length > 0) {
        console.log(`Image Insights available: ${data.imageInsights.images.length} images analyzed`);
        
        const photos = data.photos || data.images || [];
        
        const result = {
          available: true,
          images: data.imageInsights.images.map((insight: any, index: number) => ({
            url: ensureFullUrl(photos[index] || insight.url),
            originalIndex: index,
            classification: {
              imageOf: insight.classification?.imageOf || null,
              prediction: insight.classification?.prediction || null,
              confidence: insight.classification?.confidence || null,
            },
            quality: {
              score: insight.quality?.score || null,
              qualitative: insight.quality?.qualitative || null,
            },
          })),
        };
        
        // Cache successful result
        imageInsightsCache.set(listingId, { data: result, timestamp: Date.now() });
        
        return res.json(result);
      }
      
      // Fallback: Image Insights not enabled or no data - return photos without insights
      console.log('Image Insights not available for this listing, returning basic photos');
      const photos = data.photos || data.images || [];
      const fallbackResult = {
        available: false,
        message: 'Image Insights not enabled on this account',
        images: photos.map((url: string, index: number) => ({
          url: ensureFullUrl(url),
          originalIndex: index,
          classification: null,
          quality: null,
        })),
      };
      
      // Cache fallback result too
      imageInsightsCache.set(listingId, { data: fallbackResult, timestamp: Date.now() });
      
      return res.json(fallbackResult);
      
    } catch (error: any) {
      console.error('Image insights fetch error:', error);
      return res.status(500).json({ 
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        images: [],
      });
    }
  });

  // Debug endpoint to test Repliers Image Insights
  app.get('/api/debug/repliers-insights-check', async (req, res) => {
    try {
      const apiKey = process.env.REPLIERS_API_KEY;
      
      if (!apiKey) {
        return res.json({ 
          status: 'error', 
          message: 'REPLIERS_API_KEY not set in environment' 
        });
      }
      
      const testListingId = req.query.listingId || 'ACT2572987';
      
      const response = await fetch(
        `https://api.repliers.io/listings/${testListingId}`,
        {
          headers: {
            'REPLIERS-API-KEY': apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      
      const data = await response.json();
      
      return res.json({
        status: 'success',
        listingId: testListingId,
        hasImageInsights: !!data.imageInsights?.images,
        imageInsightsCount: data.imageInsights?.images?.length || 0,
        photosCount: data.photos?.length || 0,
        sampleInsight: data.imageInsights?.images?.[0] || null,
        rawFields: Object.keys(data),
      });
      
    } catch (error) {
      return res.json({ 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ============ AI Description Summarization ============
  
  // Helper to clean up AI-generated summaries and ensure complete sentences
  function cleanupSummary(text: string, maxLength: number): string {
    let cleaned = text.trim();
    
    // Remove any quotes the AI might have added
    cleaned = cleaned.replace(/^["']|["']$/g, "");
    
    // Remove trailing "..." or "…" if present - CRITICAL to avoid truncated feel
    while (cleaned.endsWith('...') || cleaned.endsWith('…')) {
      cleaned = cleaned.replace(/\.{3}$|…$/, '').trim();
    }
    
    // Remove trailing incomplete phrases (common AI truncation patterns)
    cleaned = cleaned.replace(/\s+(and|or|with|in|at|for|to|the|a|an|is|are|has|have|this|that)\s*\.?$/i, '.');
    
    // If still over limit, truncate at last complete sentence
    if (cleaned.length > maxLength) {
      const truncated = cleaned.substring(0, maxLength);
      const lastPeriod = truncated.lastIndexOf('.');
      const lastExclaim = truncated.lastIndexOf('!');
      const lastQuestion = truncated.lastIndexOf('?');
      const lastSentenceEnd = Math.max(lastPeriod, lastExclaim, lastQuestion);
      
      if (lastSentenceEnd > maxLength * 0.4) {
        // Use last complete sentence if it's reasonably long
        cleaned = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        // Otherwise truncate at last space and add period
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > 0) {
          cleaned = truncated.substring(0, lastSpace);
          // Remove trailing punctuation/incomplete words before adding period
          cleaned = cleaned.replace(/[,;:\-\s]+$/, '');
          // Also remove trailing incomplete words (articles, prepositions)
          cleaned = cleaned.replace(/\s+(and|or|with|in|at|for|to|the|a|an|is|are|has|have|this|that)$/i, '');
          cleaned += '.';
        } else {
          cleaned = truncated;
        }
      }
    }
    
    // Ensure ends with proper punctuation (never "...")
    cleaned = cleaned.replace(/\.{2,}$/, '.');
    if (!/[.!?]$/.test(cleaned)) {
      cleaned += '.';
    }
    
    // Final check: if still ends with "..." somehow, fix it
    if (cleaned.endsWith('...')) {
      cleaned = cleaned.slice(0, -3) + '.';
    }
    
    return cleaned;
  }
  
  app.post("/api/summarize-description", isAuthenticated, async (req, res) => {
    try {
      const { description, maxLength = 150, propertyInfo } = req.body;
      
      if (!description || description.trim().length === 0) {
        return res.status(400).json({ error: "Description is required" });
      }

      // If already short enough, return as-is
      if (description.length <= maxLength) {
        return res.json({ summary: description });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `You are a real estate copywriter. Write a compelling property description summary.

CRITICAL REQUIREMENTS:
- Maximum ${maxLength} characters (strict limit - count carefully!)
- Must be a COMPLETE thought - end with a full sentence
- Do NOT end mid-sentence or with "..."
- Do NOT write more than the limit and truncate
- The summary should feel finished and polished

STYLE:
- Engaging and professional
- Highlight key selling points
- Focus on: location, features, lifestyle benefits
- Do not repeat beds/baths/sqft (shown separately)

Property: ${propertyInfo?.address || "N/A"}

Original description:
${description}

Write a summary that is UNDER ${maxLength} characters and ends with a complete sentence.
Count your characters carefully before responding.
Return only the summary text, nothing else.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a real estate copywriter. Always write complete sentences. Never end with '...' or mid-thought. Count characters carefully." },
          { role: "user", content: prompt }
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      let summary = response.choices[0]?.message?.content?.trim() || "";
      
      // Post-process to ensure complete sentences and proper length
      summary = cleanupSummary(summary, maxLength);

      res.json({ summary });
    } catch (error: any) {
      console.error("AI summarization error:", error);
      
      // Fallback: truncate at sentence boundary
      const { description, maxLength = 150 } = req.body;
      if (description) {
        const fallback = cleanupSummary(description, maxLength);
        return res.json({ summary: fallback, fallback: true });
      }
      
      res.status(500).json({ error: "Failed to summarize description" });
    }
  });

  // ============ Professional Social Media Tagline Generation ============
  app.post("/api/generate-social-tagline", isAuthenticated, async (req, res) => {
    try {
      const { transactionId } = req.body;
      
      if (!transactionId) {
        return res.status(400).json({ error: "Transaction ID is required" });
      }

      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const mlsData = transaction.mlsData as any;
      
      // Extract property details
      const beds = mlsData?.beds || mlsData?.bedrooms || "";
      const baths = mlsData?.baths || mlsData?.bathrooms || "";
      const sqft = mlsData?.sqft || mlsData?.squareFeet || "";
      const yearBuilt = mlsData?.yearBuilt || "";
      const propertyType = mlsData?.propertyType || mlsData?.type || "Single Family";
      const style = mlsData?.style || "";
      const price = transaction.salePrice || transaction.listPrice || mlsData?.listPrice || "";
      const description = mlsData?.description || transaction.notes || "";

      // Extract photo highlights from Image Insights if available
      const imageInsights = mlsData?.imageInsights || mlsData?.images;
      let featuredRooms: string[] = [];
      
      if (imageInsights && Array.isArray(imageInsights)) {
        // Get unique room types from high-quality images
        featuredRooms = imageInsights
          .filter((img: any) => 
            img.quality?.qualitative === 'excellent' || 
            img.quality?.qualitative === 'above average' ||
            img.classification?.imageOf
          )
          .map((img: any) => img.classification?.imageOf)
          .filter((room: any): room is string => Boolean(room))
          .slice(0, 5);
        
        // Remove duplicates
        featuredRooms = Array.from(new Set(featuredRooms));
      }

      // Build property context
      const propertyContext = [
        beds ? `${beds} bed` : "",
        baths ? `${baths} bath` : "",
        sqft ? `${sqft} sq ft` : "",
      ].filter(Boolean).join(", ");

      const featuredRoomsText = featuredRooms.length > 0 
        ? `\nStandout Features (from photos):\n${featuredRooms.map(room => `- ${room}`).join('\n')}`
        : "";

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `You are a professional real estate broker writing a short, punchy social media tagline for a property listing.

Property Details:
- ${propertyContext}
${yearBuilt ? `- Built: ${yearBuilt}` : ""}
${style ? `- Style: ${style}` : `- Type: ${propertyType}`}
${price ? `- Price: $${Number(price).toLocaleString()}` : ""}
${featuredRoomsText}

MLS Description Excerpt:
"${description?.slice(0, 500) || "N/A"}"

Write a compelling 50-70 character tagline that:
1. Highlights 1-2 KEY selling points
2. Uses professional real estate language
3. Creates urgency or excitement
4. Avoids generic words like "beautiful", "nice", "great", "amazing"
5. Sounds like a broker, NOT like AI

PROFESSIONAL LANGUAGE GUIDE:
- Big kitchen → "Chef's Kitchen" or "Gourmet Kitchen"
- Nice backyard → "Private Retreat" or "Entertainer's Yard"
- Updated → "Fully Renovated" or "Turnkey"
- Good location → "Prime Location" or "Sought-After Area"
- Nice views → "Panoramic Views" or "Sunset Views"
- Open layout → "Open Concept" or "Flowing Floor Plan"
- Pool → "Resort-Style Pool" or "Sparkling Pool"
- New → "Move-In Ready" or "Like New"

GOOD EXAMPLES:
- "Stunning 4BR with Chef's Kitchen & Pool"
- "Move-In Ready in Top-Rated School Zone"
- "Modern Updates, Huge Lot, Prime Location"
- "Open Concept Living with Sunset Views"
- "Elegant Single-Story on Tree-Lined Lot"

BAD EXAMPLES (AVOID):
- "Beautiful home for sale" (too generic)
- "Amazing property awaits!" (too salesy)
- "Don't miss this gem!" (cliché)
- "Your dream home!" (overused)

Return ONLY the tagline, no quotes, no explanation, 50-70 characters max.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a professional real estate broker. Write punchy, professional taglines. Never use generic words like beautiful, nice, great, amazing. Never use clichés. Sound like a broker, not like AI. Max 70 characters." },
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      let tagline = response.choices[0]?.message?.content?.trim() || "";
      
      // Remove any surrounding quotes
      tagline = tagline.replace(/^["']|["']$/g, '');
      
      // Ensure it's within 80 characters
      if (tagline.length > 80) {
        tagline = tagline.slice(0, 80).trim();
      }

      res.json({ tagline });
    } catch (error: any) {
      console.error("Social tagline generation error:", error);
      res.status(500).json({ error: "Failed to generate tagline" });
    }
  });

  // ============ HTML/Puppeteer Flyer Generation ============
  app.post("/api/generate-flyer-html", isAuthenticated, async (req, res) => {
    try {
      const {
        status,
        price,
        address,
        photos,
        beds,
        baths,
        sqft,
        headline,
        description,
        agentName,
        agentTitle,
        agentPhone,
        agentPhoto,
        openHouseDate,
        openHouseTime,
        mlsNumber
      } = req.body;
      
      // Validate required fields
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      if (!agentName) {
        return res.status(400).json({ error: "Agent name is required" });
      }
      if (!agentPhone) {
        return res.status(400).json({ error: "Agent phone is required" });
      }
      if (!photos || photos.length === 0) {
        return res.status(400).json({ error: "At least one photo is required" });
      }
      
      const statusLabels: Record<string, string> = {
        'just_listed': 'JUST LISTED',
        'for_sale': '',
        'open_house': 'OPEN HOUSE',
        'price_improvement': 'PRICE REDUCED',
        'under_contract': 'UNDER CONTRACT',
        'just_sold': 'JUST SOLD',
        'for_lease': 'FOR LEASE',
        'listed': ''
      };
      
      const getStatusColorClass = (s: string): string => {
        const sl = (s || '').toLowerCase();
        if (sl.includes('sold')) return 'status-red';
        if (sl.includes('contract') || sl.includes('pending')) return 'status-orange';
        if (sl.includes('reduced')) return 'status-purple';
        if (sl.includes('open')) return 'status-green';
        if (sl === 'just_listed') return 'status-blue';
        return '';
      };
      
      const getPriceLabel = (s: string) => {
        const sl = (s || '').toLowerCase();
        if (sl.includes('sold')) return 'SOLD FOR';
        if (sl.includes('contract') || sl.includes('pending')) return 'PENDING AT';
        if (sl.includes('reduced')) return 'NOW ONLY';
        return 'LISTED AT';
      };
      
      // Clean price - remove $ and commas, then parse
      const cleanPrice = String(price || '0').replace(/[$,]/g, '');
      const numericPrice = parseFloat(cleanPrice) || 0;
      
      // Generate listing URL for QR code
      const listingUrl = mlsNumber ? `https://spyglassrealty.com/listing/${mlsNumber}` : undefined;
      
      const flyerData: FlyerData = {
        priceLabel: getPriceLabel(status),
        price: `$${numericPrice.toLocaleString()}`,
        fullAddress: formatAddressForFlyer(address),
        mainImage: photos[0],
        secondaryImage1: photos[1],
        secondaryImage2: photos[2],
        bedrooms: String(beds || 0),
        bathrooms: String(baths || 0),
        sqft: Number(sqft || 0).toLocaleString(),
        headline: headline?.toUpperCase() || '',
        description: description || '',
        openHouseDate: openHouseDate || '',
        openHouseTime: openHouseTime || '',
        agentName: agentName,
        agentTitle: agentTitle || 'REALTOR®',
        agentPhone: agentPhone,
        agentPhoto: agentPhoto,
        listingUrl: listingUrl,
        statusBadge: statusLabels[status] || undefined,
        statusColorClass: getStatusColorClass(status)
      };
      
      // Support both PNG preview and PDF download
      const outputType: OutputType = req.body.outputType === 'pdf' ? 'pdf' : 'pngPreview';
      
      console.log(`Generating ${outputType} flyer for:`, address);
      const buffer = await generatePrintFlyer(flyerData, outputType);
      
      // Create filename from address
      const addressSlug = address.split(',')[0].replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      
      if (outputType === 'pdf') {
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="${addressSlug}_flyer.pdf"`);
      } else {
        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `attachment; filename="${addressSlug}_flyer.png"`);
      }
      res.send(buffer);
      
    } catch (error: any) {
      console.error('Flyer generation error:', error);
      res.status(500).json({ error: 'Failed to generate flyer', details: error.message });
    }
  });

  // ============ Unified Flyer Render (PNG Preview or PDF) ============
  // This endpoint is the single source of truth for flyer rendering
  // Both preview and download use the SAME Puppeteer-rendered output
  app.post("/api/flyer/render", isAuthenticated, async (req, res) => {
    try {
      const {
        status,
        price,
        address,
        photos,
        beds,
        baths,
        sqft,
        headline,
        description,
        agentName,
        agentTitle,
        agentPhone,
        agentPhoto,
        openHouseDate,
        openHouseTime,
        mlsNumber,
        outputType = 'pngPreview'
      } = req.body;
      
      // Validate required fields
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }
      if (!agentName) {
        return res.status(400).json({ error: "Agent name is required" });
      }
      if (!agentPhone) {
        return res.status(400).json({ error: "Agent phone is required" });
      }
      if (!photos || photos.length === 0) {
        return res.status(400).json({ error: "At least one photo is required" });
      }
      
      const statusLabels: Record<string, string> = {
        'just_listed': 'JUST LISTED',
        'for_sale': '',
        'open_house': 'OPEN HOUSE',
        'price_improvement': 'PRICE REDUCED',
        'under_contract': 'UNDER CONTRACT',
        'just_sold': 'JUST SOLD',
        'for_lease': 'FOR LEASE',
        'listed': ''
      };
      
      const getStatusColorClass = (s: string): string => {
        const sl = (s || '').toLowerCase();
        if (sl.includes('sold')) return 'status-red';
        if (sl.includes('contract') || sl.includes('pending')) return 'status-orange';
        if (sl.includes('reduced')) return 'status-purple';
        if (sl.includes('open')) return 'status-green';
        if (sl === 'just_listed') return 'status-blue';
        return '';
      };
      
      const getPriceLabel = (s: string) => {
        const sl = (s || '').toLowerCase();
        if (sl.includes('sold')) return 'SOLD FOR';
        if (sl.includes('contract') || sl.includes('pending')) return 'PENDING AT';
        if (sl.includes('reduced')) return 'NOW ONLY';
        return 'LISTED AT';
      };
      
      const cleanPrice = String(price || '0').replace(/[$,]/g, '');
      const numericPrice = parseFloat(cleanPrice) || 0;
      
      // Generate listing URL for QR code
      const listingUrl = mlsNumber ? `https://spyglassrealty.com/listing/${mlsNumber}` : undefined;
      
      const flyerData: FlyerData = {
        priceLabel: getPriceLabel(status),
        price: `$${numericPrice.toLocaleString()}`,
        fullAddress: formatAddressForFlyer(address),
        mainImage: photos[0],
        secondaryImage1: photos[1],
        secondaryImage2: photos[2],
        bedrooms: String(beds || 0),
        bathrooms: String(baths || 0),
        sqft: Number(sqft || 0).toLocaleString(),
        headline: headline?.toUpperCase() || '',
        description: description || '',
        openHouseDate: openHouseDate || '',
        openHouseTime: openHouseTime || '',
        agentName: agentName,
        agentTitle: agentTitle || 'REALTOR®',
        agentPhone: agentPhone,
        agentPhoto: agentPhoto,
        listingUrl: listingUrl,
        statusBadge: statusLabels[status] || undefined,
        statusColorClass: getStatusColorClass(status)
      };
      
      const validOutputType: OutputType = outputType === 'pdf' ? 'pdf' : 'pngPreview';
      console.log(`Unified flyer render: ${validOutputType} for ${address}`);
      
      const buffer = await generatePrintFlyer(flyerData, validOutputType);
      
      const addressSlug = address.split(',')[0].replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      
      if (validOutputType === 'pdf') {
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="${addressSlug}_flyer.pdf"`);
      } else {
        res.set('Content-Type', 'image/png');
        // For preview, don't set as attachment so it can be displayed
        res.set('Content-Disposition', `inline; filename="${addressSlug}_flyer.png"`);
      }
      res.send(buffer);
      
    } catch (error: any) {
      console.error('Unified flyer render error:', error);
      res.status(500).json({ error: 'Failed to render flyer', details: error.message });
    }
  });

  // ============ Social Media Graphics Render ============
  app.post("/api/graphics/render", isAuthenticated, async (req, res) => {
    try {
      const {
        format,
        photoUrl,
        status,
        description,
        address,
        price,
        beds,
        baths,
        sqft,
        brokerageLogo,
      } = req.body;

      if (!format || !['square', 'story', 'landscape'].includes(format)) {
        return res.status(400).json({ error: "Invalid format. Must be: square, story, or landscape" });
      }
      if (!photoUrl) {
        return res.status(400).json({ error: "Photo URL is required" });
      }
      if (!address) {
        return res.status(400).json({ error: "Address is required" });
      }

      const logoPath = brokerageLogo || path.join(process.cwd(), 'public', 'assets', 'SpyglassRealty_Logo_Black.png');

      const cleanPrice = String(price || '0').replace(/[$,]/g, '');
      const numericPrice = parseFloat(cleanPrice) || 0;

      const graphicsData: GraphicsData = {
        photoUrl,
        status: status || 'Just Listed',
        description: description || '',
        address,
        price: numericPrice.toLocaleString(),
        beds: String(beds || 0),
        baths: String(baths || 0),
        sqft: Number(sqft || 0).toLocaleString(),
        brokerageLogo: logoPath,
      };

      console.log(`Graphics render: ${format} for ${address}`);
      
      const buffer = await generateGraphic(graphicsData, format as GraphicsFormat);
      
      const addressSlug = address.split(',')[0].replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
      const formatLabels: Record<string, string> = {
        square: 'Instagram_Post',
        story: 'Instagram_Story',
        landscape: 'Facebook_Post'
      };
      
      res.set('Content-Type', 'image/png');
      res.set('Content-Disposition', `attachment; filename="${addressSlug}_${formatLabels[format]}.png"`);
      res.send(buffer);
      
    } catch (error: any) {
      console.error('Graphics render error:', error);
      res.status(500).json({ error: 'Failed to render graphic', details: error.message });
    }
  });

  // ============ AI Headline Generation ============
  app.post("/api/generate-headline", isAuthenticated, async (req, res) => {
    try {
      const { description, address, beds, baths, sqft, neighborhood, status, city } = req.body;
      
      if (!description || description.trim().length === 0) {
        return res.status(400).json({ error: "Description is required" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Status-specific prompts for contextually relevant headlines
      const statusPrompts: Record<string, string> = {
        'for_sale': `Generate a compelling headline for a home FOR SALE. Focus on features, lifestyle, or location appeal.
Examples: "YOUR DREAM HOME AWAITS", "STUNNING ${beds || 3}BR IN ${(city || 'AUSTIN').toUpperCase()}", "MOVE-IN READY GEM"`,
        
        'just_listed': `Generate an exciting headline for a NEWLY LISTED property. Emphasize newness and urgency.
Examples: "JUST LISTED IN ${(city || 'AUSTIN').toUpperCase()}", "NEW TO MARKET - DON'T MISS OUT", "FRESHLY LISTED GEM"`,
        
        'under_contract': `Generate a headline for a property UNDER CONTRACT. Highlight success or invite buyers to see similar properties.
Examples: "UNDER CONTRACT IN 3 DAYS", "PENDING - MORE COMING SOON", "ANOTHER SUCCESS IN ${(city || 'AUSTIN').toUpperCase()}"`,
        
        'just_sold': `Generate a CELEBRATORY headline for a property that JUST SOLD. Emphasize success, speed of sale, or congratulations.
Examples: "JUST SOLD!", "SOLD OVER ASKING", "ANOTHER ONE SOLD IN ${(city || 'AUSTIN').toUpperCase()}", "CONGRATS TO THE NEW OWNERS"`,
        
        'for_lease': `Generate a headline for a property available FOR LEASE/RENT. Focus on rental appeal.
Examples: "AVAILABLE FOR LEASE", "RENTAL OPPORTUNITY", "LEASE THIS STUNNING ${beds || 3}BR"`,
        
        'open_house': `Generate an INVITING headline for an OPEN HOUSE. Create urgency to attend.
Examples: "OPEN HOUSE THIS WEEKEND", "COME SEE US SATURDAY", "YOUR INVITATION TO TOUR"`,
        
        'price_improvement': `Generate a headline for a PRICE REDUCED property. Emphasize the new value opportunity.
Examples: "NEW PRICE - DON'T MISS OUT", "REDUCED AND READY", "BETTER VALUE THAN EVER"`,
        
        'listed': `Generate a compelling headline for a property listing. Focus on features or location.
Examples: "YOUR DREAM HOME AWAITS", "STUNNING HOME IN ${(city || 'AUSTIN').toUpperCase()}", "PRIME LOCATION"`
      };
      
      const statusPrompt = statusPrompts[status] || statusPrompts['for_sale'];

      const prompt = `You are a real estate marketing expert. Generate a catchy, compelling headline for a property listing flyer.

STATUS CONTEXT:
${statusPrompt}

Requirements:
- Maximum 39 characters (strict limit)
- ALL UPPERCASE
- Professional real estate broker style
- Match the tone to the status (celebratory for sold, urgent for just listed, inviting for open house)
- No exclamation marks
- Should grab attention and create interest

Property details:
Address: ${address || "N/A"}
City: ${city || "Austin"}
Beds: ${beds || "N/A"} | Baths: ${baths || "N/A"} | Sqft: ${sqft || "N/A"}
${neighborhood ? `Neighborhood: ${neighborhood}` : ""}

Description: ${description}

Generate ONE headline only. Return just the headline text, nothing else.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a real estate marketing expert. Return only the headline text, no quotes or explanation. Match the tone to the property status." },
          { role: "user", content: prompt }
        ],
        max_tokens: 60,
        temperature: 0.8, // Higher for more variation
      });

      let headline = response.choices[0]?.message?.content?.trim() || "";
      
      // Post-processing
      headline = headline.replace(/^["']|["']$/g, ""); // Remove quotes
      headline = headline.toUpperCase().trim();
      
      // Truncate at word boundary if needed
      if (headline.length > 39) {
        const words = headline.split(" ");
        let truncated = "";
        for (const word of words) {
          if ((truncated + " " + word).trim().length <= 39) {
            truncated = (truncated + " " + word).trim();
          } else {
            break;
          }
        }
        headline = truncated || headline.substring(0, 39);
      }

      res.json({ headline });
    } catch (error: any) {
      console.error("Error generating headline:", error);
      res.status(500).json({ error: "Failed to generate headline" });
    }
  });

  // ============ Notification Settings ============

  // Get notification settings for the current user
  // ALL DEFAULTS ARE FALSE - Users must opt-in to notifications
  app.get("/api/notification-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      const { transactionId } = req.query;
      const settings = await storage.getNotificationSettings(userId, transactionId as string | undefined);
      
      // Return default settings if none exist - ALL DEFAULTS ARE FALSE
      if (!settings) {
        res.json({
          userId,
          transactionId: transactionId || null,
          documentUploads: false,
          closingReminders: false,
          marketingAssets: false,
          reminder30Days: false,
          reminder14Days: false,
          reminder7Days: false,
          reminder3Days: false,
          reminder1Day: false,
          reminderDayOf: false,
        });
        return;
      }

      res.json(settings);
    } catch (error) {
      console.error("Error getting notification settings:", error);
      res.status(500).json({ message: "Failed to get notification settings" });
    }
  });

  // Update notification settings for the current user
  // When closingReminders is turned OFF, all reminder schedule options are also turned OFF
  app.put("/api/notification-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // If closingReminders is being turned OFF, turn off all reminder schedule options
      let updates = { ...req.body };
      if (req.body.closingReminders === false) {
        updates = {
          ...updates,
          reminder30Days: false,
          reminder14Days: false,
          reminder7Days: false,
          reminder3Days: false,
          reminder1Day: false,
          reminderDayOf: false,
        };
      }

      // Validate request body using Zod schema - ALL DEFAULTS ARE FALSE
      const validationResult = insertNotificationSettingsSchema.safeParse({
        userId,
        transactionId: updates.transactionId || null,
        documentUploads: updates.documentUploads ?? false,
        closingReminders: updates.closingReminders ?? false,
        marketingAssets: updates.marketingAssets ?? false,
        reminder30Days: updates.reminder30Days ?? false,
        reminder14Days: updates.reminder14Days ?? false,
        reminder7Days: updates.reminder7Days ?? false,
        reminder3Days: updates.reminder3Days ?? false,
        reminder1Day: updates.reminder1Day ?? false,
        reminderDayOf: updates.reminderDayOf ?? false,
      });

      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid notification settings", 
          errors: validationResult.error.errors 
        });
      }

      const settings = await storage.upsertNotificationSettings(validationResult.data);
      res.json(settings);
    } catch (error) {
      console.error("Error updating notification settings:", error);
      res.status(500).json({ message: "Failed to update notification settings" });
    }
  });

  // Force trigger closing reminders check (for testing)
  // Pass bypassDisable=true in body to test when notifications are globally disabled
  app.post("/api/notification-settings/check-reminders", isAuthenticated, async (req: any, res) => {
    try {
      const { triggerNotificationsNow } = await import("./cron/notificationCron");
      const bypassDisable = req.body?.bypassDisable === true;
      const result = await triggerNotificationsNow(bypassDisable);
      res.json({ message: "Reminder check triggered", ...result });
    } catch (error) {
      console.error("Error triggering reminder check:", error);
      res.status(500).json({ message: "Failed to trigger reminder check" });
    }
  });

  // Get notification system status
  app.get("/api/admin/notifications/status", isAuthenticated, async (req: any, res) => {
    try {
      const { getCronStatus } = await import("./cron/notificationCron");
      res.json(getCronStatus());
    } catch (error) {
      console.error("Error getting notification status:", error);
      res.status(500).json({ message: "Failed to get notification status" });
    }
  });

  // Test Slack notification
  app.post("/api/slack/test", isAuthenticated, async (req: any, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }
      const { sendTestNotification } = await import("./services/slackNotificationService");
      const result = await sendTestNotification(channelId);
      res.json(result);
    } catch (error) {
      console.error("Error sending test notification:", error);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // ============ Agent Profile ============

  // Get agent profile for the current user
  app.get("/api/agent/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await storage.getAgentProfile(userId);
      const user = await authStorage.getUser(userId);

      res.json({
        profile: profile || null,
        user: user ? {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          marketingPhone: user.marketingPhone,
          marketingEmail: user.marketingEmail,
          marketingDisplayName: user.marketingDisplayName,
          marketingTitle: user.marketingTitle,
          marketingHeadshotUrl: user.marketingHeadshotUrl,
        } : null,
      });
    } catch (error: any) {
      console.error("[Agent Profile] Error fetching:", error.message);
      res.status(500).json({ error: "Failed to fetch agent profile" });
    }
  });

  // Update agent profile for the current user
  app.put("/api/agent/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { updateAgentProfileSchema } = await import("@shared/schema");
      const profileData = updateAgentProfileSchema.partial().safeParse(req.body.profile || {});

      if (!profileData.success) {
        return res.status(400).json({ error: "Invalid profile data", details: profileData.error.issues });
      }

      const updatedProfile = await storage.updateAgentProfile(userId, profileData.data);

      // Update user marketing info if provided
      if (req.body.user) {
        await authStorage.upsertUser({
          id: userId,
          firstName: req.body.user.firstName,
          lastName: req.body.user.lastName,
          marketingPhone: req.body.user.marketingPhone,
          marketingEmail: req.body.user.marketingEmail,
          marketingDisplayName: req.body.user.marketingDisplayName,
          marketingTitle: req.body.user.marketingTitle,
        });
      }

      res.json({ success: true, profile: updatedProfile });
    } catch (error: any) {
      console.error("[Agent Profile] Error updating:", error.message);
      res.status(500).json({ error: "Failed to update agent profile" });
    }
  });

  // Generate default cover letter with AI
  app.post("/api/ai/generate-default-cover-letter", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { tone = 'professional', existingCoverLetter } = req.body;

      // Validate tone
      const validTones = ['professional', 'friendly', 'confident'];
      if (!validTones.includes(tone)) {
        return res.status(400).json({ error: "Tone must be professional, friendly, or confident" });
      }

      // Get agent data
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const agentProfile = await storage.getAgentProfile(userId);
      const agentName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Agent';

      // Determine if generating new or enhancing existing
      const isEnhancing = existingCoverLetter && existingCoverLetter.trim().length > 20;

      const toneDescriptions: Record<string, string> = {
        professional: 'professional, polished, and business-appropriate',
        friendly: 'warm, approachable, and personable while maintaining professionalism',
        confident: 'confident, authoritative, and compelling'
      };

      let systemPrompt: string;
      let userPrompt: string;

      if (isEnhancing) {
        systemPrompt = `You are an expert real estate marketing copywriter. Your task is to enhance and improve an existing cover letter for a CMA (Comparative Market Analysis) report. The tone should be ${toneDescriptions[tone]}.`;

        userPrompt = `Please enhance and improve this cover letter for ${agentName}${agentProfile?.title ? `, ${agentProfile.title}` : ''}${user.marketingTitle ? ` at ${user.marketingTitle}` : ''}:

EXISTING COVER LETTER:
${existingCoverLetter}

${agentProfile?.bio ? `AGENT BIO FOR CONTEXT:\n${agentProfile.bio}\n` : ''}

Please:
1. Improve the writing quality and flow
2. Make it more ${tone}
3. Keep it concise (2-3 paragraphs)
4. Use [Client Name] as placeholder for the client's name
5. Maintain focus on CMA value proposition

Return ONLY the improved cover letter text, no additional commentary.`;
      } else {
        systemPrompt = `You are an expert real estate marketing copywriter. Create a compelling cover letter template for CMA (Comparative Market Analysis) reports. The tone should be ${toneDescriptions[tone]}.`;

        userPrompt = `Create a cover letter template for ${agentName}${agentProfile?.title ? `, ${agentProfile.title}` : ''}${user.marketingTitle ? ` at ${user.marketingTitle}` : ''}.

${agentProfile?.bio ? `AGENT BIO:\n${agentProfile.bio}\n` : ''}

Requirements:
1. Start with "Dear [Client Name],"
2. 2-3 paragraphs maximum
3. Explain the value of the CMA
4. ${tone === 'professional' ? 'Maintain formal business tone' : tone === 'friendly' ? 'Be warm and approachable' : 'Project confidence and expertise'}
5. End with offer to discuss further
6. Do NOT include signature (that's added separately)

Return ONLY the cover letter text, no additional commentary.`;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const coverLetter = completion.choices[0]?.message?.content?.trim() || '';

      res.json({ coverLetter, mode: isEnhancing ? 'enhanced' : 'generated' });
    } catch (error: any) {
      console.error("[AI Cover Letter] Error:", error.message);
      res.status(500).json({ error: "Failed to generate cover letter" });
    }
  });

  return httpServer;
}
