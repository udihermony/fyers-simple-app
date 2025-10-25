const crypto = require("crypto");
const { prisma } = require("../prisma/client");
const orderValidation = require("../services/orderValidation");
const paperEngine = require("../services/paperEngine");
const fyersService = require("../services/fyersService");

class WebhookService {
  constructor() {
    this.rateLimitMap = new Map(); // Track rate limits per user
    this.rateLimitWindow = 60 * 1000; // 1 minute
    this.maxRequestsPerMinute = 100; // Max requests per minute per user
  }

  /**
   * Process Chartlink webhook alert
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async processChartlinkAlert(req, res) {
    const userToken = req.params.userToken;
    const webhookSecret = req.headers['x-webhook-secret'] || req.query.secret;

    try {
      // Validate user token and secret
      const userSettings = await this.validateWebhookAuth(userToken, webhookSecret);
      if (!userSettings) {
        return res.status(401).json({ error: "Invalid webhook authentication" });
      }

      // Rate limiting
      if (!this.checkRateLimit(userToken)) {
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      // Extract alert data
      const alertData = req.body;
      if (!alertData) {
        return res.status(400).json({ error: "Empty request body" });
      }

      // Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(alertData, userToken);

      // Check for duplicate alerts
      const existingAlert = await prisma.alert.findUnique({
        where: { idempotencyKey }
      });

      if (existingAlert) {
        return res.status(200).json({ 
          message: "Alert already processed",
          alertId: existingAlert.id,
          status: existingAlert.status
        });
      }

      // Process alert asynchronously
      const alertId = await this.createAlert(userSettings.userId, alertData, idempotencyKey);
      
      // Process in background
      this.processAlertAsync(alertId, userSettings.userId, alertData).catch(error => {
        console.error(`Error processing alert ${alertId}:`, error);
      });

      // Respond immediately
      res.status(200).json({
        message: "Alert received and queued for processing",
        alertId,
        status: "pending"
      });

    } catch (error) {
      console.error("Webhook processing error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Validate webhook authentication
   * @param {string} userToken - User webhook token
   * @param {string} webhookSecret - Webhook secret
   * @returns {Promise<Object|null>}
   */
  async validateWebhookAuth(userToken, webhookSecret) {
    try {
      const userSettings = await prisma.userSettings.findUnique({
        where: { webhookToken: userToken },
        include: { user: true }
      });

      if (!userSettings) {
        return null;
      }

      // Verify secret
      if (userSettings.webhookSecret !== webhookSecret) {
        return null;
      }

      return userSettings;
    } catch (error) {
      console.error("Webhook auth validation error:", error);
      return null;
    }
  }

  /**
   * Check rate limit for user
   * @param {string} userToken - User token
   * @returns {boolean}
   */
  checkRateLimit(userToken) {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    if (!this.rateLimitMap.has(userToken)) {
      this.rateLimitMap.set(userToken, []);
    }

    const requests = this.rateLimitMap.get(userToken);
    
    // Remove old requests
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    if (validRequests.length >= this.maxRequestsPerMinute) {
      return false;
    }

    // Add current request
    validRequests.push(now);
    this.rateLimitMap.set(userToken, validRequests);
    
    return true;
  }

  /**
   * Generate idempotency key from alert data
   * @param {Object} alertData - Alert data
   * @param {string} userToken - User token
   * @returns {string}
   */
  generateIdempotencyKey(alertData, userToken) {
    // Use unique_id from Chartlink if available, otherwise generate from payload
    if (alertData.unique_id) {
      return `${userToken}_${alertData.unique_id}`;
    }

    // Generate hash from payload
    const payloadString = JSON.stringify(alertData);
    const hash = crypto.createHash('sha256').update(payloadString).digest('hex');
    return `${userToken}_${hash.substring(0, 16)}`;
  }

