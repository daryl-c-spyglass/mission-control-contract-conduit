import type { Express } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertTransactionSchema, insertCoordinatorSchema, insertMarketingAssetSchema, insertCmaSchema, insertNotificationSettingsSchema, insertFlyerSchema } from "@shared/schema";
import { setupGmailForTransaction, isGmailConfigured, getNewMessages, watchUserMailbox } from "./gmail";
import { createSlackChannel, inviteUsersToChannel, postToChannel, uploadFileToChannel, postDocumentUploadNotification, postMLSListingNotification, sendMarketingNotification, postComingSoonNotification, postPhotographyRequest } from "./slack";
import { fetchMLSListing, fetchSimilarListings, searchByAddress, testRepliersAccess, getBestPhotosForFlyer, getAISelectedPhotosForFlyer, searchNearbyComparables, type CMASearchFilters } from "./repliers";
import { isRentalOrLease } from "../shared/lib/listings";
import { searchFUBContacts, getFUBContact, getFUBUserByEmail, searchFUBContactsByAssignedUser } from "./fub";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { getSyncStatus, triggerManualSync } from "./repliers-sync";
import OpenAI from "openai";
import { generatePrintFlyer, formatAddressForFlyer, type FlyerData, type OutputType } from "./services/flyer-generator";
import { generateGraphic, type GraphicsFormat, type GraphicsData } from "./services/graphics-generator";
import { nanoid } from "nanoid";
import QRCode from "qrcode";
import { createModuleLogger } from './lib/logger';
import { withTimeout, openaiCircuit } from './lib/resilience';
import { apiLimiter, transactionCreateLimiter, generationLimiter } from './middleware/rateLimit';

const log = createModuleLogger('transactions');

