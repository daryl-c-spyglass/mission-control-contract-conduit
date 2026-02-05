import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startRepliersSync } from "./repliers-sync";
// LEGACY SCHEDULER DISABLED - was causing duplicate notifications without deduplication
// import { startClosingRemindersScheduler } from "./services/closing-reminders";
import { initializeNotificationCron } from "./cron/notificationCron";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",  // Increased to handle base64-encoded images (33% overhead)
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Allow iframe embedding from trusted domains
// Only set frame-ancestors, preserve any other CSP directives
app.use((req, res, next) => {
  // Set frame-ancestors via dedicated header (doesn't conflict with other CSP)
  const frameAncestors = "'self' https://*.replit.dev https://*.replit.app https://*.onrender.com";
  
  // Override the res.setHeader to merge CSP if another middleware sets it
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name: string, value: any) {
    if (name.toLowerCase() === 'content-security-policy') {
      // Append frame-ancestors if not already present
      const valueStr = String(value);
      if (!valueStr.includes('frame-ancestors')) {
        value = `${valueStr}; frame-ancestors ${frameAncestors}`;
      }
    }
    return originalSetHeader(name, value);
  };
  
  // Remove X-Frame-Options if set elsewhere (conflicts with CSP frame-ancestors)
  res.removeHeader('X-Frame-Options');
  
  // Set initial frame-ancestors CSP
  originalSetHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Serve static files from public directory (for CMA widget images, logos, etc.)
  // This must come BEFORE the Vite catch-all to properly serve static assets
  const publicPath = path.resolve(process.cwd(), "public");
  app.use(express.static(publicPath));

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
      
      // Log notification status prominently on startup
      const notificationsDisabled = process.env.DISABLE_SLACK_NOTIFICATIONS === 'true';
      const slackBotToken = process.env.SLACK_BOT_TOKEN;
      const uatMode = process.env.UAT_MODE;
      
      console.log('╔═══════════════════════════════════════════════════════════════╗');
      console.log('║                    SLACK CONFIGURATION                        ║');
      console.log('╠═══════════════════════════════════════════════════════════════╣');
      console.log(`║ Status: ${notificationsDisabled ? '🔴 DISABLED' : '🟢 ENABLED'}`.padEnd(66) + '║');
      console.log(`║ DISABLE_SLACK_NOTIFICATIONS = ${JSON.stringify(process.env.DISABLE_SLACK_NOTIFICATIONS)}`.padEnd(66) + '║');
      console.log(`║ SLACK_BOT_TOKEN = ${slackBotToken ? slackBotToken.substring(0, 15) + '...' : '❌ NOT SET'}`.padEnd(66) + '║');
      console.log(`║ UAT_MODE = ${JSON.stringify(uatMode)}`.padEnd(66) + '║');
      console.log(`║ NODE_ENV = ${process.env.NODE_ENV || 'not set'}`.padEnd(66) + '║');
      console.log('╚═══════════════════════════════════════════════════════════════╝');
      
      // Start automatic MLS data synchronization
      startRepliersSync();
      
      // LEGACY SCHEDULER DISABLED - was causing duplicate notifications
      // The legacy scheduler had no database deduplication and would re-send 
      // notifications every time the server restarted
      // startClosingRemindersScheduler();
      
      // Initialize new notification cron with proper deduplication (9 AM CT daily)
      // This uses the sentNotifications table to prevent duplicates
      initializeNotificationCron();
    },
  );
})();
