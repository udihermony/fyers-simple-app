const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { fyersModel } = require("fyers-api-v3");
const { prisma } = require("./prisma/client");
const crypto = require("crypto");
const tradingAPI = require("./api/trading");
const paperEngine = require("./services/paperEngine");
const symbolMaster = require("./services/symbolMaster");
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
  LOG_PATH = "/tmp",
  OAUTH_STATE_TTL_MINUTES = "10",
} = process.env;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY || !FYERS_REDIRECT_URL || !FRONTEND_URL) {
  console.error("Missing required env variables. Check FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URL, FRONTEND_URL.");
  process.exit(1);
}

app.use(cookieParser());

app.set("trust proxy", 1); // ensure req.ip honors X-Forwarded-For on Railway

// Helper: Random State Generation
function randomState() {
  // 32 bytes -> 43 char base64url
  const b = crypto.randomBytes(32);
  // Node may support 'base64url' directly; this polyfill is safe
  return b.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// Helper: Get Client IP
function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  return req.ip;
}

// Helper: Sanitize Return URL
function sanitizeReturnTo(returnTo, frontendUrl) {
  // Allow either a relative path (/something) or an absolute URL that starts with FRONTEND_URL
  if (!returnTo) return null;
  try {
    if (returnTo.startsWith("/")) return returnTo;
    const u = new URL(returnTo);
    const f = new URL(frontendUrl);
    if (u.origin === f.origin) return u.pathname + u.search + u.hash;
  } catch (_) {}
  return null;
}

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
  ...FRONTEND_URLS.split(",").map(s => trimSlash(s.trim())).filter(Boolean),
  // Add common development origins
  "http://localhost:3000",
  "https://localhost:3000",
  "http://127.0.0.1:3000",
  "https://127.0.0.1:3000"
].filter(Boolean);

console.log("CORS Configuration:");
console.log("FRONTEND_URL:", FRONTEND_URL);
console.log("FRONTEND_URLS:", FRONTEND_URLS);
console.log("ALLOWED_ORIGINS:", ALLOWED_ORIGINS);

app.use(cors({
  origin: function (origin, callback) {
    console.log("CORS Request from origin:", origin);
    
    // Allow same-origin or server-to-server (no Origin header)
    if (!origin) {
      console.log("No origin header, allowing request");
      return callback(null, true);
    }
    
    const cleanOrigin = trimSlash(origin);
    console.log("Clean origin:", cleanOrigin);
    console.log("Checking against allowed origins:", ALLOWED_ORIGINS);
    
    if (ALLOWED_ORIGINS.includes(cleanOrigin)) {
      console.log("Origin allowed:", cleanOrigin);
      return callback(null, true);
    }
    
    console.log("Origin NOT allowed:", cleanOrigin);
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
app.get("/auth/login", async (req, res) => {
  try {
    const fyers = newFyersClient();
    const urlStr = fyers.generateAuthCode();

    // Create state
    const state = randomState();
    const ttlMins = parseInt(OAUTH_STATE_TTL_MINUTES, 10) || 10;
    const expiresAt = new Date(Date.now() + ttlMins * 60 * 1000);

    // Optional return_to
    const returnTo = sanitizeReturnTo(
      req.query.return_to?.toString() || "",
      FRONTEND_URL
    );

    // Persist state
    await prisma.oAuthState.create({
      data: {
        state,
        expiresAt,
        ip: getClientIp(req),
        userAgent: req.headers["user-agent"] || null,
        redirectTo: returnTo,
      }
    });

    // Append state to Fyers URL
    const u = new URL(urlStr);
    u.searchParams.set("state", state);

    // Small cleanup: optionally purge old/expired states in the background
    prisma.oAuthState.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } }
        ]
      }
    }).catch(() => {});

    return res.redirect(u.toString());
  } catch (e) {
    console.error("Error generating auth code URL", e);
    return res.status(500).json({ error: "Unable to start OAuth" });
  }
});