// Helper to check if a user can access a transaction (owner OR assigned coordinator)
async function canAccessTransaction(transaction: any, userId: string, userEmail?: string): Promise<boolean> {
  // Owner always has access
  if (!transaction.userId || transaction.userId === userId) {
    return true;
  }
  
  // Check if user is an assigned coordinator by email
  if (userEmail && transaction.coordinatorIds && Array.isArray(transaction.coordinatorIds) && transaction.coordinatorIds.length > 0) {
    const coordinatorsList = await storage.getCoordinators();
    const userCoordinator = coordinatorsList.find(c => c.email === userEmail);
    if (userCoordinator && transaction.coordinatorIds.includes(userCoordinator.id)) {
      return true;
    }
  }
  
  return false;
}

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

  app.use('/api/', apiLimiter);

  // ============ Transactions ============

  app.get("/api/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      const transactions = await storage.getTransactions(userId, userEmail);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Verify user can access this transaction (owner OR assigned coordinator)
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Enrich CMA comparables with coordinates if they're missing
      if (transaction.cmaData && Array.isArray(transaction.cmaData) && transaction.cmaData.length > 0) {
        const cmaComparables = transaction.cmaData as any[];
        const missingCount = cmaComparables.filter(c => !c.map && c.mlsNumber).length;
        
        if (missingCount > 0) {
          log.info(`[CMA Enrich] Transaction ${req.params.id} has ${missingCount}/${cmaComparables.length} comparables without coordinates`);
          try {
            const { enrichCMAWithCoordinates } = await import("./repliers");
            const enrichedCMA = await enrichCMAWithCoordinates(cmaComparables);
            
            // Check how many were enriched
            const enrichedCount = enrichedCMA.filter((c: any) => c.map).length;
            log.info(`[CMA Enrich] Enriched ${enrichedCount}/${cmaComparables.length} comparables with coordinates`);
            
            // Update the transaction in database with enriched coordinates
            await storage.updateTransaction(req.params.id, { cmaData: enrichedCMA });
            
            // Return enriched data
            return res.json({ ...transaction, cmaData: enrichedCMA });
          } catch (enrichError) {
            log.error({ err: enrichError }, "Error enriching CMA coordinates");
            // Fall through to return original data
          }
        }
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transaction" });
    }
  });

  app.post("/api/transactions", transactionCreateLimiter, isAuthenticated, async (req: any, res) => {
    try {
      const body = req.body;
      const validationErrors: string[] = [];
      if (!body.propertyAddress || typeof body.propertyAddress !== 'string' || body.propertyAddress.trim().length === 0) {
        validationErrors.push('Property address is required');
      }
      if (body.propertyAddress && body.propertyAddress.length > 500) {
        validationErrors.push('Property address exceeds maximum length');
      }
      if (body.listPrice && (isNaN(Number(body.listPrice)) || Number(body.listPrice) < 0)) {
        validationErrors.push('List price must be a positive number');
      }
      if (body.bedrooms && (isNaN(Number(body.bedrooms)) || Number(body.bedrooms) < 0 || Number(body.bedrooms) > 99)) {
        validationErrors.push('Beds must be between 0 and 99');
      }
      if (body.bathrooms && (isNaN(Number(body.bathrooms)) || Number(body.bathrooms) < 0 || Number(body.bathrooms) > 99)) {
        validationErrors.push('Baths must be between 0 and 99');
      }
      if (body.photographyNotes && body.photographyNotes.length > 2000) {
        validationErrors.push('Photography notes exceed maximum length');
      }
      if (validationErrors.length > 0) {
        log.warn({ errors: validationErrors, requestId: req.requestId }, 'Invalid transaction input');
        return res.status(400).json({ error: 'Validation failed', details: validationErrors });
      }

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
        isComingSoon,
        orderPhotography,
        photographyNotes,
        photographyAppointmentDate,
        propertyDescription,
        listPrice,
        propertyType,
        sqft,
        lotSizeAcres,
        bedrooms,
        bathrooms,
        halfBaths,
        goLiveDate,
        propertyPhotoBase64,
        propertyPhotoFileName,
        ...transactionData 
      } = req.body;
      
      // Handle off-market and Coming Soon transactions
      // Both types need manual property data since there's no MLS to fetch from
      const needsManualData = isOffMarket || (isComingSoon === true || isComingSoon === 'true');
      
      if (needsManualData) {
        // Save all manually entered property data
        transactionData.propertyDescription = propertyDescription || null;
        transactionData.listPrice = listPrice ? parseInt(listPrice) : null;
        transactionData.propertyType = propertyType || null;
        transactionData.sqft = sqft ? parseInt(sqft) : null;
        transactionData.lotSizeAcres = lotSizeAcres || null;
        transactionData.bedrooms = bedrooms ? parseInt(bedrooms) : null;
        transactionData.bathrooms = bathrooms ? parseInt(bathrooms) : null;
        transactionData.halfBaths = halfBaths ? parseInt(halfBaths) : null;
        transactionData.goLiveDate = goLiveDate || null; // When listing will go live on MLS
        
        log.info({
          listPrice: transactionData.listPrice,
          bedrooms: transactionData.bedrooms,
          bathrooms: transactionData.bathrooms,
          halfBaths: transactionData.halfBaths,
          sqft: transactionData.sqft,
          goLiveDate: transactionData.goLiveDate,
          propertyType: transactionData.propertyType,
        }, 'Manual data fields saved');
      }
      
      // Off-market specific settings
      if (isOffMarket) {
        transactionData.isOffMarket = true;
        transactionData.offMarketListingDate = new Date();
        transactionData.status = "active"; // Off-market listings are active, not in contract
        // Clear MLS number for off-market listings
        transactionData.mlsNumber = null;
        // Clear contract/closing dates for off-market (they use goLiveDate instead)
        transactionData.contractDate = null;
        transactionData.closingDate = null;
      } else {
        transactionData.isOffMarket = false;
        if (!needsManualData) {
          transactionData.goLiveDate = null; // Only clear goLiveDate if not Coming Soon either
        }
      }
      
      // Set company lead flag
      transactionData.isCompanyLead = isCompanyLead === true || isCompanyLead === 'true';
      
      // Set coming soon flag
      transactionData.isComingSoon = isComingSoon === true || isComingSoon === 'true';
      
      // Set photography order fields
      transactionData.orderPhotography = orderPhotography === true || orderPhotography === 'true';
      transactionData.photographyNotes = transactionData.orderPhotography ? (photographyNotes || null) : null;
      transactionData.photographyAppointmentDate = transactionData.orderPhotography ? (photographyAppointmentDate || null) : null;
      
      // DEBUG: Log Coming Soon status
      log.debug({
        isComingSoon_raw: isComingSoon,
        isComingSoon_type: typeof isComingSoon,
        isComingSoon_computed: transactionData.isComingSoon,
        propertyAddress: transactionData.propertyAddress
      }, 'Coming Soon debug');
      
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
      log.info({
        shouldCreateSlack,
        slackTokenExists: !!process.env.SLACK_BOT_TOKEN,
        disableSlackNotifications: process.env.DISABLE_SLACK_NOTIFICATIONS,
        transactionId: transaction.id,
        address: transaction.propertyAddress
      }, 'Slack channel creation check');

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
          log.info({ channelName, agentName }, 'Attempting to create Slack channel');
          
          const slackResult = await createSlackChannel(channelName);
          
          // Handle null result (notifications disabled or creation failed)
          if (!slackResult) {
            log.info('[TRANSACTION] ⚠️ Slack channel NOT created (returned null)');
            // Continue without Slack channel - don't store fake ID
          } else {
            log.info({ data: slackResult }, '[TRANSACTION] ✅ Slack channel created');
            
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
          } // end of else (slackResult exists)
        } catch (slackError) {
          log.error({ err: slackError }, "Slack channel creation error");
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
            log.info(`Gmail filter pending for ${onBehalfOfEmail} - will create when they consent`);
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
              log.info("Skipping Gmail filter: agent hasn't given email consent");
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
                  log.info(`Gmail watch set up for ${targetEmail}, historyId: ${watchResult.historyId}`);
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
          log.error({ err: gmailError }, "Gmail setup error");
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
                log.error({ err: slackPostError }, "Error posting MLS data to Slack");
              }
            } else if (currentTransaction?.slackChannelId && mlsData.status) {
              log.info(`Skipping Slack post: listing status "${mlsData.status}" is not active/pending`);
            }
          }
        } catch (mlsError) {
          log.error({ err: mlsError }, "MLS data fetch error");
          // Continue without MLS - don't fail the transaction
        }
      }

      // Upload property photo if provided (for off-market or coming soon)
      let uploadedPhotoUrl: string | null = null;
      let photoUploadError: string | null = null;
      if (propertyPhotoBase64 && (isOffMarket || isComingSoon)) {
        try {
          const privateDir = process.env.PRIVATE_OBJECT_DIR;
          if (!privateDir) {
            log.warn("[Transaction Creation] PRIVATE_OBJECT_DIR not configured, skipping photo upload");
            photoUploadError = "Object storage not configured";
          } else {
            // Validate image type
            const validImagePrefixes = ['data:image/jpeg', 'data:image/png', 'data:image/gif', 'data:image/webp', 'data:image/jpg'];
            if (!validImagePrefixes.some(prefix => propertyPhotoBase64.startsWith(prefix))) {
              log.warn("[Transaction Creation] Invalid image type provided");
              photoUploadError = "Invalid image type";
            } else {
              const base64Data = propertyPhotoBase64.replace(/^data:image\/\w+;base64,/, '');
              const fileSizeBytes = Buffer.byteLength(base64Data, 'base64');
              const maxSizeBytes = 10 * 1024 * 1024; // 10MB
              
              if (fileSizeBytes > maxSizeBytes) {
                log.warn(`[Transaction Creation] Photo too large: ${(fileSizeBytes / (1024 * 1024)).toFixed(2)}MB`);
                photoUploadError = "Photo exceeds 10MB limit";
              } else {
                const pathParts = privateDir.startsWith('/') ? privateDir.slice(1).split('/') : privateDir.split('/');
                const bucketName = pathParts[0];
                
                const { randomUUID } = await import('crypto');
                const objectId = randomUUID();
                const timestamp = Date.now();
                const safeFileName = (propertyPhotoFileName || 'photo.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
                const objectName = `.private/uploads/property-${transaction.id}-${timestamp}-${objectId}-${safeFileName}`;
                
                const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
                const bucket = objectStorageClient.bucket(bucketName);
                const file = bucket.file(objectName);
                
                const buffer = Buffer.from(base64Data, 'base64');
                const contentType = propertyPhotoBase64.startsWith('data:image/png') ? 'image/png' : 
                                   propertyPhotoBase64.startsWith('data:image/gif') ? 'image/gif' : 
                                   propertyPhotoBase64.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
                
                await file.save(buffer, {
                  contentType,
                  metadata: { cacheControl: 'public, max-age=31536000' },
                });
                
                const entityId = objectName.replace('.private/', '');
                uploadedPhotoUrl = `/objects/${entityId}`;
                
                // Update transaction with the photo
                const currentImages = transaction.propertyImages || [];
                const updatedImages = [...currentImages, uploadedPhotoUrl];
                await storage.updateTransaction(transaction.id, { propertyImages: updatedImages });
                
                // Also save to transactionPhotos table with proper source
                const photoSource = isComingSoon ? 'coming_soon' : 'off_market';
                await storage.addTransactionPhoto({
                  transactionId: transaction.id,
                  url: uploadedPhotoUrl,
                  filename: safeFileName,
                  source: photoSource,
                  label: isComingSoon ? 'Coming Soon Upload' : 'Off Market Upload',
                  sortOrder: 0,
                });
                
                log.info(`[Transaction Creation] Photo uploaded successfully: ${uploadedPhotoUrl} (source: ${photoSource})`);
              }
            }
          }
        } catch (photoError) {
          log.error({ err: photoError }, "[Transaction Creation] Photo upload error");
          photoUploadError = "Upload failed";
          // Continue without photo - don't fail transaction creation
        }
      }
      
      // Log photo status for Coming Soon notifications
      if (isComingSoon) {
        if (uploadedPhotoUrl) {
          log.info(`[Coming Soon] Photo available for notification: ${uploadedPhotoUrl}`);
        } else if (photoUploadError) {
          log.info(`[Coming Soon] No photo for notification (${photoUploadError}), notification will proceed without image`);
        } else if (!propertyPhotoBase64) {
          log.info("[Coming Soon] No photo provided by user, notification will proceed without image");
        }
      }

      // Post Coming Soon notification if checkbox was checked
      log.info({
        isComingSoon: transactionData.isComingSoon,
        transactionId: transaction.id,
        propertyAddress: transaction.propertyAddress,
        willPostNotification: !!transactionData.isComingSoon
      }, 'Coming Soon check');
      
      if (transactionData.isComingSoon) {
        log.info('[TRANSACTION] ✅ Coming Soon is TRUE - calling postComingSoonNotification');
        try {
          // Get agent info for notification
          let agentName = "";
          let agentEmail = "";
          let agentPhone = "";
          
          if (onBehalfOfName && onBehalfOfName.trim()) {
            agentName = onBehalfOfName.trim();
            agentEmail = onBehalfOfEmail || "";
          } else if (userId) {
            const creator = await authStorage.getUser(userId);
            if (creator) {
              agentName = `${creator.firstName || ""} ${creator.lastName || ""}`.trim();
              agentEmail = creator.email || "";
              // Try to get phone from marketing profile
              agentPhone = creator.marketingPhone || "";
            }
          }
          
          // Get the latest persisted transaction with all manual data
          const currentTx = await storage.getTransaction(transaction.id);
          const mlsData = currentTx?.mlsData as any;
          const mlsPhotos = mlsData?.photos || [];
          const uploadedPhotos = currentTx?.propertyImages || [];
          // Use freshly uploaded photo first, then fall back to MLS or existing uploads
          let heroPhotoUrl = uploadedPhotoUrl || mlsPhotos[0] || uploadedPhotos[0] || null;
          
          // Ensure hero photo URL is absolute (Slack requires public URLs)
          if (heroPhotoUrl && !heroPhotoUrl.startsWith('http')) {
            const appUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
              ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
              : 'https://mission-control-contract-conduit.onrender.com';
            heroPhotoUrl = `${appUrl}${heroPhotoUrl.startsWith('/') ? '' : '/'}${heroPhotoUrl}`;
          }
          
          // Calculate total bathrooms: fullBaths + halfBaths as decimal (e.g., 2 full + 1 half = 2.5)
          const fullBaths = currentTx?.bathrooms || 0;
          const halfBathsCount = currentTx?.halfBaths || 0;
          const totalBaths = fullBaths + (halfBathsCount * 0.5);
          const formattedBaths = totalBaths > 0 ? totalBaths : null;
          
          log.info({
            listPrice: currentTx?.listPrice,
            bedrooms: currentTx?.bedrooms,
            fullBaths,
            halfBathsCount,
            totalBaths: formattedBaths,
            sqft: currentTx?.sqft,
            goLiveDate: currentTx?.goLiveDate,
            heroPhotoUrl,
            uploadedPhotoUrl,
          }, 'Coming Soon notification data');
          
          // Use persisted data from manual entry, falling back to MLS data
          const notificationSuccess = await postComingSoonNotification({
            propertyAddress: currentTx?.propertyAddress || transaction.propertyAddress,
            listPrice: currentTx?.listPrice || mlsData?.listPrice || null,
            bedrooms: currentTx?.bedrooms || mlsData?.bedrooms || null,
            bathrooms: formattedBaths || mlsData?.bathrooms || null,
            sqft: currentTx?.sqft || mlsData?.sqft || null,
            goLiveDate: currentTx?.goLiveDate || null,
            description: currentTx?.propertyDescription || mlsData?.description || null,
            transactionId: transaction.id,
            agentName,
            agentEmail,
            agentPhone,
            heroPhotoUrl,
          });
          
          // Only log activity if notification was actually posted successfully
          if (notificationSuccess) {
            await storage.createActivity({
              transactionId: transaction.id,
              type: "notification",
              description: "Coming Soon notification posted to #coming-soon-listings",
              category: "communication",
            });
          } else {
            log.info('[TRANSACTION] ⚠️ Coming Soon notification was NOT posted (check Slack logs above)');
          }
        } catch (comingSoonError) {
          log.error({ err: comingSoonError }, "Failed to post Coming Soon notification");
          // Don't fail transaction creation if notification fails
        }
      }

      // Post Photography Request if checkbox was checked
      if (transactionData.orderPhotography) {
        try {
          let photographyAgentName = "";
          let photographyAgentEmail = "";
          let photographyAgentPhone = "";
          
          if (onBehalfOfName && onBehalfOfName.trim()) {
            photographyAgentName = onBehalfOfName.trim();
            photographyAgentEmail = onBehalfOfEmail || "";
          } else if (userId) {
            const creator = await authStorage.getUser(userId);
            if (creator) {
              photographyAgentName = `${creator.firstName || ""} ${creator.lastName || ""}`.trim();
              photographyAgentEmail = creator.email || "";
              photographyAgentPhone = creator.marketingPhone || "";
            }
          }
          
          const appUrl = process.env.REPLIT_DOMAINS?.split(',')[0]
            ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
            : 'https://mission-control-contract-conduit.onrender.com';

          const photoTx = await storage.getTransaction(transaction.id);
          const photoMlsData = photoTx?.mlsData as any;
          const photoMlsPhotos = photoMlsData?.photos || [];
          const photoUploaded = photoTx?.propertyImages || [];
          let photographyHeroPhoto = uploadedPhotoUrl || photoMlsPhotos[0] || photoUploaded[0] || null;
          if (photographyHeroPhoto && !photographyHeroPhoto.startsWith('http')) {
            photographyHeroPhoto = `${appUrl}${photographyHeroPhoto.startsWith('/') ? '' : '/'}${photographyHeroPhoto}`;
          }

          const photographySuccess = await postPhotographyRequest({
            propertyAddress: transaction.propertyAddress,
            transactionId: transaction.id,
            agentName: photographyAgentName,
            agentEmail: photographyAgentEmail,
            agentPhone: photographyAgentPhone,
            mlsNumber: transaction.mlsNumber,
            heroPhotoUrl: photographyHeroPhoto,
            photographyNotes: transactionData.photographyNotes,
            photographyAppointmentDate: transactionData.photographyAppointmentDate,
            appUrl,
          });
          
          if (photographySuccess) {
            await storage.createActivity({
              transactionId: transaction.id,
              type: "notification",
              description: "Photography request posted to #spyglass-photography",
              category: "communication",
            });
          }
        } catch (photographyError) {
          log.error({ err: photographyError }, "Failed to post photography request");
        }
      }

      // Fetch the updated transaction
      const updatedTransaction = await storage.getTransaction(transaction.id);
      res.status(201).json(updatedTransaction);
    } catch (error: any) {
      log.error({ err: error }, "Create transaction error");
      res.status(400).json({ message: error.message || "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      
      // Get current transaction to check for date changes
      const currentTransaction = await storage.getTransaction(req.params.id);
      if (!currentTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Verify user can access this transaction (owner OR assigned coordinator)
      if (!(await canAccessTransaction(currentTransaction, userId, userEmail))) {
        return res.status(403).json({ message: "Access denied" });
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
      if (req.body.goLiveDate !== undefined && req.body.goLiveDate !== currentTransaction.goLiveDate) {
        const newDate = req.body.goLiveDate ? new Date(req.body.goLiveDate).toLocaleDateString() : 'removed';
        dateChanges.push(`Date Going Live updated to ${newDate}`);
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

  app.delete("/api/transactions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      
      // Verify user can access this transaction (owner OR assigned coordinator)
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
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
  app.patch("/api/transactions/:id/add-mls", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      const { mlsNumber } = req.body;
      
      if (!mlsNumber) {
        return res.status(400).json({ message: "MLS number is required" });
      }
      
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Verify user can access this transaction (owner OR assigned coordinator)
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Access denied" });
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
        log.error({ err: mlsError }, 'Failed to sync MLS data after adding MLS number');
        // Still return success since the MLS number was added
      }
      
      // Get the updated transaction
      const finalTransaction = await storage.getTransaction(req.params.id);
      res.json(finalTransaction);
    } catch (error) {
      log.error({ err: error }, 'Error adding MLS number to transaction');
      res.status(500).json({ message: "Failed to add MLS number" });
    }
  });

  // Archive a transaction - saves notification settings and disables all reminders
  app.patch("/api/transactions/:id/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Verify user can access this transaction (owner OR assigned coordinator)
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get current notification settings to save before archiving
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
      
      log.info(`[Archive] Transaction ${req.params.id} archived. All notifications disabled.`);
      
      res.json(updated);
    } catch (error) {
      log.error({ err: error }, 'Error archiving transaction');
      res.status(500).json({ message: "Failed to archive transaction" });
    }
  });
  
  // Unarchive/restore a transaction with optional notification restoration
  app.patch("/api/transactions/:id/unarchive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      const { restoreNotifications = false } = req.body;
      
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      // Verify user can access this transaction (owner OR assigned coordinator)
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Access denied" });
      }
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
        log.info(`[Unarchive] Transaction ${req.params.id} - Restoring notification settings`);
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
      
      log.info(`[Unarchive] Transaction ${req.params.id} restored. Notifications: ${notificationsRestored ? 'RESTORED' : 'OFF'}`);
      
      res.json({
        ...updated,
        notificationsRestored,
      });
    } catch (error) {
      log.error({ err: error }, 'Error unarchiving transaction');
      res.status(500).json({ message: "Failed to unarchive transaction" });
    }
  });

  // Delete all archived transactions permanently
  app.delete("/api/transactions/archived/delete-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const allTransactions = await storage.getTransactions(userId);
      const archivedTransactions = allTransactions.filter(t => t.isArchived === true);
      
      if (archivedTransactions.length === 0) {
        return res.json({ deleted: 0, message: "No archived transactions to delete" });
      }

      log.info(`[DeleteAllArchived] Deleting ${archivedTransactions.length} archived transactions for user ${userId}`);

      let deletedCount = 0;
      const errors: string[] = [];

      for (const transaction of archivedTransactions) {
        try {
          // Delete the transaction - this cascades to activities, open houses, etc.
          await storage.deleteTransaction(transaction.id);
          deletedCount++;
          log.info(`[DeleteAllArchived] Deleted transaction: ${transaction.propertyAddress}`);
        } catch (err) {
          log.error({ err: err }, `[DeleteAllArchived] Failed to delete transaction ${transaction.id}`);
          errors.push(transaction.propertyAddress);
        }
      }

      log.info(`[DeleteAllArchived] Complete: ${deletedCount} deleted, ${errors.length} failed`);
      
      res.json({ 
        deleted: deletedCount, 
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully deleted ${deletedCount} archived transaction${deletedCount !== 1 ? 's' : ''}`
      });
    } catch (error) {
      log.error({ err: error }, 'Error deleting all archived transactions');
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
      
      log.info(`[Slack] Creating channel for existing transaction: ${channelName}`);
      const slackResult = await createSlackChannel(channelName);
      
      // Handle null result (notifications disabled or creation failed)
      if (!slackResult) {
        log.info('[Slack] ⚠️ Channel NOT created for existing transaction (returned null)');
        res.status(400).json({ message: "Slack channel creation failed or notifications are disabled" });
        return;
      }
      
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
      log.error({ err: error }, "Connect Slack error");
      res.status(500).json({ message: error.message || "Failed to connect Slack channel" });
    }
  });

  app.post("/api/transactions/:id/refresh-mls", isAuthenticated, async (req, res) => {
    log.info({ data: req.params.id }, "=== REFRESH MLS REQUEST ===");
    try {
      const transaction = await storage.getTransaction(req.params.id);
      log.info({ transactionId: transaction?.id, mlsNumber: transaction?.mlsNumber }, 'Transaction found');
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      if (!process.env.REPLIERS_API_KEY) {
        log.info("REPLIERS_API_KEY not configured");
        return res.status(400).json({ message: "Repliers API key not configured" });
      }
      log.info({ data: transaction.mlsNumber }, "Calling Repliers API for MLS#");

      let mlsData = null;
      let cmaData: any[] = [];

      if (transaction.mlsNumber) {
        const mlsResult = await fetchMLSListing(transaction.mlsNumber);
        if (mlsResult) {
          mlsData = mlsResult.mlsData;
          cmaData = mlsResult.comparables;
          log.info("MLS Data returned:", "found", mlsData?.photos?.length, "photos");
          
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
              log.info(`[RefreshMLS] Using coordinate-based search for closed listing ${transaction.mlsNumber}`);
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
              log.info(`[RefreshMLS] Coordinate search found ${cmaData.length} comparables for closed listing`);
            }
          }
        } else {
          log.info("MLS Data returned: null");
        }
      } else {
        log.info("No MLS number on transaction");
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

      log.info({ updateFields: Object.keys(updateData) }, 'Updating transaction');
      const updated = await storage.updateTransaction(req.params.id, updateData);

      // Sync CMA record's propertiesData if it exists (keep Presentation Builder in sync)
      if (cmaData && cmaData.length > 0) {
        try {
          const existingCma = await storage.getCmaByTransaction(req.params.id);
          if (existingCma) {
            await storage.updateCma(existingCma.id, {
              propertiesData: cmaData,
            });
            log.info(`[MLS Refresh] Synced ${cmaData.length} comparables to CMA propertiesData`);
          }
        } catch (syncError) {
          log.warn({ err: syncError }, 'MLS Refresh: Failed to sync CMA propertiesData');
        }
      }

      await storage.createActivity({
        transactionId: transaction.id,
        type: "mls_refreshed",
        description: mlsData ? `MLS data refreshed with ${mlsData.photos?.length || 0} photos` : "MLS data refresh attempted (no data found)",
        category: "mls",
      });

      res.json(updated);
    } catch (error: any) {
      log.error({ err: error }, "Error refreshing MLS data");
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

      log.info(`[CMA Fallback] Generating for transaction ${id} at (${latitude}, ${longitude})`);

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

      log.info(`[CMA Fallback] Success: ${comparables.length} comparables found for transaction ${id}`);

      res.json({ 
        success: true,
        message: `Found ${comparables.length} comparable properties`,
        comparablesCount: comparables.length,
      });

    } catch (error: any) {
      log.error({ err: error }, "[CMA Fallback] Error");
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

      log.info(`[CMA] Cleared CMA data for transaction ${id}`);

      res.json({ success: true, message: "CMA data cleared" });

    } catch (error: any) {
      log.error({ err: error }, "[CMA Clear] Error");
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
      log.error({ err: error }, "Error searching listings");
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
        log.error('[Places API] GOOGLE_MAPS_API_KEY not configured');
        return res.json({ predictions: [] });
      }

      log.info(`[Places API] Searching for: "${query}"`);

      const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
      url.searchParams.append('input', query);
      url.searchParams.append('types', 'address');
      url.searchParams.append('components', 'country:us');
      url.searchParams.append('key', apiKey);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        log.error(`[Places API] Error: ${response.status}`);
        return res.json({ predictions: [] });
      }

      const data = await response.json();
      
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        log.error(`[Places API] Status: ${data.status}`);
        return res.json({ predictions: [] });
      }

      const predictions = (data.predictions || []).map((p: any) => ({
        description: p.description,
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text || '',
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));
      
      log.info(`[Places API] Found ${predictions.length} suggestions`);
      res.json({ predictions });
    } catch (error: any) {
      log.error({ err: error }, '[Places API] Error');
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

      log.info(`[MLS Search] Searching by address: "${query}"`);

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
        log.error(`[MLS Search] Address search error: ${response.status}`);
        return res.json({ results: [] });
      }

      const data = await response.json();
      const results = (data.listings || [])
        .filter((l: any) => !isRentalOrLease(l))
        .map(mapListingToSearchResult);
      
      log.info(`[MLS Search] Found ${results.length} properties for address: "${query}"`);
      res.json({ results });
    } catch (error: any) {
      log.error({ err: error }, '[MLS Search Address] Error');
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

      log.info(`[MLS Search] Searching by MLS#: "${query}"`);

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
          log.info(`[MLS Search] Trying exact match: ${normalized}`);
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
                log.info(`[MLS Search] Exact match found: ${normalized}`);
              }
            }
          }
        } catch (e) {
          log.info(`[MLS Search] No exact match for ${normalized}`);
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
          log.info(`[MLS Search] Search failed for ${normalized}`);
        }
      }

      // Remove duplicates
      const uniqueResults = results.filter((item, index, self) => 
        index === self.findIndex(t => t.mlsNumber === item.mlsNumber)
      );

      log.info(`[MLS Search] Found ${uniqueResults.length} properties for MLS#: "${query}"`);
      res.json({ results: uniqueResults });
    } catch (error: any) {
      log.error({ err: error }, '[MLS Search MLS#] Error');
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
      log.info(`[MLS Listing] Fetching: ${normalized}`);

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
      log.error({ err: error }, '[MLS Listing] Error');
      res.status(500).json({ error: "Failed to fetch listing" });
    }
  });

  // ============ Coordinators ============
  // Note: Coordinators are internal team data, no auth required for read
  app.get("/api/coordinators", async (req, res) => {
    try {
      log.info("[coordinators] Fetching coordinators...");
      const coordinators = await storage.getCoordinators();
      log.info({ count: coordinators.length, names: coordinators.map(c => c.name) }, 'Found coordinators');
      res.json(coordinators);
    } catch (error) {
      log.error({ err: error }, "[coordinators] Error fetching coordinators");
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
      log.error({ err: error }, "Error getting recommended photos");
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
        
        // If not explicitly requested, check user's global notification preferences
        if (postToSlack === undefined && userId) {
          try {
            const userPrefs = await storage.getUserNotificationPreferences(userId);
            shouldNotify = userPrefs?.notifyMarketingAssets ?? true; // Default to true
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
            log.error({ err: slackError }, "Failed to send marketing notification to Slack");
          }
        }
      }

      res.status(201).json(asset);
    } catch (error: any) {
      log.error({ err: error }, "Marketing asset creation error");
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
      log.error({ err: error }, "Marketing asset update error");
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
            log.error({ err: slackError }, "Failed to send Slack notification for marketing deletion");
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete marketing asset" });
    }
  });

  // ============ Property Photos (Off Market) ============

  // Get all transaction photos (from transactionPhotos table)
  app.get("/api/transactions/:id/transaction-photos", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Authorization check
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Not authorized to access this transaction" });
      }

      // Get photos from transactionPhotos table
      const photos = await storage.getTransactionPhotos(transaction.id);
      
      // Sort: MLS first, then Coming Soon, then Off Market, then Uploaded (by sortOrder)
      const sourceOrder: Record<string, number> = { mls: 0, coming_soon: 1, off_market: 2, uploaded: 3 };
      const sortedPhotos = photos.sort((a, b) => {
        const orderA = sourceOrder[a.source] ?? 99;
        const orderB = sourceOrder[b.source] ?? 99;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      });

      res.json(sortedPhotos);
    } catch (error) {
      log.error({ err: error }, "Error fetching transaction photos");
      res.status(500).json({ message: "Failed to fetch photos" });
    }
  });

  // Delete a transaction photo (only non-MLS photos)
  app.delete("/api/transactions/:id/transaction-photos/:photoId", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Authorization check
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Not authorized to access this transaction" });
      }

      const photo = await storage.getTransactionPhoto(req.params.photoId);
      
      if (!photo) {
        return res.status(404).json({ message: "Photo not found" });
      }
      
      // Verify photo belongs to this transaction
      if (photo.transactionId !== req.params.id) {
        return res.status(403).json({ message: "Photo does not belong to this transaction" });
      }

      if (photo.source === 'mls') {
        return res.status(403).json({ message: "Cannot delete MLS photos" });
      }

      await storage.deleteTransactionPhoto(req.params.photoId);
      
      // Also remove from propertyImages array if present
      if (transaction.propertyImages) {
        const updatedImages = transaction.propertyImages.filter((url: string) => url !== photo.url);
        await storage.updateTransaction(transaction.id, { propertyImages: updatedImages });
      }

      res.json({ success: true });
    } catch (error) {
      log.error({ err: error }, "Error deleting photo");
      res.status(500).json({ message: "Failed to delete photo" });
    }
  });

  // Upload property photos for off-market listings
  app.post("/api/transactions/:id/photos", isAuthenticated, async (req: any, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      // Authorization check
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      if (!(await canAccessTransaction(transaction, userId, userEmail))) {
        return res.status(403).json({ message: "Not authorized to upload photos to this transaction" });
      }

      // Get the private object directory from env
      const privateDir = process.env.PRIVATE_OBJECT_DIR;
      if (!privateDir) {
        log.error("[Photo Upload] PRIVATE_OBJECT_DIR not set");
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
      
      // Parse the private directory to get bucket name and base path
      // Format: /replit-objstore-{uuid}/.private or similar
      const pathParts = privateDir.startsWith('/') ? privateDir.slice(1).split('/') : privateDir.split('/');
      const bucketName = pathParts[0];
      
      // Create unique filename using UUID pattern to match the object storage route
      const { randomUUID } = await import('crypto');
      const objectId = randomUUID();
      const timestamp = Date.now();
      const safeFileName = (fileName || 'photo.jpg').replace(/[^a-zA-Z0-9.-]/g, '_');
      // Store in uploads/ directory to match the /objects/* route pattern
      const objectName = `.private/uploads/property-${transaction.id}-${timestamp}-${objectId}-${safeFileName}`;
      
      log.info(`[Photo Upload] Bucket: ${bucketName}, Object: ${objectName}`);
      
      // Upload to object storage using GCS client
      const { objectStorageClient } = await import("./replit_integrations/object_storage/objectStorage");
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);
      
      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Determine content type
      const contentType = imageData.startsWith('data:image/png') ? 'image/png' : 
                         imageData.startsWith('data:image/gif') ? 'image/gif' : 
                         imageData.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
      
      log.info(`[Photo Upload] Saving file (${buffer.length} bytes, ${contentType})`);
      
      await file.save(buffer, {
        contentType,
        metadata: {
          cacheControl: 'public, max-age=31536000',
        },
      });
      
      log.info(`[Photo Upload] File saved successfully`);

      // Construct the object path that our /objects/* route can serve
      // The path matches what getObjectEntityFile expects: /objects/{entityId}
      const entityId = objectName.replace('.private/', '');
      const photoUrl = `/objects/${entityId}`;
      
      log.info(`[Photo Upload] Photo URL: ${photoUrl}`);

      // Update transaction with new photo URL
      const currentImages = transaction.propertyImages || [];
      const updatedImages = [...currentImages, photoUrl];
      
      await storage.updateTransaction(transaction.id, {
        propertyImages: updatedImages,
      });

      // Also save to transactionPhotos table
      const savedPhoto = await storage.addTransactionPhoto({
        transactionId: transaction.id,
        url: photoUrl,
        filename: safeFileName,
        source: 'uploaded',
        label: 'User Upload',
        sortOrder: 0,
      });

      await storage.createActivity({
        transactionId: transaction.id,
        type: "photo_uploaded",
        description: `Property photo uploaded`,
        category: "marketing",
      });

      res.json({ 
        success: true, 
        photoUrl: photoUrl,
        propertyImages: updatedImages,
        photo: savedPhoto,
      });
    } catch (error: any) {
      log.error({ err: error }, "[Photo Upload] Error");
      log.error({ stack: error?.stack }, 'Photo Upload stack trace');
      res.status(500).json({ message: "Failed to upload photo", error: error?.message });
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
      log.error({ err: error }, "Error setting primary photo");
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
      log.error({ err: error }, "Error deleting photo");
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
    log.debug({ transactionId: req.params.id, contentType: req.get('Content-Type'), bodyKeys: Object.keys(req.body || {}) }, 'Document upload request received');
    
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
      log.debug({ slackChannelId: transaction.slackChannelId }, 'Starting Slack notification flow for document upload');
      
      if (transaction.slackChannelId) {
        const userId = req.user?.claims?.sub;
        let shouldNotify = true; // Default to enabled
        
        log.debug({ userId }, 'Document upload user ID');
        
        if (userId) {
          try {
            const userPrefs = await storage.getUserNotificationPreferences(userId);
            shouldNotify = userPrefs?.notifyDocumentUploads ?? true;
            log.debug({ userPrefs, shouldNotify }, 'Document upload notification preferences');
          } catch (e) {
            log.debug({ err: e }, 'Error getting notification settings, defaulting to enabled');
            shouldNotify = true; // Default to enabled if can't get settings
          }
        }
        
        if (shouldNotify) {
          log.debug('Preparing to send document file to Slack');
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
            log.debug({ channelId: transaction.slackChannelId, fileName, fileDataLength: fileData?.length }, 'Calling uploadFileToChannel');
            
            const result = await uploadFileToChannel(
              transaction.slackChannelId,
              fileData,
              fileName,
              docLabel,
              initialComment
            );
            log.debug({ result }, 'uploadFileToChannel result');
          } catch (slackError) {
            log.error({ err: slackError }, 'Failed to send document to Slack');
            // Don't fail the request if Slack notification fails
          }
        } else {
          log.debug('shouldNotify is false, skipping Slack notification for document');
        }
      } else {
        log.debug('No slackChannelId on transaction, skipping Slack notification for document');
      }

      res.status(201).json(doc);
    } catch (error: any) {
      log.error({ err: error }, "Document upload error");
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
            const userPrefs = await storage.getUserNotificationPreferences(userId);
            shouldNotify = userPrefs?.notifyDocumentUploads ?? true;
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
            log.error({ err: slackError }, "Failed to send Slack notification for document deletion");
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

  // Get agent resources for a shared CMA (no auth required for public sharing)
  app.get("/api/shared/cma/:token/resources", async (req, res) => {
    try {
      const cma = await storage.getCmaByShareToken(req.params.token);
      if (!cma) {
        return res.status(404).json({ message: "CMA not found or link expired" });
      }
      // Check expiration
      if (cma.expiresAt && new Date(cma.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This CMA link has expired" });
      }
      
      if (!cma.userId) {
        return res.json([]);
      }
      
      const resources = await storage.getAgentResources(cma.userId);
      // Only return active resources (filter out inactive ones)
      const activeResources = resources.filter(r => r.isActive !== false);
      res.json(activeResources);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch resources" });
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
      log.error({ err: error }, "CMA creation error");
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
      log.error({ err: error }, "Transaction CMA creation error");
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

      log.info({ data: searchFilters }, `[CMA Refresh] Searching for comparables near ${mlsNumber} with filters`);

      // Search for nearby comparables
      const comparables = await searchNearbyComparables(
        coords.latitude,
        coords.longitude,
        mlsNumber,
        searchFilters
      );

      log.info(`[CMA Refresh] Found ${comparables.length} comparables`);

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
      log.error({ err: error }, "[CMA Refresh] Error");
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
      
      // Try propertiesData first, fall back to linked transaction's cmaData
      let properties = (cma.propertiesData || []) as any[];
      
      if (properties.length === 0 && cma.transactionId) {
        const transaction = await storage.getTransaction(cma.transactionId);
        if (transaction?.cmaData) {
          properties = transaction.cmaData as any[];
        }
      }
      
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
      
      // Handle both CMA data formats: {price, sqft, status} and {listPrice, livingArea, standardStatus}
      const prices = properties.map(p => {
        const status = (p.standardStatus || p.status || '').toLowerCase();
        const isClosed = status.includes('closed') || status.includes('sold');
        const closePrice = p.closePrice || p.soldPrice || (isClosed ? p.price : null);
        const listPrice = p.listPrice || p.price || 0;
        return isClosed && closePrice ? Number(closePrice) : Number(listPrice);
      }).filter(p => p > 0);
      
      const sqfts = properties.map(p => Number(p.livingArea || p.sqft || 0)).filter(s => s > 0);
      
      const pricePerSqft = properties
        .filter(p => (p.livingArea || p.sqft) && Number(p.livingArea || p.sqft) > 0)
        .map(p => {
          const status = (p.standardStatus || p.status || '').toLowerCase();
          const isClosed = status.includes('closed') || status.includes('sold');
          const closePrice = p.closePrice || p.soldPrice || (isClosed ? p.price : null);
          const listPrice = p.listPrice || p.price || 0;
          const price = isClosed && closePrice ? Number(closePrice) : Number(listPrice);
          const sqft = Number(p.livingArea || p.sqft);
          return sqft > 0 ? price / sqft : 0;
        }).filter(v => v > 0 && !isNaN(v));
      
      const doms = properties.map(p => Number(p.daysOnMarket || p.simpleDaysOnMarket || 0)).filter(d => d >= 0);
      const beds = properties.map(p => Number(p.bedroomsTotal || p.bedrooms || 0)).filter(b => b > 0);
      const baths = properties.map(p => Number(p.bathroomsTotalInteger || p.bathrooms || 0)).filter(b => b > 0);
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
      log.error({ err: error }, "CMA statistics error");
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
      
      // Try propertiesData first, fall back to linked transaction's cmaData
      let properties = (cma.propertiesData || []) as any[];
      
      if (properties.length === 0 && cma.transactionId) {
        const transaction = await storage.getTransaction(cma.transactionId);
        if (transaction?.cmaData) {
          properties = transaction.cmaData as any[];
        }
      }
      
      const timeline = properties
        .filter(p => p.listDate || p.closeDate)
        .map(p => {
          const status = (p.standardStatus || p.status || '').toLowerCase();
          const isClosed = status.includes('closed') || status.includes('sold');
          const closePrice = p.closePrice || p.soldPrice || (isClosed ? p.price : null);
          const listPrice = p.listPrice || p.price || 0;
          return {
            date: isClosed && p.closeDate ? p.closeDate : p.listDate,
            price: isClosed && closePrice ? Number(closePrice) : Number(listPrice),
            status: p.standardStatus || p.status || 'Active',
            propertyId: p.id || p.mlsNumber || '',
            address: p.unparsedAddress || p.address || '',
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
      
      const toneDescriptions: Record<string, string> = {
        professional: 'professional, polished, and business-appropriate',
        friendly: 'warm, approachable, and personable while maintaining professionalism',
        confident: 'confident, authoritative, and compelling'
      };

      const hasClientName = context.clientName && context.clientName.trim().length > 0;
      
      const systemPrompt = `You are a professional real estate agent at Spyglass Realty, a premier Austin real estate brokerage known for exceptional client service and market expertise. You are writing a cover letter for a Comparative Market Analysis (CMA) report.
Write a personalized, compelling cover letter based on the provided property and market data.
The tone should be ${toneDescriptions[tone] || toneDescriptions.professional}.
Keep it concise (2-3 paragraphs) but impactful.
Include specific data points from the analysis to demonstrate expertise.
Reflect Spyglass Realty's commitment to exceptional service.
End with a clear call to action but do NOT include signature.`;

      const userPrompt = `Write a CMA cover letter for this specific property and client:
${hasClientName ? `IMPORTANT: Start with "Dear ${context.clientName}," as the greeting.` : 'IMPORTANT: Do NOT include any salutation or greeting - start directly with the body content like "Thank you for the opportunity..." or "I am pleased to present..."'}
${context.agentInfo?.name ? `Agent: ${context.agentInfo.name}` : ''}
Brokerage: Spyglass Realty

Subject Property: ${context.subjectProperty?.address || 'Not specified'}
${context.subjectProperty?.price ? `List Price: $${context.subjectProperty.price.toLocaleString()}` : ''}
${context.subjectProperty?.beds ? `Beds: ${context.subjectProperty.beds}` : ''} ${context.subjectProperty?.baths ? `Baths: ${context.subjectProperty.baths}` : ''} ${context.subjectProperty?.sqft ? `Sq Ft: ${context.subjectProperty.sqft.toLocaleString()}` : ''}

Market Analysis:
- ${context.comparables?.count || 0} comparable properties analyzed
${context.comparables?.avgPrice ? `- Average price: $${context.comparables.avgPrice.toLocaleString()}` : ''}
${context.comparables?.medianPrice ? `- Median price: $${context.comparables.medianPrice.toLocaleString()}` : ''}
${context.comparables?.avgPricePerSqft ? `- Avg price/sqft: $${context.comparables.avgPricePerSqft.toFixed(0)}` : ''}
${context.marketStats?.avgDOM ? `- Average days on market: ${context.marketStats.avgDOM}` : ''}

Return ONLY the cover letter text${hasClientName ? ' starting with the greeting' : ' with no salutation'}, no signature, no additional commentary.`;

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
      log.error({ err: error }, "AI cover letter generation error");
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
      log.error({ err: error }, "FUB contact fetch error");
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

  /**
   * GET /api/listings/:mlsNumber/ai-photos
   * Returns AI-selected photos for flyer builder using Repliers coverImage parameter
   * Uses Method 1 (coverImage) for optimal AI photo selection:
   * - Main Photo: coverImage=exterior front
   * - Kitchen Photo: coverImage=kitchen
   * - Room Photo: coverImage=living room
   */
  app.get("/api/listings/:mlsNumber/ai-photos", isAuthenticated, async (req, res) => {
    try {
      const { mlsNumber } = req.params;
      
      if (!mlsNumber) {
        return res.status(400).json({ message: "MLS number is required" });
      }
      
      log.info(`[AI Photos API] Fetching AI-selected photos for MLS# ${mlsNumber}`);
      
      const result = await getAISelectedPhotosForFlyer(mlsNumber);
      
      res.json({
        aiSelected: {
          mainPhoto: result.mainPhoto,
          kitchenPhoto: result.kitchenPhoto,
          roomPhoto: result.roomPhoto,
        },
        allPhotos: result.allPhotos,
        totalPhotos: result.totalPhotos,
        selectionMethod: result.selectionMethod,
      });
    } catch (error: any) {
      log.error({ err: error }, "[AI Photos API] Error");
      res.status(500).json({ message: error.message || "Failed to fetch AI-selected photos" });
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
              log.info(`Gmail watch set up for ${user.email}, historyId: ${watchResult.historyId}`);
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
          log.error({ err: error }, `Failed to create pending Gmail filter for transaction ${txn.id}`);
        }
      }
      
      res.json({ processed, message: `Created ${processed} pending Gmail filter(s)` });
    } catch (error) {
      log.error({ err: error }, "Error processing pending filters");
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
        log.info("FUB search: No FUB user ID found for agent, returning empty results");
        return res.json([]);
      }

      // Search contacts - filter by assigned user
      const contacts = await searchFUBContactsByAssignedUser(query, fubUserId);
      res.json(contacts);
    } catch (error) {
      log.error({ err: error }, "FUB search error");
      res.status(500).json({ message: "Failed to search FUB contacts" });
    }
  });

  // ============ Mapbox Token ============
  // Returns the Mapbox token for the property map
  app.get("/api/mapbox-token", isAuthenticated, (req, res) => {
    const token = process.env.MAPBOX_TOKEN;
    if (!token) {
      log.error('Mapbox token not found in environment');
      return res.status(500).json({ error: 'Mapbox token not configured' });
    }
    res.json({ token });
  });

  // ============ Mapbox Geocoding ============
  // Geocodes an address to get city/state information
  app.get("/api/mapbox-geocode", isAuthenticated, async (req, res) => {
    try {
      const token = process.env.MAPBOX_TOKEN;
      if (!token) {
        return res.status(500).json({ error: 'Mapbox token not configured' });
      }
      
      const { address, zipcode } = req.query;
      
      if (!address && !zipcode) {
        return res.status(400).json({ error: 'Address or zipcode is required' });
      }
      
      // Use address if available, otherwise use zipcode
      const searchQuery = encodeURIComponent(String(address || zipcode));
      const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${searchQuery}.json?access_token=${token}&country=us&limit=1`;
      
      const response = await fetch(geocodeUrl);
      if (!response.ok) {
        log.error({ status: response.status, statusText: response.statusText }, 'Mapbox geocoding failed');
        return res.status(response.status).json({ error: 'Geocoding failed' });
      }
      
      const data = await response.json();
      
      if (!data.features || data.features.length === 0) {
        return res.json({ city: null, state: null, found: false });
      }
      
      const feature = data.features[0];
      let city = null;
      let state = null;
      let zipCode = null;
      
      // Extract city, state, and zip from context
      if (feature.context) {
        for (const ctx of feature.context) {
          if (ctx.id.startsWith('place.')) {
            city = ctx.text;
          } else if (ctx.id.startsWith('region.')) {
            // Get state abbreviation from short_code (e.g., "US-TX" -> "TX")
            state = ctx.short_code?.replace('US-', '') || ctx.text;
          } else if (ctx.id.startsWith('postcode.')) {
            zipCode = ctx.text;
          }
        }
      }
      
      // If the feature itself is a place, use it as the city
      if (!city && feature.place_type?.includes('place')) {
        city = feature.text;
      }
      
      res.json({ 
        city, 
        state, 
        zipCode,
        found: !!(city || state),
        fullAddress: feature.place_name 
      });
    } catch (error) {
      log.error({ err: error }, 'Mapbox geocoding error');
      res.status(500).json({ error: 'Failed to geocode address' });
    }
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
      log.error({ err: error }, "Error generating maps embed");
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
      log.error({ err: error }, "Image proxy error");
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
      log.info({ body: JSON.stringify(req.body).substring(0, 500) }, 'Gmail webhook received');
      
      // Pub/Sub sends base64 encoded message data
      const message = req.body.message;
      if (!message?.data) {
        log.info("No message.data in webhook payload");
        return res.status(400).json({ message: "Invalid Pub/Sub message" });
      }

      // Decode the message
      const decoded = Buffer.from(message.data, "base64").toString("utf-8");
      const notification = JSON.parse(decoded);
      log.info({ data: notification }, "Decoded notification");
      
      // notification contains: { emailAddress, historyId }
      const userEmail = notification.emailAddress;
      const historyId = notification.historyId;
      
      if (!userEmail || !historyId) {
        log.info("Missing emailAddress or historyId in notification");
        return res.status(200).json({ message: "No email data in notification" });
      }

      log.info(`Processing Gmail notification for ${userEmail}, historyId: ${historyId}`);

      // Find transactions for this user that have Gmail labels
      const transactions = await storage.getTransactions();
      const userTransactions = transactions.filter(t => 
        t.userId && t.gmailLabelId && t.slackChannelId
      );
      
      log.info(`Found ${userTransactions.length} transactions with Gmail labels and Slack channels`);

      // For each transaction with a Gmail label, check for new messages
      for (const txn of userTransactions) {
        try {
          // Get the user who owns this transaction
          const owner = await authStorage.getUser(txn.userId!);
          if (owner?.email !== userEmail) continue;
          
          log.info(`Checking transaction ${txn.id} for ${txn.propertyAddress}`);
          
          const messages = await getNewMessages(userEmail, historyId, txn.gmailLabelId!);
          log.info(`Found ${messages.length} new messages for transaction ${txn.id}`);
          
          // Extract street pattern for subject line filtering
          const streetPattern = getStreetPatternFromAddress(txn.propertyAddress);
          
          for (const msg of messages) {
            // Skip if already processed
            if (processedMessageIds.has(msg.id)) {
              log.info(`Skipping already processed message ${msg.id}`);
              continue;
            }
            
            // Secondary filter: check if subject contains street number and street name
            if (streetPattern) {
              const subjectLower = msg.subject.toLowerCase();
              const hasStreetNumber = subjectLower.includes(streetPattern.streetNumber);
              const hasStreetName = subjectLower.includes(streetPattern.streetName.toLowerCase());
              
              if (!hasStreetNumber || !hasStreetName) {
                log.info(`Skipping email - subject "${msg.subject}" doesn't match "${streetPattern.streetNumber} ${streetPattern.streetName}"`);
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
            log.info(`Posting email to Slack channel ${txn.slackChannelId}`);
            const slackMessage = `*New email related to ${txn.propertyAddress}*\n\n*From:* ${msg.from}\n*Subject:* ${msg.subject}\n\n${msg.snippet}...`;
            await postToChannel(txn.slackChannelId!, slackMessage);
          }
        } catch (err) {
          log.error({ err: err }, "Error processing transaction emails");
        }
      }

      res.status(200).json({ message: "Processed" });
    } catch (error) {
      log.error({ err: error }, "Gmail webhook error");
      res.status(200).json({ message: "Error processed" }); // Return 200 to prevent retries
    }
  });

  // Test endpoint to debug Repliers API access
  app.get("/api/test-repliers", async (req, res) => {
    try {
      log.info("Testing Repliers API access...");
      const result = await testRepliersAccess();
      res.json(result);
    } catch (error: any) {
      log.error({ err: error }, "Repliers test error");
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
        log.error('REPLIERS_API_KEY not configured');
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

      log.info(`Fetching image insights for listing: ${listingId}`);

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
        log.error({ status: response.status, errorText }, 'Repliers API error');
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
        log.info(`Image Insights available: ${data.imageInsights.images.length} images analyzed`);
        
        const photos = data.photos || data.images || [];
        
        const result = {
          available: true,
          images: data.imageInsights.images.map((insight: any, index: number) => ({
            url: ensureFullUrl(insight.image || photos[index] || insight.url),
            originalIndex: index,
            classification: {
              imageOf: insight.classification?.imageOf || null,
              prediction: insight.classification?.prediction || null,
              confidence: insight.classification?.confidence || null,
            },
            quality: {
              quantitative: insight.quality?.quantitative || null,
              qualitative: insight.quality?.qualitative || null,
            },
          })),
        };
        
        // Cache successful result
        imageInsightsCache.set(listingId, { data: result, timestamp: Date.now() });
        
        return res.json(result);
      }
      
      // Fallback: Image Insights not enabled or no data - return photos without insights
      log.info('Image Insights not available for this listing, returning basic photos');
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
      log.error({ err: error }, 'Image insights fetch error');
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

      const response = await openaiCircuit.execute(() =>
        withTimeout(
          () => openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a real estate copywriter. Always write complete sentences. Never end with '...' or mid-thought. Count characters carefully." },
              { role: "user", content: prompt }
            ],
            max_tokens: 200,
            temperature: 0.7,
          }),
          30000,
          'openai-mls-summary'
        )
      );

      let summary = response.choices[0]?.message?.content?.trim() || "";
      
      // Post-process to ensure complete sentences and proper length
      summary = cleanupSummary(summary, maxLength);

      res.json({ summary });
    } catch (error: any) {
      log.error({ err: error }, "AI summarization error");
      
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
  app.post("/api/generate-social-tagline", generationLimiter, isAuthenticated, async (req, res) => {
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

      const response = await openaiCircuit.execute(() =>
        withTimeout(
          () => openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a professional real estate broker. Write punchy, professional taglines. Never use generic words like beautiful, nice, great, amazing. Never use clichés. Sound like a broker, not like AI. Max 70 characters." },
              { role: "user", content: prompt }
            ],
            max_tokens: 100,
            temperature: 0.8,
          }),
          30000,
          'openai-tagline'
        )
      );

      let tagline = response.choices[0]?.message?.content?.trim() || "";
      
      // Remove any surrounding quotes
      tagline = tagline.replace(/^["']|["']$/g, '');
      
      // Ensure it's within 80 characters
      if (tagline.length > 80) {
        tagline = tagline.slice(0, 80).trim();
      }

      res.json({ tagline });
    } catch (error: any) {
      log.error({ err: error }, "Social tagline generation error");
      res.status(500).json({ error: "Failed to generate tagline" });
    }
  });

  // ============ HTML/Puppeteer Flyer Generation ============
  app.post("/api/generate-flyer-html", generationLimiter, isAuthenticated, async (req, res) => {
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
      
      log.info({ data: address }, `Generating ${outputType} flyer for`);
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
      log.error({ err: error }, 'Flyer generation error');
      res.status(500).json({ error: 'Failed to generate flyer', details: error.message });
    }
  });

  // ============ Unified Flyer Render (PNG Preview or PDF) ============
  // This endpoint is the single source of truth for flyer rendering
  // Both preview and download use the SAME Puppeteer-rendered output
  app.post("/api/flyer/render", generationLimiter, isAuthenticated, async (req, res) => {
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
      log.info(`Unified flyer render: ${validOutputType} for ${address}`);
      
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
      log.error({ err: error }, 'Unified flyer render error');
      res.status(500).json({ error: 'Failed to render flyer', details: error.message });
    }
  });

  // ============ Flyer Generator AI Headline ============
  app.post("/api/flyer/generate-headline", generationLimiter, isAuthenticated, async (req, res) => {
    try {
      const { propertyData } = req.body;

      if (!propertyData) {
        return res.status(400).json({ error: "Property data is required" });
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const prompt = `Generate a compelling, professional real estate flyer headline for this property. 
The headline should be attention-grabbing, highlight key features, and be suitable for marketing materials.
Keep it under 60 characters. Do not use quotes around the headline.

Property Details:
- Location: ${propertyData.city || 'Unknown'}, ${propertyData.state || 'TX'}
- Beds: ${propertyData.beds || 'N/A'}
- Baths: ${propertyData.baths || 'N/A'}
- Sqft: ${propertyData.sqft || 'N/A'}
- Property Type: ${propertyData.propertyType || 'Residential'}
- Neighborhood: ${propertyData.neighborhood || 'N/A'}
- Year Built: ${propertyData.yearBuilt || 'N/A'}
- Price: ${propertyData.price ? '$' + Number(propertyData.price).toLocaleString() : 'N/A'}
- Description snippet: ${propertyData.description?.substring(0, 200) || 'N/A'}

Generate only the headline, nothing else.`;

      const completion = await openaiCircuit.execute(() =>
        withTimeout(
          () => openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'system',
                content: 'You are a professional real estate copywriter. Generate compelling, concise headlines for property flyers.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
            max_tokens: 100,
            temperature: 0.7,
          }),
          30000,
          'openai-flyer-headline'
        )
      );

      const headline = completion.choices[0]?.message?.content?.trim() || 'Beautiful Home in Prime Location';

      res.json({ headline });
    } catch (error: any) {
      log.error({ err: error }, 'AI headline generation error');
      res.status(500).json({ error: 'Failed to generate headline' });
    }
  });

  // ============ Flyer Generator Export ============
  app.post("/api/transactions/:id/export-flyer", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const format = req.query.format as string || 'png';
      const saveOnly = req.query.saveOnly === 'true';
      const postToSlack = req.query.postToSlack === 'true';
      const data = req.body;

      // Validate transaction exists
      const transaction = await storage.getTransaction(id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // Default image transforms (no transform applied)
      const defaultTransform = { scale: 1, positionX: 0, positionY: 0 };
      const imageTransforms = data.imageTransforms || {
        mainImage: defaultTransform,
        kitchenImage: defaultTransform,
        roomImage: defaultTransform,
        agentPhoto: defaultTransform,
      };

      // Build full address with city, state, zip
      const addressParts = [data.address];
      const cityStateZip = [data.city, data.state, data.zip].filter(Boolean).join(', ');
      if (cityStateZip) {
        addressParts.push(cityStateZip);
      }
      const fullAddressStr = addressParts.filter(Boolean).join(', ');

      // Build flyer data for the generator - map form fields to generator interface
      const flyerData: FlyerData = {
        priceLabel: 'Offered at',
        price: data.price || '',
        fullAddress: fullAddressStr,
        bedrooms: data.bedrooms || '',
        bathrooms: data.bathrooms || '',
        sqft: data.sqft || '',
        headline: data.introHeading || 'Prime Opportunity',
        description: data.introDescription || '',
        agentName: data.agentName || '',
        agentTitle: data.agentTitle || 'REALTOR®',
        agentPhone: data.phone || '',
        mainImage: data.mainImage || undefined,
        secondaryImage1: data.kitchenImage || undefined,
        secondaryImage2: data.roomImage || undefined,
        agentPhoto: data.agentPhoto || undefined,
        qrCodeUrl: data.qrCode || undefined,
        // Logos and branding controls
        logoUrl: data.companyLogo || undefined,
        secondaryLogoUrl: data.secondaryLogo || undefined,
        logoScales: data.logoScales || { primary: 1, secondary: 1 },
        dividerPosition: data.dividerPosition || 148,
        secondaryLogoOffsetY: data.secondaryLogoOffsetY || 0,
        // Image transforms for cropping/positioning
        imageTransforms,
      };

      log.info(`[FlyerGenerator] ${saveOnly ? 'Saving' : 'Exporting'} ${format} flyer for transaction ${id}`);

      const outputType: OutputType = format === 'cmyk' ? 'pdf' : 'pngPreview';
      const buffer = await generatePrintFlyer(flyerData, outputType);

      const addressSlug = (data.address || 'property').split(',')[0].replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');

      // Save to marketing assets (only on export or when saveOnly is true)
      if (saveOnly) {
        const userId = req.user?.claims?.sub;
        await storage.createMarketingAsset({
          transactionId: id,
          type: 'flyer',
          imageData: `data:image/png;base64,${buffer.toString('base64')}`,
          fileName: `${addressSlug}_flyer_${Date.now()}.png`,
          metadata: { format, createdBy: userId, flyerData: data },
        });
        log.info(`[FlyerGenerator] Saved flyer to marketing assets`);
        return res.json({ success: true, message: 'Flyer saved to My Assets' });
      }

      // For regular export, also save to assets
      try {
        const userId = req.user?.claims?.sub;
        await storage.createMarketingAsset({
          transactionId: id,
          type: 'flyer',
          imageData: `data:image/png;base64,${buffer.toString('base64')}`,
          fileName: `${addressSlug}_flyer.${format === 'cmyk' ? 'pdf' : 'png'}`,
          metadata: { format, createdBy: userId, flyerData: data },
        });
        log.info(`[FlyerGenerator] Saved flyer to marketing assets`);
        
        // Send Slack notification if postToSlack is true and transaction has Slack channel
        log.info(`[FlyerGenerator] postToSlack=${postToSlack}, slackChannelId=${transaction.slackChannelId}`);
        if (postToSlack && transaction.slackChannelId) {
          try {
            const userId = req.user?.claims?.sub;
            let shouldNotify = true;
            
            if (userId) {
              const userPrefs = await storage.getUserNotificationPreferences(userId);
              shouldNotify = userPrefs?.notifyMarketingAssets ?? true;
              log.info(`[FlyerGenerator] User ${userId} notifyMarketingAssets=${shouldNotify}`);
            }
            
            if (shouldNotify) {
              const address = transaction.propertyAddress || data.address || 'Unknown Property';
              const createdBy = req.user?.claims?.email || 'Unknown User';
              log.info(`[FlyerGenerator] Sending Slack notification for flyer: ${address}`);
              await sendMarketingNotification(
                transaction.slackChannelId,
                address,           // propertyAddress
                'flyer',           // assetType
                createdBy,         // createdBy
                `data:image/png;base64,${buffer.toString('base64')}`,  // imageData
                `${addressSlug}_flyer.png`  // fileName
              );
              log.info(`[FlyerGenerator] Posted flyer to Slack channel ${transaction.slackChannelId}`);
            } else {
              log.info(`[FlyerGenerator] Slack notification skipped - user preference disabled`);
            }
          } catch (slackError: any) {
            log.error({ err: slackError }, '[FlyerGenerator] Failed to post to Slack');
            // Don't fail the export just because Slack failed
          }
        } else {
          log.info(`[FlyerGenerator] Slack notification skipped - postToSlack=${postToSlack}, hasChannel=${!!transaction.slackChannelId}`);
        }
      } catch (saveError: any) {
        log.error({ err: saveError }, '[FlyerGenerator] Failed to save to marketing assets');
      }

      if (format === 'cmyk') {
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="${addressSlug}_flyer_cmyk.pdf"`);
      } else {
        res.set('Content-Type', 'image/png');
        res.set('Content-Disposition', `attachment; filename="${addressSlug}_flyer.png"`);
      }

      res.send(buffer);
    } catch (error: any) {
      log.error({ err: error }, '[FlyerGenerator] Export error');
      res.status(500).json({ error: 'Failed to export flyer', details: error.message });
    }
  });

  // ============ Social Media Graphics Render ============
  app.post("/api/graphics/render", generationLimiter, isAuthenticated, async (req, res) => {
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

      log.info(`Graphics render: ${format} for ${address}`);
      
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
      log.error({ err: error }, 'Graphics render error');
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

      const response = await openaiCircuit.execute(() =>
        withTimeout(
          () => openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a real estate marketing expert. Return only the headline text, no quotes or explanation. Match the tone to the property status." },
              { role: "user", content: prompt }
            ],
            max_tokens: 60,
            temperature: 0.8,
          }),
          30000,
          'openai-social-headline'
        )
      );

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
      log.error({ err: error }, "Error generating headline");
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
      log.error({ err: error }, "Error getting notification settings");
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
      log.error({ err: error }, "Error updating notification settings");
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
      log.error({ err: error }, "Error triggering reminder check");
      res.status(500).json({ message: "Failed to trigger reminder check" });
    }
  });

  // Get notification system status
  app.get("/api/admin/notifications/status", isAuthenticated, async (req: any, res) => {
    try {
      const { getCronStatus } = await import("./cron/notificationCron");
      res.json(getCronStatus());
    } catch (error) {
      log.error({ err: error }, "Error getting notification status");
      res.status(500).json({ message: "Failed to get notification status" });
    }
  });

  // Slack diagnostics endpoint - READ ONLY
  app.get("/api/admin/slack-diagnostics", isAuthenticated, async (req: any, res) => {
    try {
      const { runSlackDiagnostics, formatDiagnosticsReport } = await import("./diagnostics/slack-diagnostics");
      const diagnostics = await runSlackDiagnostics();
      
      // Check if client wants formatted text output
      const format = req.query.format;
      if (format === 'text') {
        const report = formatDiagnosticsReport(diagnostics);
        res.type('text/plain').send(report);
      } else {
        res.json(diagnostics);
      }
    } catch (error) {
      log.error({ err: error }, "Error running Slack diagnostics");
      res.status(500).json({ message: "Failed to run diagnostics", error: String(error) });
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
      log.error({ err: error }, "Error sending test notification");
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
      log.error({ err: error }, "[Agent Profile] Error fetching");
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
      log.error({ err: error }, "[Agent Profile] Error updating");
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
        systemPrompt = `You are an expert real estate marketing copywriter for Spyglass Realty, a premier Austin real estate brokerage. Your task is to enhance and improve an existing cover letter for a CMA (Comparative Market Analysis) report. The tone should be ${toneDescriptions[tone]}.`;

        userPrompt = `Please enhance and improve this cover letter for ${agentName}${agentProfile?.title ? `, ${agentProfile.title}` : ''} at Spyglass Realty:

EXISTING COVER LETTER:
${existingCoverLetter}

${agentProfile?.bio ? `AGENT BIO FOR CONTEXT:\n${agentProfile.bio}\n` : ''}

IMPORTANT REQUIREMENTS:
1. DO NOT include any salutation like "Dear..." or client name placeholder - the greeting will be added separately when used
2. Start directly with the body content (e.g., "Thank you for the opportunity..." or "I'm pleased to present...")
3. Improve the writing quality and flow
4. Make it more ${tone}
5. Keep it concise (2-3 paragraphs)
6. Maintain focus on CMA value proposition and Spyglass Realty's commitment to exceptional service
7. End with a call to action but do NOT include signature

Return ONLY the improved cover letter body text, no salutation, no signature, no additional commentary.`;
      } else {
        systemPrompt = `You are an expert real estate marketing copywriter for Spyglass Realty, a premier Austin real estate brokerage known for exceptional client service and market expertise. Create a compelling cover letter template for CMA (Comparative Market Analysis) reports. The tone should be ${toneDescriptions[tone]}.`;

        userPrompt = `Create a default cover letter template for ${agentName}${agentProfile?.title ? `, ${agentProfile.title}` : ''} at Spyglass Realty.

${agentProfile?.bio ? `AGENT BIO:\n${agentProfile.bio}\n` : ''}

IMPORTANT REQUIREMENTS:
1. DO NOT include any salutation like "Dear..." - the client name greeting will be added separately in the Presentation Builder when a specific CMA is created
2. Start directly with the body content (e.g., "Thank you for the opportunity..." or "I'm pleased to present...")
3. 2-3 paragraphs maximum
4. Explain the value of the CMA and what insights it provides
5. ${tone === 'professional' ? 'Maintain formal business tone' : tone === 'friendly' ? 'Be warm and approachable' : 'Project confidence and expertise'}
6. Reflect Spyglass Realty's commitment to exceptional service and market expertise
7. End with offer to discuss further
8. Do NOT include signature (that's added separately)

Return ONLY the cover letter body text, no salutation, no signature, no additional commentary.`;
      }

      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const completion = await openaiCircuit.execute(() =>
        withTimeout(
          () => openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
          30000,
          'openai-cover-letter'
        )
      );

      const coverLetter = completion.choices[0]?.message?.content?.trim() || '';

      res.json({ coverLetter, mode: isEnhancing ? 'enhanced' : 'generated' });
    } catch (error: any) {
      log.error({ err: error }, "[AI Cover Letter] Error");
      res.status(500).json({ error: "Failed to generate cover letter" });
    }
  });

  // ============ Agent Marketing Profile ============

  // Get marketing profile for the current user
  app.get("/api/settings/marketing-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const profile = await storage.getAgentMarketingProfile(userId);

      // Return profile or default values
      res.json(profile || {
        agentPhoto: null,
        agentTitle: 'REALTOR®',
        qrCode: null,
        companyLogo: null,
        companyLogoUseDefault: true,
        secondaryLogo: null,
        secondaryLogoUseDefault: true,
      });
    } catch (error: any) {
      log.error({ err: error }, "[Marketing Profile] Error fetching");
      res.status(500).json({ error: "Failed to fetch marketing profile" });
    }
  });

  // Save marketing profile for the current user
  app.post("/api/settings/marketing-profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const {
        agentPhoto,
        agentTitle,
        qrCode,
        companyLogo,
        companyLogoUseDefault,
        secondaryLogo,
        secondaryLogoUseDefault,
      } = req.body;

      // Server-side validation for base64 images
      const MAX_BASE64_SIZE = 7 * 1024 * 1024; // 7MB limit for base64 (accounts for ~33% overhead)
      const VALID_DATA_URI_PREFIX = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/;

      const validateBase64Image = (base64: string | null, fieldName: string): string | null => {
        if (!base64) return null;
        if (typeof base64 !== 'string') {
          throw new Error(`${fieldName} must be a string`);
        }
        if (base64.length > MAX_BASE64_SIZE) {
          throw new Error(`${fieldName} exceeds maximum size (5MB)`);
        }
        if (!VALID_DATA_URI_PREFIX.test(base64)) {
          throw new Error(`${fieldName} must be a valid image data URI (jpeg, png, gif, or webp)`);
        }
        return base64;
      };

      // Validate all image fields
      const validatedAgentPhoto = validateBase64Image(agentPhoto, 'agentPhoto');
      const validatedQrCode = validateBase64Image(qrCode, 'qrCode');
      const validatedCompanyLogo = validateBase64Image(companyLogo, 'companyLogo');
      const validatedSecondaryLogo = validateBase64Image(secondaryLogo, 'secondaryLogo');

      // Validate agentTitle
      const validatedAgentTitle = typeof agentTitle === 'string' && agentTitle.length <= 100 
        ? agentTitle 
        : 'REALTOR®';

      const profile = await storage.upsertAgentMarketingProfile(userId, {
        agentPhoto: validatedAgentPhoto,
        agentTitle: validatedAgentTitle,
        qrCode: validatedQrCode,
        companyLogo: validatedCompanyLogo,
        companyLogoUseDefault: companyLogoUseDefault ?? true,
        secondaryLogo: validatedSecondaryLogo,
        secondaryLogoUseDefault: secondaryLogoUseDefault ?? true,
      });

      res.json(profile);
    } catch (error: any) {
      log.error({ err: error }, "[Marketing Profile] Error saving");
      if (error.message.includes('must be') || error.message.includes('exceeds')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to save marketing profile" });
    }
  });

  // ============ Agent Resources ============

  // Get all resources for the current user
  app.get("/api/agent/resources", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const resources = await storage.getAgentResources(userId);
      res.json(resources);
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error fetching");
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  // Create a new resource
  app.post("/api/agent/resources", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { name, type, url, fileUrl, fileName, fileData, fileMimeType } = req.body;

      if (!name || !type) {
        return res.status(400).json({ error: "Name and type are required" });
      }

      if (!['link', 'file'].includes(type)) {
        return res.status(400).json({ error: "Type must be 'link' or 'file'" });
      }

      const resource = await storage.createAgentResource({
        userId,
        name,
        type,
        url: url || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileData: fileData || null,
        fileMimeType: fileMimeType || null,
        isActive: true,
      });

      res.json(resource);
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error creating");
      res.status(500).json({ error: "Failed to create resource" });
    }
  });

  // Update a resource
  app.patch("/api/agent/resources/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;
      const { name, url, isActive, fileData, fileMimeType } = req.body;

      // Verify ownership
      const existing = await storage.getAgentResource(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Resource not found" });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (url !== undefined) updateData.url = url;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (fileData !== undefined) updateData.fileData = fileData;
      if (fileMimeType !== undefined) updateData.fileMimeType = fileMimeType;

      const updated = await storage.updateAgentResource(id, updateData);
      res.json(updated);
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error updating");
      res.status(500).json({ error: "Failed to update resource" });
    }
  });

  // Delete a resource
  app.delete("/api/agent/resources/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      // Verify ownership
      const existing = await storage.getAgentResource(id);
      if (!existing || existing.userId !== userId) {
        return res.status(404).json({ error: "Resource not found" });
      }

      await storage.deleteAgentResource(id);
      res.json({ success: true });
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error deleting");
      res.status(500).json({ error: "Failed to delete resource" });
    }
  });

  // Reorder resources
  app.patch("/api/agent/resources/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { orderedIds } = req.body;

      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ error: "orderedIds must be an array" });
      }

      await storage.reorderAgentResources(userId, orderedIds);
      res.json({ success: true });
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error reordering");
      res.status(500).json({ error: "Failed to reorder resources" });
    }
  });

  // Serve file from database storage (public access for CMA viewers)
  app.get("/api/agent/resources/:id/file", async (req: any, res) => {
    try {
      const { id } = req.params;
      const resource = await storage.getAgentResource(id);
      
      if (!resource || !resource.fileData) {
        return res.status(404).json({ error: "File not found" });
      }

      // Parse base64 data URI
      const matches = resource.fileData.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(500).json({ error: "Invalid file data format" });
      }

      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${resource.fileName || 'document'}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error serving file");
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // Upload file for resource
  app.post("/api/agent/resources/upload", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id || req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Handle multipart upload
      const multer = (await import("multer")).default;
      const upload = multer({ storage: multer.memoryStorage() });

      // Use single file upload middleware
      upload.single('file')(req, res, async (err: unknown) => {
        if (err) {
          log.error({ err: err }, "[Agent Resources] Upload error");
          return res.status(400).json({ error: "File upload failed" });
        }

        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(req.file.mimetype)) {
          return res.status(400).json({ error: "Only PDF and Word documents are allowed" });
        }

        // Validate file size (max 10MB for database storage)
        const maxSize = 10 * 1024 * 1024; // 10MB limit for database storage
        if (req.file.size > maxSize) {
          return res.status(400).json({ error: "File size must be less than 10MB" });
        }

        try {
          // Convert file buffer to base64 for database storage
          const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
          
          // Return the file data to be stored with the resource
          res.json({
            fileData: base64Data,
            fileName: req.file.originalname,
            fileMimeType: req.file.mimetype,
          });
        } catch (uploadErr: any) {
          log.error({ err: uploadErr }, "[Agent Resources] Storage upload error");
          res.status(500).json({ error: "Failed to process file" });
        }
      });
    } catch (error: any) {
      log.error({ err: error }, "[Agent Resources] Error uploading");
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // ============ User Notification Preferences ============

  // GET user notification preferences
  app.get("/api/user/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      let prefs = await storage.getUserNotificationPreferences(userId);
      
      // Return defaults if no preferences exist yet
      if (!prefs) {
        return res.json({
          userId,
          notifyDocumentUploads: false,
          notifyClosingReminders: false,
          notifyMarketingAssets: false,
        });
      }
      
      res.json(prefs);
    } catch (error) {
      log.error({ err: error }, "Error fetching notification preferences");
      res.status(500).json({ message: "Failed to fetch notification preferences" });
    }
  });

  // PUT update user notification preferences
  app.put("/api/user/notification-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Validate request body with Zod schema
      const { updateUserNotificationPreferencesSchema } = await import("@shared/schema");
      const validationResult = updateUserNotificationPreferencesSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request body",
          errors: validationResult.error.errors 
        });
      }
      
      const prefs = await storage.upsertUserNotificationPreferences(userId, validationResult.data);
      res.json(prefs);
    } catch (error) {
      log.error({ err: error }, "Error updating notification preferences");
      res.status(500).json({ message: "Failed to update notification preferences" });
    }
  });

  // ============ CMA PDF Data Audit (Diagnostic) ============
  
  function calculateAuditScore(checks: boolean[]): string {
    const passed = checks.filter(Boolean).length;
    const total = checks.length;
    const percentage = Math.round((passed / total) * 100);
    return `${passed}/${total} (${percentage}%)`;
  }

  app.get('/api/debug/cma-pdf-audit/:transactionId', isAuthenticated, async (req, res) => {
    const { transactionId } = req.params;
    
    try {
      // 1. TRANSACTION DATA
      const transaction = await storage.getTransaction(transactionId);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      
      // 2. CMA/COMPARABLES DATA
      const cmaData = transaction?.cmaData;
      const comparables = Array.isArray(cmaData) ? cmaData : [];
      
      // 3. AGENT/USER DATA
      const userId = transaction?.userId;
      const user = userId ? await authStorage.getUser(userId) : null;
      const agentProfile = userId ? await storage.getAgentProfile(userId) : null;
      
      // 4. MLS DATA
      const mlsData = transaction?.mlsData as any;
      
      // Build comprehensive audit report
      const audit = {
        // === TRANSACTION ===
        transaction: {
          exists: !!transaction,
          id: transaction?.id,
          address: transaction?.propertyAddress,
          mlsNumber: transaction?.mlsNumber,
          status: transaction?.status,
          listPrice: transaction?.listPrice,
          closingDate: transaction?.closingDate,
          contractDate: transaction?.contractDate,
        },
        
        // === AGENT PROFILE ===
        agent: {
          exists: !!agentProfile,
          name: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null,
          email: user?.email,
          headshotUrl: agentProfile?.headshotUrl,
          bio: agentProfile?.bio,
          title: agentProfile?.title,
          company: agentProfile?.marketingCompany,
          // What's missing
          missing: {
            name: !user?.firstName,
            photo: !agentProfile?.headshotUrl,
            bio: !agentProfile?.bio,
          }
        },
        
        // === MLS DATA (Subject Property) ===
        mlsData: {
          exists: !!mlsData,
          address: mlsData?.address || mlsData?.unparsedAddress,
          city: mlsData?.city,
          state: mlsData?.state,
          zip: mlsData?.zip || mlsData?.postalCode,
          listPrice: mlsData?.listPrice,
          beds: mlsData?.beds || mlsData?.bedroomsTotal,
          baths: mlsData?.baths || mlsData?.bathroomsTotalInteger,
          sqft: mlsData?.sqft || mlsData?.livingArea,
          lotSize: mlsData?.lotSize || mlsData?.lotSizeAcres || mlsData?.lot?.acres,
          yearBuilt: mlsData?.yearBuilt,
          propertyType: mlsData?.propertyType,
          description: mlsData?.description || mlsData?.publicRemarks,
          // Photos
          photos: {
            count: mlsData?.images?.length || mlsData?.photos?.length || 0,
            firstPhotoUrl: mlsData?.images?.[0] || mlsData?.photos?.[0] || mlsData?.primaryPhoto,
            hasPhotos: (mlsData?.images?.length || mlsData?.photos?.length || 0) > 0,
          },
          // Location
          coordinates: {
            latitude: mlsData?.coordinates?.latitude || mlsData?.latitude || mlsData?.map?.latitude,
            longitude: mlsData?.coordinates?.longitude || mlsData?.longitude || mlsData?.map?.longitude,
            hasCoordinates: !!(
              (mlsData?.coordinates?.latitude && mlsData?.coordinates?.longitude) ||
              (mlsData?.latitude && mlsData?.longitude) ||
              (mlsData?.map?.latitude && mlsData?.map?.longitude)
            ),
          },
        },
        
        // === COMPARABLES ===
        comparables: {
          count: comparables.length,
          source: 'repliers',
          
          // Audit each comparable
          items: comparables.slice(0, 5).map((comp: any, index: number) => ({
            index,
            address: comp.address || comp.unparsedAddress || `${comp.streetNumber} ${comp.streetName}`,
            city: comp.city,
            state: comp.state,
            mlsNumber: comp.mlsNumber,
            
            // Price fields available
            priceFields: {
              price: comp.price,
              listPrice: comp.listPrice,
              soldPrice: comp.soldPrice,
              closePrice: comp.closePrice,
              hasAnyPrice: !!(comp.price || comp.listPrice || comp.soldPrice || comp.closePrice),
            },
            
            // Property details
            details: {
              beds: comp.beds || comp.bedroomsTotal,
              baths: comp.baths || comp.bathroomsTotalInteger,
              sqft: comp.sqft || comp.livingArea,
              lotSize: comp.lotSize || comp.lotSizeAcres || comp.lot?.acres,
              yearBuilt: comp.yearBuilt,
              status: comp.status || comp.standardStatus,
            },
            
            // Days on market
            dom: {
              dom: comp.dom,
              daysOnMarket: comp.daysOnMarket,
              cumulativeDom: comp.cumulativeDom,
              simpleDaysOnMarket: comp.simpleDaysOnMarket,
              hasDOM: !!(comp.dom || comp.daysOnMarket || comp.cumulativeDom || comp.simpleDaysOnMarket),
            },
            
            // Photos
            photos: {
              count: comp.images?.length || comp.photos?.length || 0,
              primaryPhoto: comp.images?.[0] || comp.photos?.[0] || comp.primaryPhoto,
              hasPhotos: (comp.images?.length || comp.photos?.length || 0) > 0 || !!comp.primaryPhoto,
            },
            
            // Location
            coordinates: {
              latitude: comp.latitude || comp.map?.latitude,
              longitude: comp.longitude || comp.map?.longitude,
              hasCoordinates: !!(
                (comp.latitude && comp.longitude) ||
                (comp.map?.latitude && comp.map?.longitude)
              ),
            },
          })),
          
          // Summary stats
          summary: {
            total: comparables.length,
            withPrices: comparables.filter((c: any) => c.price || c.listPrice || c.soldPrice || c.closePrice).length,
            withPhotos: comparables.filter((c: any) => (c.images?.length || c.photos?.length) > 0 || c.primaryPhoto).length,
            withDOM: comparables.filter((c: any) => c.dom || c.daysOnMarket || c.cumulativeDom || c.simpleDaysOnMarket).length,
            withCoordinates: comparables.filter((c: any) => 
              (c.latitude && c.longitude) || (c.map?.latitude && c.map?.longitude)
            ).length,
            withSqft: comparables.filter((c: any) => c.sqft || c.livingArea).length,
          },
        },
        
        // === PDF READINESS SCORE ===
        readiness: {
          agent: {
            score: calculateAuditScore([
              !!user?.firstName,
              !!agentProfile?.headshotUrl,
              !!agentProfile?.bio,
            ]),
            issues: [] as string[],
          },
          comparables: {
            score: calculateAuditScore([
              comparables.length >= 3,
              comparables.filter((c: any) => c.price || c.listPrice || c.soldPrice).length === comparables.length,
              comparables.filter((c: any) => (c.images?.length || c.photos?.length) > 0).length > 0,
            ]),
            issues: [] as string[],
          },
          subject: {
            score: calculateAuditScore([
              !!mlsData?.address || !!mlsData?.unparsedAddress,
              !!mlsData?.listPrice,
              (mlsData?.images?.length || mlsData?.photos?.length || 0) > 0,
              !!(
                (mlsData?.coordinates?.latitude && mlsData?.coordinates?.longitude) ||
                (mlsData?.latitude && mlsData?.longitude) ||
                (mlsData?.map?.latitude && mlsData?.map?.longitude)
              ),
            ]),
            issues: [] as string[],
          },
        },
      };
      
      // Add issues to readiness
      if (!audit.agent.name) {
        audit.readiness.agent.issues.push('Agent name missing');
      }
      if (!audit.agent.headshotUrl) {
        audit.readiness.agent.issues.push('Agent photo missing');
      }
      if (!audit.agent.bio) {
        audit.readiness.agent.issues.push('Agent bio missing');
      }
      
      if (audit.comparables.summary.withPrices < audit.comparables.count) {
        audit.readiness.comparables.issues.push(`${audit.comparables.count - audit.comparables.summary.withPrices} comparables missing price data`);
      }
      if (audit.comparables.summary.withPhotos === 0) {
        audit.readiness.comparables.issues.push('No comparable photos available');
      }
      if (audit.comparables.summary.withCoordinates < audit.comparables.count) {
        audit.readiness.comparables.issues.push(`${audit.comparables.count - audit.comparables.summary.withCoordinates} comparables missing coordinates`);
      }
      
      if (!audit.mlsData.address) {
        audit.readiness.subject.issues.push('Subject property address missing');
      }
      if (!audit.mlsData.listPrice) {
        audit.readiness.subject.issues.push('Subject property list price missing');
      }
      if (!audit.mlsData.photos.hasPhotos) {
        audit.readiness.subject.issues.push('Subject property photos missing');
      }
      if (!audit.mlsData.coordinates.hasCoordinates) {
        audit.readiness.subject.issues.push('Subject property coordinates missing');
      }
      
      res.json(audit);
      
    } catch (error: any) {
      log.error({ err: error }, "Error in CMA PDF audit");
      res.status(500).json({ error: error.message });
    }
  });

  // ============ Flyers (Protected) ============

  // Helper to get base URL for flyer links
  function getBaseUrl(req: any): string {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return `${protocol}://${host}`;
  }

  // Helper to generate QR code for a flyer URL
  async function generateFlyerQRCode(flyerUrl: string): Promise<string> {
    return QRCode.toDataURL(flyerUrl, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });
  }

  // Create a new flyer
  app.post("/api/flyers", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Generate a unique short ID for the flyer URL
      const flyerId = nanoid(9);
      
      // Build flyer data with required fields
      const flyerPayload = {
        id: flyerId,
        userId: userId,
        propertyAddress: req.body.propertyAddress || '',
        propertyCity: req.body.propertyCity,
        propertyState: req.body.propertyState,
        propertyZip: req.body.propertyZip,
        listPrice: req.body.listPrice,
        bedrooms: req.body.bedrooms,
        bathrooms: req.body.bathrooms,
        squareFeet: req.body.squareFeet,
        headline: req.body.headline,
        description: req.body.description,
        mainPhoto: req.body.mainPhoto,
        kitchenPhoto: req.body.kitchenPhoto,
        roomPhoto: req.body.roomPhoto,
        additionalPhotos: req.body.additionalPhotos || [],
        agentName: req.body.agentName,
        agentTitle: req.body.agentTitle,
        agentPhone: req.body.agentPhone,
        agentEmail: req.body.agentEmail,
        agentPhoto: req.body.agentPhoto,
        companyLogo: req.body.companyLogo,
        secondaryLogo: req.body.secondaryLogo,
        logoScales: req.body.logoScales || { primary: 1, secondary: 1 },
        dividerPosition: req.body.dividerPosition || 148,
        secondaryLogoOffsetY: req.body.secondaryLogoOffsetY || 0,
        transactionId: req.body.transactionId,
        mlsNumber: req.body.mlsNumber,
        status: 'active',
      };

      // Validate with Zod schema
      const validationResult = insertFlyerSchema.safeParse(flyerPayload);
      if (!validationResult.success) {
        log.error({ validationErrors: validationResult.error.flatten() }, 'Flyer validation error');
        return res.status(400).json({ 
          error: "Invalid flyer data", 
          details: validationResult.error.flatten().fieldErrors 
        });
      }

      const flyer = await storage.createFlyer(validationResult.data);
      
      // Generate the flyer URL and QR code
      const baseUrl = getBaseUrl(req);
      const flyerUrl = `${baseUrl}/flyer/${flyer.id}`;
      const qrCode = await generateFlyerQRCode(flyerUrl);

      log.info(`[Flyer] Created flyer ${flyer.id} for user ${userId}`);

      res.json({
        success: true,
        flyer,
        flyerId: flyer.id,
        flyerUrl,
        qrCode,
      });
    } catch (error: any) {
      log.error({ err: error }, "[Flyer] Create error");
      res.status(500).json({ error: "Failed to create flyer" });
    }
  });

  // Get user's flyers
  app.get("/api/flyers", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).user;
      const userId = user?.id || user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const userFlyers = await storage.getFlyersByUser(userId);
      res.json(userFlyers);
    } catch (error: any) {
      log.error({ err: error }, "[Flyer] Get user flyers error");
      res.status(500).json({ error: "Failed to get flyers" });
    }
  });

  // Regenerate QR code for existing flyer
  app.get("/api/flyers/:id/qr", isAuthenticated, async (req, res) => {
    try {
      const baseUrl = getBaseUrl(req);
      const flyerUrl = `${baseUrl}/flyer/${req.params.id}`;
      const qrCode = await generateFlyerQRCode(flyerUrl);
      res.json({ qrCode, flyerUrl });
    } catch (error: any) {
      log.error({ err: error }, "[Flyer] Generate QR error");
      res.status(500).json({ error: "Failed to generate QR" });
    }
  });

  // ============ Public Flyer Routes (NO AUTH) ============

  // Get flyer for public viewing - NO AUTH REQUIRED
  app.get("/api/public/flyer/:id", async (req, res) => {
    try {
      const flyer = await storage.getFlyer(req.params.id);
      
      if (!flyer || flyer.status !== 'active') {
        return res.status(404).json({ error: "Flyer not found" });
      }
      
      // Track view asynchronously
      storage.incrementFlyerViews(req.params.id).catch(err => log.error({ err }, 'Async operation failed'));
      
      res.json(flyer);
    } catch (error: any) {
      log.error({ err: error }, "[Flyer] Public get error");
      res.status(500).json({ error: "Failed to load flyer" });
    }
  });

  return httpServer;
}
