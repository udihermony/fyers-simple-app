const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { fyersModel } = require("fyers-api-v3");
const { prisma } = require("./prisma/client");
const crypto = require("crypto");
require("dotenv").config();

const app = express();
app.use(express.json());

const {
  PORT = 8080,
  FYERS_APP_ID,
  FYERS_SECRET_KEY,
  FYERS_REDIRECT_URL,
  FRONTEND_URL,
  // Optional comma-separated list for previews/local dev:
  FRONTEND_URLS = "",
  FYERS_ENABLE_LOGGING = "0",
  LOG_PATH = "/tmp"
} = process.env;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY || !FYERS_REDIRECT_URL || !FRONTEND_URL) {
  console.error("Missing required env variables. Check FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URL, FRONTEND_URL.");
  process.exit(1);
}

app.use(cookieParser());

// Helper: Session Expiry
function sessionExpiryDate() {
  const days = parseInt(process.env.SESSION_TTL_DAYS || "7", 10);
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

// Helper: Get User Access Token
async function getUserAccessToken(userId) {
  const rec = await prisma.fyersToken.findFirst({
    where: { userId, appId: FYERS_APP_ID }
  });
  return rec?.accessToken || null;
}

// CORS (normalize origins, support multiple)
const trimSlash = (s) => (s || "").replace(/\/+$/, "");
const ALLOWED_ORIGINS = [
  trimSlash(FRONTEND_URL),
  ...FRONTEND_URLS.split(",").map(s => trimSlash(s.trim())).filter(Boolean)
].filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    // Allow same-origin or server-to-server (no Origin header)
    if (!origin) return callback(null, true);
    const cleanOrigin = trimSlash(origin);
    if (ALLOWED_ORIGINS.includes(cleanOrigin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"), false);
  },
  credentials: true
}));

// Session Loader Middleware
app.use(async (req, res, next) => {
  const sid = req.cookies?.sid;
  if (!sid) return next();
  
  try {
    const session = await prisma.session.findUnique({
      where: { id: sid },
      include: { user: true }
    });
    
    if (!session) return next();
    if (session.revokedAt) return next();
    if (session.expiresAt && new Date() > new Date(session.expiresAt)) return next();
    
    req.session = session;
    req.user = session.user;
  } catch (e) {
    console.error("Session load error", e);
  } finally {
    return next();
  }
});

function newFyersClient() {
  const fyers = new fyersModel({
    path: LOG_PATH,
    enableLogging: FYERS_ENABLE_LOGGING === "1"
  });
  fyers.setAppId(FYERS_APP_ID);
  fyers.setRedirectUrl(FYERS_REDIRECT_URL);
  return fyers;
}

// Health
app.get("/health", (_, res) => res.json({ ok: true }));

// Step 1: Start OAuth: redirect user to Fyers login
app.get("/auth/login", (req, res) => {
  try {
    const fyers = newFyersClient();
    const url = fyers.generateAuthCode();
    // Optionally: add your own state param if supported. (Fyers docs may not use it.)
    return res.redirect(url);
  } catch (e) {
    console.error("Error generating auth code URL", e);
    return res.status(500).json({ error: "Unable to start OAuth" });
  }
});