  /**
   * Create alert record in database
   * @param {string} userId - User ID
   * @param {Object} alertData - Alert data
   * @param {string} idempotencyKey - Idempotency key
   * @returns {Promise<string>}
   */
  async createAlert(userId, alertData, idempotencyKey) {
    // Find or create default strategy
    let strategy = await prisma.strategy.findFirst({
      where: { userId, name: "Default Strategy" }
    });

    if (!strategy) {
      strategy = await prisma.strategy.create({
        data: {
          userId,
          name: "Default Strategy",
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
   * @param {string} userId - User ID
   * @param {Object} alertData - Alert data
   */
  async processAlertAsync(alertId, userId, alertData) {
    try {
      // Map Chartlink fields to our order format
      const orderData = this.mapChartlinkToOrder(alertData);
      
      if (!orderData) {
        await this.rejectAlert(alertId, "Invalid or unsupported alert format");
        return;
      }

      // Get user access token
      const token = await prisma.fyersToken.findFirst({
        where: { userId, appId: process.env.FYERS_APP_ID }
      });

      if (!token) {
        await this.rejectAlert(alertId, "No Fyers access token found");
        return;
      }

      // Validate order
      const validation = await orderValidation.validateOrder(orderData, userId, token.accessToken);
      
      if (!validation.isValid) {
        await this.rejectAlert(alertId, `Validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Determine execution mode
      const mode = this.determineExecutionMode(alertData, userId);
      
      if (mode === 'paper') {
        // Submit to paper engine
        const order = await paperEngine.submitOrder(orderData, userId, token.accessToken);
        await this.updateAlertStatus(alertId, 'processed', order.id);
      } else {
        // Submit to live execution
        const result = await fyersService.placeOrder(orderData, userId);
        await this.updateAlertStatus(alertId, 'processed', result.order.id);
      }

      console.log(`Alert ${alertId} processed successfully`);

    } catch (error) {
      console.error(`Error processing alert ${alertId}:`, error);
      await this.rejectAlert(alertId, `Processing error: ${error.message}`);
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
        symbol: alertData.symbol || alertData.instrument,
        side: this.mapSide(alertData.side || alertData.action),
        type: this.mapOrderType(alertData.order_type || alertData.type),
        productType: alertData.product_type || alertData.product || "INTRADAY",
        qty: parseInt(alertData.quantity || alertData.qty || alertData.volume),
        limitPrice: parseFloat(alertData.limit_price || alertData.price),
        stopPrice: parseFloat(alertData.stop_price || alertData.trigger_price),
        stopLoss: parseFloat(alertData.stop_loss || alertData.sl),
        takeProfit: parseFloat(alertData.take_profit || alertData.tp),
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
   * Determine execution mode (paper vs live)
   * @param {Object} alertData - Alert data
   * @param {string} userId - User ID
   * @returns {string}
   */
  async determineExecutionMode(alertData, userId) {
    try {
      // Check if alert specifies mode
      if (alertData.mode) {
        return alertData.mode.toLowerCase();
      }

      // Get user settings
      const userSettings = await prisma.userSettings.findUnique({
        where: { userId }
      });

      if (userSettings) {
        return userSettings.defaultMode;
      }

      // Default to paper for safety
      return 'paper';
    } catch (error) {
      console.error("Error determining execution mode:", error);
      return 'paper';
    }
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
   * Generate new webhook URL and secret for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async generateWebhookCredentials(userId) {
    const webhookToken = crypto.randomBytes(32).toString('hex');
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    await prisma.userSettings.upsert({
      where: { userId },
      update: {
        webhookToken,
        webhookSecret
      },
      create: {
        userId,
        webhookToken,
        webhookSecret,
        defaultMode: 'paper'
      }
    });

    return {
      webhookToken,
      webhookSecret,
      webhookUrl: `${process.env.APP_BASE_URL || 'http://localhost:8080'}/webhooks/chartlink/${webhookToken}`
    };
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
