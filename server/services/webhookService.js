// File: Webhook Service (Chartlink Integration)
// Path: server/services/webhookService.js

const crypto = require("crypto");
const { prisma } = require("../prisma/client");
const orderValidation = require("../services/orderValidation");
const paperEngine = require("../services/paperEngine");
const fyersService = require("../services/fyersService");

class WebhookService {
  constructor() {
    this.rateLimitMap = new Map(); // Track rate limits per IP
    this.rateLimitWindow = 60 * 1000; // 1 minute
    this.maxRequestsPerMinute = 600; // Max requests per minute per IP (increased for multiple Chartlink alerts)
  }

  /**
   * Process Chartlink webhook alert
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {string} userToken - User token from URL
   */
  async processChartlinkAlert(req, res, userToken) {
    try {
      // Normalize/parse body - handle JSON string, object, or URL-encoded text
      let alertDataRaw = req.body;
      if (typeof alertDataRaw === "string") {
        try {
          alertDataRaw = JSON.parse(alertDataRaw);
        } catch (_) {
          // Try parse key=value pairs (urlencoded-like text)
          const pairs = Object.fromEntries(
            String(alertDataRaw)
              .split("&")
              .map(kv => kv.split("=").map(decodeURIComponent))
              .filter(p => p.length === 2)
          );
          if (Object.keys(pairs).length) alertDataRaw = pairs;
        }
      }
      const alertData = (alertDataRaw && typeof alertDataRaw === "object" && alertDataRaw !== null) ? alertDataRaw : null;
      if (!alertData) {
        console.log("Empty or unparseable request body from Chartlink:", typeof req.body, req.body);
        return res.status(400).json({ error: "Empty or invalid request body" });
      }

      console.log("Processing Chartlink alert:", alertData);
      console.log("User token:", userToken);

      // Rate limiting by IP (early)
      const clientIP = req.ip || req.connection?.remoteAddress || "unknown";
      if (!this.checkRateLimit(clientIP)) {
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      const baseKey = this.generateIdempotencyKey(alertData);

      if (userToken) {
        // Single-user mode (token provided)
        const webhookConfig = await prisma.userSettings.findUnique({
          where: { webhookToken: userToken },
          include: { user: true }
        });
        if (!webhookConfig) {
          console.log("Invalid webhook token:", userToken);
          return res.status(401).json({ error: "Invalid webhook token" });
        }
        const userId = webhookConfig.userId;
        const idempotencyKey = `${baseKey}:${userId}`;

        const existingAlert = await prisma.alert.findUnique({ where: { idempotencyKey } });
        if (existingAlert) {
          return res.status(200).json({
            message: "Alert already processed",
            alertId: existingAlert.id,
            status: existingAlert.status
          });
        }

        const alertId = await this.createAlert(alertData, idempotencyKey, userId);
        this.processAlertAsync(alertId, alertData, userId).catch(err =>
          console.error(`Error processing alert ${alertId}:`, err)
        );

        return res.status(200).json({
          message: "Alert received and queued for processing",
          alertId,
          status: "pending"
        });
      } else {
        // Broadcast mode (no token - send to all users)
        const users = await this.getUsersForStrategy(alertData);
        if (!users.length) {
          console.log("No eligible users found for broadcast");
          return res.status(200).json({ message: "No eligible users, alert ignored" });
        }

        const queued = [];
        await Promise.all(users.map(async (u) => {
          try {
            const userId = u.id;
            const idempotencyKey = `${baseKey}:${userId}`;
            const existingAlert = await prisma.alert.findUnique({ where: { idempotencyKey } });
            if (existingAlert) {
              queued.push({ userId, status: "duplicate", alertId: existingAlert.id });
              return;
            }
            const alertId = await this.createAlert(alertData, idempotencyKey, userId);
            queued.push({ userId, status: "queued", alertId });
            this.processAlertAsync(alertId, alertData, userId).catch(err =>
              console.error(`Error processing alert ${alertId} for user ${userId}:`, err)
            );
          } catch (e) {
            console.error("Broadcast create/process error:", e);
            queued.push({ userId: u.id, status: "error", error: e.message });
          }
        }));

        return res.status(200).json({ message: "Alert received and broadcast queued", queued });
      }

    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Check rate limit for IP
   * @param {string} clientIP - Client IP address
   * @returns {boolean}
   */
  checkRateLimit(clientIP) {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    if (!this.rateLimitMap.has(clientIP)) {
      this.rateLimitMap.set(clientIP, []);
    }

    const requests = this.rateLimitMap.get(clientIP);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= this.maxRequestsPerMinute) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitMap.set(clientIP, validRequests);
    
    return true;
  }

  /**
   * Generate idempotency key from alert data
   * @param {Object} alertData - Alert data
   * @returns {string}
   */
  generateIdempotencyKey(alertData) {
    // Use unique_id from Chartlink if available, otherwise generate from payload
    if (alertData.unique_id) {
      return `chartlink_${alertData.unique_id}`;
    }

    // Generate hash from payload
    const payloadString = JSON.stringify(alertData);
    const hash = crypto.createHash('sha256').update(payloadString).digest('hex');
    return `chartlink_${hash.substring(0, 16)}`;
  }

  /**
   * Create alert record in database
   * @param {Object} alertData - Alert data
   * @param {string} idempotencyKey - Idempotency key
   * @param {string} userId - User ID from webhook token
   * @returns {Promise<string>}
   */
  async createAlert(alertData, idempotencyKey, userId) {
    // Find or create default strategy for this user
    let strategy = await prisma.strategy.findFirst({
      where: { 
        userId,
        name: alertData.strategy_name || "Default Chartlink Strategy"
      }
    });

    if (!strategy) {
      // Create a default strategy for Chartlink
      strategy = await prisma.strategy.create({
        data: {
          userId,
          name: alertData.strategy_name || "Default Chartlink Strategy",
          modeOverride: null,
          requireManualReview: false,
          allowedSymbols: [],
          riskLimits: {
            maxNotionalPerOrder: 1000000,
            maxNotionalPerDay: 5000000,
            maxOrdersPerMinute: 10
          }
        }
      });
    }

    const alert = await prisma.alert.create({
      data: {
        userId,
        strategyId: strategy.id,
        source: "chartlink",
        rawPayload: alertData,
        idempotencyKey,
        status: "pending"
      }
    });

    return alert.id;
  }

  /**
   * Process alert asynchronously
   * @param {string} alertId - Alert ID
   * @param {Object} alertData - Alert data
   */
  async processAlertAsync(alertId, alertData, userId) {
    try {
      // Map Chartlink fields to our order format
      const orderData = this.mapChartlinkToOrder(alertData);
      
      if (!orderData) {
        await this.rejectAlert(alertId, "Invalid or unsupported alert format");
        return;
      }

      // Get user with Fyers token
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          tokens: {
            where: {
              appId: process.env.FYERS_APP_ID
            }
          }
        }
      });

      if (!user || !user.tokens || user.tokens.length === 0) {
        await this.rejectAlert(alertId, "User not found or no Fyers token");
        return;
      }

      // Process order for the user
      await this.processOrderForUser(alertId, orderData, user);

      await this.updateAlertStatus(alertId, 'processed');
      console.log(`Alert ${alertId} processed for user ${userId}`);

    } catch (error) {
      console.error(`Error processing alert ${alertId}:`, error);
      await this.rejectAlert(alertId, `Processing error: ${error.message}`);
    }
  }

  /**
   * Get users who want to follow this strategy
   * @param {Object} alertData - Alert data
   * @returns {Promise<Array>}
   */
  async getUsersForStrategy(alertData) {
    // For now, return all users who have Fyers tokens
    // Later, you can add strategy subscription logic
    const users = await prisma.user.findMany({
      where: {
        tokens: {
          some: {
            appId: process.env.FYERS_APP_ID
          }
        }
      },
      include: {
        tokens: {
          where: {
            appId: process.env.FYERS_APP_ID
          }
        }
      }
    });

    return users;
  }

  /**
   * Process order for a specific user
   * @param {string} alertId - Alert ID
   * @param {Object} orderData - Order data
   * @param {Object} user - User object
   */
  async processOrderForUser(alertId, orderData, user) {
    try {
      const token = user.tokens[0];
      if (!token) return;

      // Validate order
      const validation = await orderValidation.validateOrder(orderData, user.id, token.accessToken);
      
      if (!validation.isValid) {
        console.log(`Order validation failed for user ${user.id}: ${validation.errors.join(', ')}`);
        return;
      }

      // Determine execution mode (default to paper for safety)
      const mode = 'paper'; // You can add user preferences later
      
      if (mode === 'paper') {
        // Submit to paper engine
        const order = await paperEngine.submitOrder(orderData, user.id, token.accessToken);
        await this.updateAlertStatus(alertId, 'processed', order.id);
      } else {
        // Submit to live execution
        const result = await fyersService.placeOrder(orderData, user.id);
        await this.updateAlertStatus(alertId, 'processed', result.order.id);
      }

    } catch (error) {
      console.error(`Error processing order for user ${user.id}:`, error);
    }
  }

  /**
   * Map Chartlink alert to order format
   * @param {Object} alertData - Chartlink alert data
   * @returns {Object|null}
   */
  mapChartlinkToOrder(alertData) {
    try {
      // Common Chartlink field mappings
      const mapping = {
        symbol: this.normalizeSymbol(
          alertData.symbol || alertData.instrument || alertData.ticker || alertData.scrip,
          alertData.exchange || alertData.exch
        ),
        side: this.mapSide(alertData.side || alertData.action || alertData.signal),
        type: this.mapOrderType(alertData.order_type || alertData.type),
        productType: alertData.product_type || alertData.product || "INTRADAY",
        qty: parseInt(alertData.quantity || alertData.qty || alertData.volume || alertData.q, 10),
        limitPrice: alertData.limit_price || alertData.price || alertData.ltp ? parseFloat(alertData.limit_price || alertData.price || alertData.ltp) : undefined,
        stopPrice: alertData.stop_price || alertData.trigger_price || alertData.trigger ? parseFloat(alertData.stop_price || alertData.trigger_price || alertData.trigger) : undefined,
        stopLoss: alertData.stop_loss || alertData.sl ? parseFloat(alertData.stop_loss || alertData.sl) : undefined,
        takeProfit: alertData.take_profit || alertData.tp ? parseFloat(alertData.take_profit || alertData.tp) : undefined,
        orderTag: alertData.order_tag || alertData.tag,
        validity: alertData.validity || "DAY",
        offlineOrder: alertData.offline_order || false,
        disclosedQty: parseInt(alertData.disclosed_qty || 0)
      };

      // Validate required fields
      if (!mapping.symbol || !mapping.side || !mapping.qty) {
        return null;
      }

      // Set defaults
      if (!mapping.type) mapping.type = 2; // Market order
      if (!mapping.productType) mapping.productType = "INTRADAY";

      return mapping;
    } catch (error) {
      console.error("Error mapping Chartlink alert:", error);
      return null;
    }
  }

  /**
   * Map Chartlink side to our format
   * @param {string} side - Chartlink side
   * @returns {number}
   */
  mapSide(side) {
    const sideMap = {
      'BUY': 1,
      'buy': 1,
      '1': 1,
      'SELL': -1,
      'sell': -1,
      '-1': -1
    };
    
    return sideMap[side] || 1;
  }

  /**
   * Map Chartlink order type to our format
   * @param {string} type - Chartlink order type
   * @returns {number}
   */
  mapOrderType(type) {
    const typeMap = {
      'LIMIT': 1,
      'limit': 1,
      '1': 1,
      'MARKET': 2,
      'market': 2,
      '2': 2,
      'STOP': 3,
      'stop': 3,
      '3': 3,
      'STOP_LIMIT': 4,
      'stop_limit': 4,
      '4': 4
    };
    
    return typeMap[type] || 2; // Default to market
  }

  /**
   * Normalize symbol to Fyers format (e.g., NSE:SBIN-EQ)
   * @param {string} raw - Raw symbol
   * @param {string} exch - Exchange
   * @returns {string|null}
   */
  normalizeSymbol(raw, exch) {
    if (!raw) return null;
    
    // If already in Fyers format like "NSE:SBIN-EQ", pass through
    if (/^[A-Z]+:/.test(raw)) return raw;
    
    const upper = String(raw).toUpperCase().trim();
    const ex = (exch || "NSE").toUpperCase();
    
    // Add default -EQ suffix for equities
    return `${ex}:${upper}-EQ`;
  }

  /**
   * Update alert status
   * @param {string} alertId - Alert ID
   * @param {string} status - New status
   * @param {string} orderId - Associated order ID
   */
  async updateAlertStatus(alertId, status, orderId = null) {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status,
        processedAt: new Date()
      }
    });

    if (orderId) {
      await prisma.order.update({
        where: { id: orderId },
        data: { alertId }
      });
    }
  }

  /**
   * Reject alert
   * @param {string} alertId - Alert ID
   * @param {string} reason - Rejection reason
   */
  async rejectAlert(alertId, reason) {
    await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'rejected',
        processedAt: new Date()
      }
    });

    await prisma.event.create({
      data: {
        refType: 'alert',
        refId: alertId,
        type: 'alert_rejected',
        payload: { reason }
      }
    });

    console.log(`Alert ${alertId} rejected: ${reason}`);
  }

  /**
   * Get webhook statistics
   * @returns {Object}
   */
  getStats() {
    return {
      rateLimitMapSize: this.rateLimitMap.size,
      maxRequestsPerMinute: this.maxRequestsPerMinute,
      rateLimitWindow: this.rateLimitWindow
    };
  }
}

module.exports = new WebhookService();