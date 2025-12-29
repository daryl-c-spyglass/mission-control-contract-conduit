import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { authStorage } from "./storage";

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
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "strict" : "lax",
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
    console.error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for authentication");
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
            console.log(`Login rejected: ${email} is not a Spyglass Realty account`);
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
      res.redirect("/");
    }
  );

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
