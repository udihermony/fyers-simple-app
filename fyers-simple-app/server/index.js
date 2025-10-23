const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { fyersModel } = require("fyers-api-v3");
require("dotenv").config();

const app = express();
app.use(express.json());

const {
  PORT = 8080,
  FYERS_APP_ID,
  FYERS_SECRET_KEY,
  FYERS_REDIRECT_URL,
  FRONTEND_URL,
  FYERS_ENABLE_LOGGING = "0",
  LOG_PATH = "/tmp"
} = process.env;

if (!FYERS_APP_ID || !FYERS_SECRET_KEY || !FYERS_REDIRECT_URL || !FRONTEND_URL) {
  console.error("Missing required env variables. Check FYERS_APP_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URL, FRONTEND_URL.");
  process.exit(1);
}

app.use(cookieParser());

// CORS for frontend
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true
  })
);

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
  const authCode = req.query.auth_code || req.query.auth_code_v2; // depending on variation
  if (!authCode) {
    return res.status(400).send("Missing auth_code");
  }
  try {
    const fyers = newFyersClient();
    const tokenResp = await fyers.generate_access_token({
      client_id: FYERS_APP_ID,
      secret_key: FYERS_SECRET_KEY,
      auth_code: authCode
    });

    if (tokenResp && tokenResp.s === "ok" && tokenResp.access_token) {
      // Store token in httpOnly cookie
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("fy_at", tokenResp.access_token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        // Optionally set a maxAge if Fyers provides expiry; here 6 hours as a placeholder:
        // maxAge: 6 * 60 * 60 * 1000
      });

      return res.redirect(FRONTEND_URL);
    }

    console.error("Error generating access token", tokenResp);
    return res.status(400).send("Error generating access token");
  } catch (e) {
    console.error("Token exchange error", e);
    return res.status(500).send("Token exchange failed");
  }
});

// Protected: get profile
app.get("/api/me", async (req, res) => {
  const accessToken = req.cookies?.fy_at;
  if (!accessToken) return res.status(401).json({ error: "Not authenticated" });

  try {
    const fyers = newFyersClient();
    fyers.setAccessToken(accessToken);
    const profile = await fyers.get_profile();
    return res.json(profile);
  } catch (e) {
    console.error("get_profile error", e);
    return res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Logout: clear cookie
app.post("/auth/logout", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie("fy_at", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax"
  });
  return res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});
