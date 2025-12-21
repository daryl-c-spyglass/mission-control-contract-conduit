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
}
