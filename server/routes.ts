import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertTransactionSchema, insertCoordinatorSchema } from "@shared/schema";

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
  // ============ Transactions ============

  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
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

  app.post("/api/transactions", async (req, res) => {
    try {
      const { createSlackChannel, createGmailFilter, fetchMlsData, ...transactionData } = req.body;
      
      // Validate the transaction data
      const validatedData = insertTransactionSchema.parse(transactionData);
      
      // Create the transaction
      const transaction = await storage.createTransaction(validatedData);

      // Log activity
      await storage.createActivity({
        transactionId: transaction.id,
        type: "transaction_created",
        description: `Transaction created for ${transaction.propertyAddress}`,
      });

      // Simulate Slack channel creation if requested
      if (createSlackChannel) {
        const channelName = generateSlackChannelName(transaction.propertyAddress);
        const slackSetting = await storage.getIntegrationSetting("slack");
        
        if (slackSetting?.isConnected) {
          // In a real implementation, we would call Slack API here
          await storage.updateTransaction(transaction.id, {
            slackChannelId: `C${Date.now()}`,
            slackChannelName: channelName,
          });
          
          await storage.createActivity({
            transactionId: transaction.id,
            type: "channel_created",
            description: `Slack channel #${channelName} created`,
          });
        }
      }

      // Simulate Gmail filter creation if requested
      if (createGmailFilter) {
        const gmailSetting = await storage.getIntegrationSetting("gmail");
        
        if (gmailSetting?.isConnected) {
          // In a real implementation, we would call Gmail API here
          await storage.updateTransaction(transaction.id, {
            gmailFilterId: `filter_${Date.now()}`,
          });
          
          await storage.createActivity({
            transactionId: transaction.id,
            type: "filter_created",
            description: `Gmail filter created for "${transaction.propertyAddress}"`,
          });
        }
      }

      // Simulate MLS data fetch if requested
      if (fetchMlsData && transaction.mlsNumber) {
        const repliersSetting = await storage.getIntegrationSetting("repliers");
        
        if (repliersSetting?.isConnected) {
          // In a real implementation, we would call Repliers API here
          // For now, generate mock MLS data
          const mockMlsData = {
            listingId: transaction.mlsNumber,
            listDate: transaction.contractDate || new Date().toISOString(),
            listPrice: transaction.listPrice || 400000,
            propertyType: transaction.propertyType || "Single Family",
            bedrooms: transaction.bedrooms || 3,
            bathrooms: transaction.bathrooms || 2,
            sqft: transaction.sqft || 1800,
            yearBuilt: transaction.yearBuilt || 2015,
            description: "Beautiful home in a great neighborhood with modern amenities and updates throughout.",
            agent: {
              name: "Jane Realtor",
              phone: "(555) 555-5555",
              email: "jane@realtyco.com",
              brokerage: "Premier Realty",
            },
          };

          const mockCmaData = [
            {
              address: "125 Oak Street",
              price: 440000,
              bedrooms: 3,
              bathrooms: 2,
              sqft: 1750,
              daysOnMarket: 15,
              distance: 0.2,
            },
            {
              address: "130 Oak Street",
              price: 455000,
              bedrooms: 3,
              bathrooms: 2,
              sqft: 1900,
              daysOnMarket: 22,
              distance: 0.3,
            },
            {
              address: "200 Elm Drive",
              price: 425000,
              bedrooms: 3,
              bathrooms: 2,
              sqft: 1700,
              daysOnMarket: 8,
              distance: 0.5,
            },
          ];

          await storage.updateTransaction(transaction.id, {
            mlsData: mockMlsData,
            cmaData: mockCmaData,
          });
          
          await storage.createActivity({
            transactionId: transaction.id,
            type: "mls_fetched",
            description: "MLS data and CMA comparables loaded",
          });
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

  app.patch("/api/transactions/:id", async (req, res) => {
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

  app.delete("/api/transactions/:id", async (req, res) => {
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

  app.post("/api/transactions/:id/refresh-mls", async (req, res) => {
    try {
      const transaction = await storage.getTransaction(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const repliersSetting = await storage.getIntegrationSetting("repliers");
      if (!repliersSetting?.isConnected) {
        return res.status(400).json({ message: "Repliers integration not connected" });
      }

      // In a real implementation, we would call Repliers API here
      // For now, generate mock MLS data
      const mockMlsData = {
        listingId: transaction.mlsNumber || `MLS${Date.now()}`,
        listDate: transaction.contractDate || new Date().toISOString(),
        listPrice: transaction.listPrice || 400000,
        propertyType: transaction.propertyType || "Single Family",
        bedrooms: transaction.bedrooms || 3,
        bathrooms: transaction.bathrooms || 2,
        sqft: transaction.sqft || 1800,
        yearBuilt: transaction.yearBuilt || 2015,
        lotSize: 6500,
        garage: 2,
        pool: false,
        description: "Beautiful home in a great neighborhood with modern amenities and updates throughout. Features include hardwood floors, granite countertops, and a spacious backyard.",
        features: ["Hardwood Floors", "Granite Counters", "Stainless Appliances", "Central A/C"],
        agent: {
          name: "Jane Realtor",
          phone: "(555) 555-5555",
          email: "jane@realtyco.com",
          brokerage: "Premier Realty",
        },
      };

      const mockCmaData = [
        {
          address: "125 Oak Street",
          price: 440000,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1750,
          daysOnMarket: 15,
          distance: 0.2,
        },
        {
          address: "130 Oak Street",
          price: 455000,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1900,
          daysOnMarket: 22,
          distance: 0.3,
        },
        {
          address: "200 Elm Drive",
          price: 425000,
          bedrooms: 3,
          bathrooms: 2,
          sqft: 1700,
          daysOnMarket: 8,
          distance: 0.5,
        },
      ];

      const updated = await storage.updateTransaction(req.params.id, {
        mlsData: mockMlsData,
        cmaData: mockCmaData,
      });

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

  app.get("/api/transactions/:id/activities", async (req, res) => {
    try {
      const activities = await storage.getActivitiesByTransaction(req.params.id);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  // ============ Coordinators ============

  app.get("/api/coordinators", async (req, res) => {
    try {
      const coordinators = await storage.getCoordinators();
      res.json(coordinators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch coordinators" });
    }
  });

  app.post("/api/coordinators", async (req, res) => {
    try {
      const validatedData = insertCoordinatorSchema.parse(req.body);
      const coordinator = await storage.createCoordinator(validatedData);
      res.status(201).json(coordinator);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Failed to create coordinator" });
    }
  });

  app.delete("/api/coordinators/:id", async (req, res) => {
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

  // ============ Integrations ============

  app.get("/api/integrations", async (req, res) => {
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

  app.post("/api/integrations/:type", async (req, res) => {
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

  app.post("/api/integrations/:type/test", async (req, res) => {
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

  return httpServer;
}
