import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";
import { createModuleLogger } from '../../lib/logger';

const log = createModuleLogger('auth');

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  const isProduction = process.env.NODE_ENV === "production";
  // Replit dev environment uses HTTPS via their proxy
  const isSecure = isProduction || process.env.REPL_ID;
  
  // Use 'none' sameSite for cross-origin iframe embedding support when secure
  // This allows the session cookie to be sent when embedded in an iframe
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isSecure ? true : false,
      sameSite: isSecure ? "none" : "lax", // 'none' requires secure:true
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientID || !clientSecret) {
    log.error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for authentication");
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL: "/api/auth/google/callback",
        scope: ["profile", "email"],
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value || "";
          
          if (!email) {
            return done(null, false, { message: "Email is required" });
          }
          
          const allowedDomain = "@spyglassrealty.com";
          if (!email.toLowerCase().endsWith(allowedDomain)) {
            log.info({ email }, 'Login rejected: not a Spyglass Realty account');
            return done(null, false, { message: "Only Spyglass Realty accounts are allowed" });
          }
          
          const firstName = profile.name?.givenName || "";
          const lastName = profile.name?.familyName || "";
          const profileImageUrl = profile.photos?.[0]?.value || "";

          const user = await authStorage.upsertUser({
            id: profile.id,
            email,
            firstName,
            lastName,
            profileImageUrl,
          });

          const sessionUser = {
            claims: {
              sub: user.id,
              email: user.email,
              first_name: user.firstName,
              last_name: user.lastName,
            },
            expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
          };

          done(null, sessionUser);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res) => {
    res.redirect("/api/auth/google");
  });

  app.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/?error=unauthorized_domain",
    }),
    (req, res) => {
      // Check if this is a popup auth flow
      // Check both state parameter (reliable) and session flag (backup)
      const session = req.session as any;
      const stateParam = req.query.state as string | undefined;
      const isPopupFromState = stateParam === 'popup=true';
      const isPopup = isPopupFromState || session?.authPopup;
      
      if (isPopup) {
        // Clear the popup flag
        if (session) {
          delete session.authPopup;
        }
        // Return HTML that posts a message to the parent window and closes
        res.send(`
          <!DOCTYPE html>
          <html>
            <head><title>Authentication Complete</title></head>
            <body>
              <script>
                (function() {
                  if (window.opener) {
                    // Post message to opener (the iframe that opened this popup)
                    window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
                    // Small delay to ensure message is received before closing
                    setTimeout(function() {
                      window.close();
                    }, 100);
                  } else {
                    // Fallback: redirect this window if no opener
                    window.location.href = '/';
                  }
                })();
              </script>
              <p>Authentication successful. This window will close automatically.</p>
            </body>
          </html>
        `);
      } else {
        res.redirect("/");
      }
    }
  );
  
  // Popup-specific Google auth route
  // Uses state parameter to reliably identify popup flow (works even if cookies blocked)
  app.get("/api/auth/google/popup", (req, res, next) => {
    // Store popup flag in session as backup
    if (req.session) {
      (req.session as any).authPopup = true;
    }
    // Also pass popup=true in OAuth state for reliable detection
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account",
      state: "popup=true", // Passed through OAuth flow and returned in callback
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  return res.status(401).json({ message: "Session expired" });
};
