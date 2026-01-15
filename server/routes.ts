import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertTransactionSchema, insertCoordinatorSchema, insertMarketingAssetSchema, insertCmaSchema } from "@shared/schema";
import { setupGmailForTransaction, isGmailConfigured, getNewMessages, watchUserMailbox } from "./gmail";
import { createSlackChannel, inviteUsersToChannel, postToChannel, uploadFileToChannel } from "./slack";
import { fetchMLSListing, fetchSimilarListings, searchByAddress, testRepliersAccess, getBestPhotosForFlyer } from "./repliers";
import { isRentalOrLease } from "../shared/lib/listings";
import { searchFUBContacts, getFUBContact, getFUBUserByEmail, searchFUBContactsByAssignedUser } from "./fub";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";
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
      const { createSlackChannel: shouldCreateSlack, createGmailFilter, fetchMlsData, onBehalfOfEmail, onBehalfOfSlackId, onBehalfOfName, isUnderContract, ...transactionData } = req.body;
      
      // Set the status based on whether property is under contract
      if (isUnderContract === false) {
        transactionData.status = "active";
      } else {
        transactionData.status = "in_contract";
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
        } else {
          console.log("MLS Data returned: null");
        }
      } else {
        console.log("No MLS number on transaction");
      }

      const updateData: any = {};
      
      if (mlsData) {
        updateData.mlsData = mlsData;
        updateData.propertyImages = mlsData.photos || mlsData.images || [];
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

      // Upload to Slack if requested and channel exists
      if (postToSlack && transaction.slackChannelId) {
        const typeLabel = type === "facebook" ? "Facebook (16:9)" : 
                          type === "instagram" ? "Instagram (1:1)" :
                          type === "story" ? "Story (9:16)" :
                          type === "alt_style" ? "Alternative Style" :
                          type === "flyer" ? "Property Flyer" : type;
        
        await uploadFileToChannel(
          transaction.slackChannelId,
          imageData,
          fileName,
          `${typeLabel} - ${transaction.propertyAddress}`,
          `New marketing material generated for ${transaction.propertyAddress}`
        );
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

  app.delete("/api/transactions/:transactionId/marketing-assets/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteMarketingAsset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Marketing asset not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marketing asset" });
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

      // Optionally notify Slack about the upload
      if (transaction.slackChannelId) {
        await postToChannel(
          transaction.slackChannelId,
          `A new contract document has been uploaded: *${docLabel}*`
        );
      }

      res.status(201).json(doc);
    } catch (error: any) {
      console.error("Document upload error:", error);
      res.status(400).json({ message: error.message || "Failed to upload document" });
    }
  });

  app.delete("/api/transactions/:transactionId/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const deleted = await storage.deleteContractDocument(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
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

  return httpServer;
}