// Step 2: Callback from Fyers -> exchange auth code for access token
app.get("/auth/callback", async (req, res) => {
  const authCode = req.query.auth_code || req.query.auth_code_v2;
  if (!authCode) return res.status(400).send("Missing auth_code");
  
  try {
    const fyers = newFyersClient();
    const tokenResp = await fyers.generate_access_token({
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET_KEY,
      auth_code: authCode
    });

    if (!(tokenResp && tokenResp.s === "ok" && tokenResp.access_token)) {
      console.error("Error generating access token", tokenResp);
      return res.status(400).send("Error generating access token");
    }

    // Get user identity from Fyers
    fyers.setAccessToken(tokenResp.access_token);
    const profile = await fyers.get_profile();
    const fyId = profile?.data?.fy_id || profile?.fy_id;
    const name = profile?.data?.name || profile?.name || null;
    const email = profile?.data?.email_id || profile?.email_id || null;

    if (!fyId) {
      console.error("Profile missing fy_id", profile);
      return res.status(500).send("Failed to resolve user identity");
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { fyId },
      update: { name, email },
      create: { fyId, name, email }
    });

    // Upsert token for this user/app
    await prisma.fyersToken.upsert({
      where: { userId_appId: { userId: user.id, appId: FYERS_APP_ID } },
      update: {
        accessToken: tokenResp.access_token,
        // expiresAt: if the SDK returns expiry, set it here
      },
      create: {
        userId: user.id,
        appId: FYERS_APP_ID,
        accessToken: tokenResp.access_token
      }
    });

    // Create session
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        expiresAt: sessionExpiryDate(),
        ip: req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null
      }
    });

    // Clear old token cookie (if it exists) and set sid cookie
    const isProd = process.env.NODE_ENV === "production";
    res.clearCookie("fy_at", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax"
    });
    
    res.cookie("sid", session.id, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      // maxAge optional; we rely on DB expiresAt for validity
    });

    return res.redirect(FRONTEND_URL);
  } catch (e) {
    console.error("Token exchange/callback error", e);
    return res.status(500).send("Token exchange failed");
  }
});

// Protected: get profile
app.get("/api/me", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  try {
    const accessToken = await getUserAccessToken(req.user.id);
    if (!accessToken) return res.status(401).json({ error: "No token on file, please login" });
    
    const fyers = newFyersClient();
    fyers.setAccessToken(accessToken);
    const profile = await fyers.get_profile();
    return res.json(profile);
  } catch (e) {
    console.error("get_profile error", e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Quotes endpoint (demo)
app.get("/api/quotes", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  try {
    const accessToken = await getUserAccessToken(req.user.id);
    if (!accessToken) return res.status(401).json({ error: "No token on file" });
    
    const symbolsParam = (req.query.symbols || "").toString().trim();
    const symbols = symbolsParam 
      ? symbolsParam.split(",").map(s => s.trim()).filter(Boolean) 
      : ["NSE:SBIN-EQ", "NSE:TCS-EQ"];
    
    const fyers = newFyersClient();
    fyers.setAccessToken(accessToken);
    const quotes = await fyers.getQuotes(symbols);
    return res.json(quotes);
  } catch (e) {
    console.error("getQuotes error", e);
    return res.status(500).json({ error: "Failed to fetch quotes" });
  }
});

// Holdings endpoint
app.get("/api/holdings", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  try {
    const accessToken = await getUserAccessToken(req.user.id);
    if (!accessToken) return res.status(401).json({ error: "No token on file" });
    
    const fyers = newFyersClient();
    fyers.setAccessToken(accessToken);
    const fn = fyers.getHoldings || fyers.get_holdings || fyers.holdings;
    
    if (!fn) return res.status(500).json({ error: "Holdings API not available" });
    
    const result = await fn.call(fyers);
    return res.json(result);
  } catch (e) {
    console.error("holdings error", e);
    return res.status(500).json({ error: "Failed to fetch holdings" });
  }
});

// Funds endpoint
app.get("/api/funds", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  
  try {
    const accessToken = await getUserAccessToken(req.user.id);
    if (!accessToken) return res.status(401).json({ error: "No token on file" });
    
    const fyers = newFyersClient();
    fyers.setAccessToken(accessToken);
    const fn = fyers.getFunds || fyers.get_funds || fyers.funds;
    
    if (!fn) return res.status(500).json({ error: "Funds API not available" });
    
    const result = await fn.call(fyers);
    return res.json(result);
  } catch (e) {
    console.error("funds error", e);
    return res.status(500).json({ error: "Failed to fetch funds" });
  }
});

// Logout: revoke session
app.post("/auth/logout", async (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  
  try {
    if (req.session?.id) {
      await prisma.session.update({
        where: { id: req.session.id },
        data: { revokedAt: new Date() }
      });
    }
  } catch (e) {
    console.error("logout revoke error", e);
  } finally {
    res.clearCookie("sid", {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax"
    });
    return res.json({ ok: true });
  }
});

// Database health check
app.get("/health/db", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: "db" });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
