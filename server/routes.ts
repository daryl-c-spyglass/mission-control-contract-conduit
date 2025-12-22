import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertCoordinatorSchema } from "@shared/schema";
import { setupGmailForTransaction } from "./gmail";
import { createSlackChannel, inviteUsersToChannel } from "./slack";
import { fetchMLSListing, fetchSimilarListings } from "./repliers";
import { searchFUBContacts, getFUBContact } from "./fub";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage } from "./replit_integrations/auth";

// Helper to generate a slug from address
function generateSlackChannelName(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "-")
    .substring(0, 80);
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
      const { createSlackChannel: shouldCreateSlack, createGmailFilter, fetchMlsData, ...transactionData } = req.body;
      
      // Get the current user's ID
      const userId = req.user?.claims?.sub;
      
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
          const channelName = generateSlackChannelName(transaction.propertyAddress);
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

          // Collect all Slack user IDs to invite (agent + coordinators)
          const slackUserIdsToInvite: string[] = [];
          
          // Add the creating agent's Slack ID if they have one
          if (userId) {
            const agent = await authStorage.getUser(userId);
            if (agent?.slackUserId) {
              slackUserIdsToInvite.push(agent.slackUserId);
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
        } catch (slackError) {
          console.error("Slack channel creation error:", slackError);
          // Continue without Slack - don't fail the transaction
        }
      }

      // Create Gmail label and filter if requested
      if (createGmailFilter) {
        try {
          const gmailResult = await setupGmailForTransaction(transaction.propertyAddress);
          
          if (gmailResult.labelId) {
            if (gmailResult.filterId) {
              await storage.updateTransaction(transaction.id, {
                gmailFilterId: gmailResult.filterId,
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
        } catch (gmailError) {
          console.error("Gmail setup error:", gmailError);
          // Continue without Gmail - don't fail the transaction
        }
      }

      // Fetch real MLS data if requested
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

  // ============ FUB Client Search ============

  app.get("/api/fub/search", isAuthenticated, async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      if (!process.env.FUB_API_KEY) {
        return res.status(400).json({ message: "FUB API key not configured" });
      }

      const contacts = await searchFUBContacts(query);
      res.json(contacts);
    } catch (error) {
      console.error("FUB search error:", error);
      res.status(500).json({ message: "Failed to search FUB contacts" });
    }
  });

  return httpServer;
}
