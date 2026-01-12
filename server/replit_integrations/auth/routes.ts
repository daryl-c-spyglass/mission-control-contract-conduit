import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";

// Register auth-specific routes
export function registerAuthRoutes(app: Express): void {
  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update current user's profile
  app.patch("/api/auth/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slackUserId } = req.body;
      
      // Validate slackUserId is a string or null/undefined
      if (slackUserId !== undefined && slackUserId !== null && typeof slackUserId !== "string") {
        return res.status(400).json({ message: "Invalid slackUserId format" });
      }
      
      // Sanitize - only allow alphanumeric and reasonable characters for Slack IDs
      const sanitizedSlackId = slackUserId?.replace(/[^A-Z0-9]/gi, "") || null;
      
      const updatedUser = await authStorage.updateUser(userId, { slackUserId: sanitizedSlackId });
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // First-time onboarding - set Slack ID and email consent
  app.post("/api/user/onboarding", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { slackUserId, emailFilterConsent } = req.body;
      
      // Validate slackUserId
      if (!slackUserId || typeof slackUserId !== "string") {
        return res.status(400).json({ message: "Slack User ID is required" });
      }
      
      // Sanitize Slack ID
      const sanitizedSlackId = slackUserId.replace(/[^A-Z0-9]/gi, "");
      
      const updatedUser = await authStorage.updateUser(userId, {
        slackUserId: sanitizedSlackId,
        emailFilterConsent: emailFilterConsent === true,
        hasCompletedOnboarding: true,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error completing onboarding:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Update graphics/marketing settings
  app.patch("/api/user/graphics-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { marketingHeadshotUrl, marketingDisplayName, marketingTitle, marketingPhone, marketingEmail } = req.body;
      
      // Validate headshot URL/base64 - max 7MB to allow for base64 overhead (5MB file ~= 6.67MB base64)
      if (marketingHeadshotUrl && typeof marketingHeadshotUrl === "string") {
        if (marketingHeadshotUrl.length > 7 * 1024 * 1024) {
          return res.status(400).json({ message: "Headshot image is too large. Maximum size is 5MB." });
        }
        // Validate it's either a URL or a valid base64 data URL
        if (!marketingHeadshotUrl.startsWith("data:image/") && !marketingHeadshotUrl.startsWith("http")) {
          return res.status(400).json({ message: "Invalid headshot format. Must be an image URL or data URL." });
        }
      }
      
      // Validate string lengths for other fields
      const maxFieldLength = 200;
      if (marketingDisplayName && marketingDisplayName.length > maxFieldLength) {
        return res.status(400).json({ message: "Display name is too long." });
      }
      if (marketingTitle && marketingTitle.length > maxFieldLength) {
        return res.status(400).json({ message: "Title is too long." });
      }
      if (marketingPhone && marketingPhone.length > 50) {
        return res.status(400).json({ message: "Phone number is too long." });
      }
      if (marketingEmail && marketingEmail.length > maxFieldLength) {
        return res.status(400).json({ message: "Email is too long." });
      }
      
      const updatedUser = await authStorage.updateUser(userId, {
        marketingHeadshotUrl: marketingHeadshotUrl || null,
        marketingDisplayName: marketingDisplayName || null,
        marketingTitle: marketingTitle || null,
        marketingPhone: marketingPhone || null,
        marketingEmail: marketingEmail || null,
      });
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating graphics settings:", error);
      res.status(500).json({ message: "Failed to update graphics settings" });
    }
  });
}
