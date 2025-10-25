const crypto = require("crypto");
const { prisma } = require("../prisma/client");
const orderValidation = require("../services/orderValidation");
const paperEngine = require("../services/paperEngine");
const fyersService = require("../services/fyersService");

class WebhookService {
  constructor() {
    this.rateLimitMap = new Map(); // Track rate limits per IP
    this.rateLimitWindow = 60 * 1000; // 1 minute
    this.maxRequestsPerMinute = 100; // Max requests per minute per IP
  }

  /**
   * Process Chartlink webhook alert
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async processChartlinkAlert(req, res) {
    try {
      // Extract alert data
      const alertData = req.body;
      if (!alertData) {
        return res.status(400).json({ error: "Empty request body" });
      }

      // Rate limiting by IP
      const clientIP = req.ip || req.connection.remoteAddress;
      if (!this.checkRateLimit(clientIP)) {
        return res.status(429).json({ error: "Rate limit exceeded" });
      }

      // Generate idempotency key
      const idempotencyKey = this.generateIdempotencyKey(alertData);

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
      const alertId = await this.createAlert(alertData, idempotencyKey);
      
      // Process in background
      this.processAlertAsync(alertId, alertData).catch(error => {
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
   * @returns {Promise<string>}
   */
  async createAlert(alertData, idempotencyKey) {
    // Find or create default strategy
    let strategy = await prisma.strategy.findFirst({
      where: { 
        name: alertData.strategy_name || "Default Chartlink Strategy"
      }
    });

    if (!strategy) {
      // Create a default strategy for Chartlink
      strategy = await prisma.strategy.create({
        data: {
          userId: "system", // We'll handle user mapping later
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
        userId: "system", // We'll map to actual users during processing
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
  async processAlertAsync(alertId, alertData) {
    try {
      // Map Chartlink fields to our order format
      const orderData = this.mapChartlinkToOrder(alertData);
      
      if (!orderData) {
        await this.rejectAlert(alertId, "Invalid or unsupported alert format");
        return;
      }

      // Find users who want to follow this strategy
      const users = await this.getUsersForStrategy(alertData);
      
      if (users.length === 0) {
        await this.rejectAlert(alertId, "No users subscribed to this strategy");
        return;
      }

      // Process order for each user
      for (const user of users) {
        try {
          await this.processOrderForUser(alertId, orderData, user);
        } catch (error) {
          console.error(`Error processing order for user ${user.id}:`, error);
        }
      }

      await this.updateAlertStatus(alertId, 'processed');
      console.log(`Alert ${alertId} processed for ${users.length} users`);

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