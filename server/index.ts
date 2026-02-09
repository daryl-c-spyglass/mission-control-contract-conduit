import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { startRepliersSync } from "./repliers-sync";
import { initializeNotificationCron } from "./cron/notificationCron";
import { requestIdMiddleware } from "./middleware/requestId";
import { requestLoggerMiddleware } from "./middleware/requestLogger";
import logger, { createModuleLogger } from "./lib/logger";
import { validateEnvironment } from "./lib/envGuard";

const log = createModuleLogger('server');

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

app.use((req, res, next) => {
  const frameAncestors = "'self' https://*.replit.dev https://*.replit.app https://*.onrender.com";
  
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name: string, value: any) {
    if (name.toLowerCase() === 'content-security-policy') {
      const valueStr = String(value);
      if (!valueStr.includes('frame-ancestors')) {
        value = `${valueStr}; frame-ancestors ${frameAncestors}`;
      }
    }
    return originalSetHeader(name, value);
  };
  
  res.removeHeader('X-Frame-Options');
  originalSetHeader('Content-Security-Policy', `frame-ancestors ${frameAncestors}`);
  
  next();
});

const startupTime = Date.now();
const envStatus = validateEnvironment();

app.get('/health', (_req, res) => {
  const uptime = Math.floor((Date.now() - startupTime) / 1000);
  res.json({
    status: 'ok',
    uptime,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  const publicPath = path.resolve(process.cwd(), "public");
  app.use(express.static(publicPath));

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log.info({ port }, 'Server started');
      
      const notificationsDisabled = process.env.DISABLE_SLACK_NOTIFICATIONS === 'true';
      
      log.info({
        nodeEnv: process.env.NODE_ENV || 'not set',
        slackEnabled: !notificationsDisabled,
        hasSlackToken: !!process.env.SLACK_BOT_TOKEN,
        hasRepliersKey: !!process.env.REPLIERS_API_KEY,
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        uatMode: process.env.UAT_MODE || 'off',
      }, 'Slack configuration loaded');
      
      if (!notificationsDisabled && !process.env.SLACK_BOT_TOKEN) {
        log.warn('Slack notifications enabled but SLACK_BOT_TOKEN is not set');
      }
      
      startRepliersSync();
      initializeNotificationCron();
    },
  );

  function gracefulShutdown(signal: string) {
    log.info({ signal }, 'Shutdown signal received, closing server');
    httpServer.close(() => {
      log.info('HTTP server closed');
      process.exit(0);
    });
    setTimeout(() => {
      log.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('unhandledRejection', (reason: any) => {
    log.error({ err: reason }, 'Unhandled promise rejection');
  });

  process.on('uncaughtException', (err: Error) => {
    log.fatal({ err }, 'Uncaught exception - shutting down');
    process.exit(1);
  });
})();