// Step 2: Callback from Fyers -> exchange auth code for access token
app.get("/auth/callback", async (req, res) => {
  const authCode = req.query.auth_code || req.query.auth_code_v2;
  const stateParam = req.query.state;

  if (!authCode) return res.status(400).send("Missing auth_code");
  if (!stateParam) return res.status(400).send("Missing state");

  let redirectTo = null;

  try {
    await prisma.$transaction(async (tx) => {
      // Load state
      const rec = await tx.oAuthState.findUnique({
        where: { state: stateParam.toString() }
      });
      
      if (!rec) {
        throw new Error("Invalid state");
      }
      
      if (rec.expiresAt < new Date()) {
        // delete expired to keep table tidy
        await tx.oAuthState.delete({ where: { state: rec.state } })
          .catch(() => {});
        throw new Error("State expired");
      }

      // OPTIONAL: Soft-validate IP/UA; don't hard-fail if behind proxies or UA changes
      // const ip = getClientIp(req);
      // if (rec.ip && rec.ip !== ip) {
      //   console.warn("OAuth state IP mismatch", { recIp: rec.ip, ip });
      // }
      // if (rec.userAgent && rec.userAgent !== (req.headers["user-agent"] || null)) {
      //   console.warn("OAuth state UA mismatch");
      // }

      redirectTo = rec.redirectTo;

      // One-time use: delete the record to prevent replay
      await tx.oAuthState.delete({ where: { state: rec.state } });
    });

    // Proceed with token exchange and login flow
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
        ip: getClientIp(req),
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

    // Redirect back to frontend (use return_to if provided and sanitized)
    const finalRedirect = redirectTo
      ? new URL(redirectTo, FRONTEND_URL).toString()
      : FRONTEND_URL;

    return res.redirect(finalRedirect);
  } catch (e) {
    console.error("Token exchange or state validation error", e);
    return res.status(400).send(`
      <h1>Login session expired</h1>
      <p>Please <a href="${FRONTEND_URL}">click here</a> to try again.</p>
    `);
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
    
    // Make direct API call to Fyers v3 funds endpoint
    const response = await fetch("https://api.fyers.in/v3/funds", {
      method: "GET",
      headers: {
        "Authorization": `${FYERS_APP_ID}:${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      console.error("Fyers funds API error:", response.status);
      return res.status(response.status).json({ error: "Failed to fetch funds from Fyers" });
    }

    const result = await response.json();
    
    // Transform the response to match frontend expectations
    // Extract capital and commodity from fund_limit array
    let capital = 0;
    let commodity = 0;

    // Find available balance from fund_limit
    if (result.fund_limit && Array.isArray(result.fund_limit)) {
      const availableBalance = result.fund_limit.find(item => 
        item.title && item.title.toLowerCase().includes('available balance')
      );
      if (availableBalance) {
        capital = availableBalance.equityAmount || 0;
        commodity = availableBalance.commodityAmount || 0;
      }
    }
    
    return res.json({
      s: result.s || 'ok',
      code: result.code || 200,
      capital,
      commodity,
      fund_limit: result.fund_limit || []
    });
  } catch (e) {
    console.error("funds error:", e.message, e.stack);
    return res.status(500).json({ 
      error: "Failed to fetch funds", 
      details: e.message 
    });
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

// Setup trading API routes
tradingAPI.setupRoutes(app);

// Initialize services
async function initializeServices() {
  try {
    // Preload common symbols
    await symbolMaster.preloadCommonSymbols();
    console.log("Symbol master initialized");

    // Start paper trading engine
    paperEngine.start();
    console.log("Paper trading engine started");

    console.log("All services initialized successfully");
  } catch (error) {
    console.error("Error initializing services:", error);
  }
}

app.listen(PORT, async () => {
  console.log(`Server listening on ${PORT}`);
  await initializeServices();
});
