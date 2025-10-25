const { prisma } = require("../prisma/client");
const orderValidation = require("../services/orderValidation");
const paperEngine = require("../services/paperEngine");
const fyersService = require("../services/fyersService");
const webhookService = require("../services/webhookService");
const marketData = require("../services/marketData");

class TradingAPI {
  constructor() {
    this.setupRoutes = this.setupRoutes.bind(this);
  }

  /**
   * Setup all trading API routes
   * @param {Object} app - Express app
   */
  setupRoutes(app) {
    // Webhook endpoint for Chartlink (single URL for all users)
    app.post("/webhooks/chartlink", (req, res) => {
      webhookService.processChartlinkAlert(req, res);
    });

    // Order management endpoints
    app.post("/api/orders", this.placeOrder.bind(this));
    app.get("/api/orders", this.getOrders.bind(this));
    app.get("/api/orders/:id", this.getOrder.bind(this));
    app.post("/api/orders/:id/cancel", this.cancelOrder.bind(this));
    app.post("/api/orders/:id/modify", this.modifyOrder.bind(this));

    // Execution endpoints
    app.get("/api/executions", this.getExecutions.bind(this));

    // Position endpoints
    app.get("/api/positions", this.getPositions.bind(this));

    // Portfolio endpoints
    app.get("/api/portfolio", this.getPortfolio.bind(this));

    // Symbol metadata endpoints
    app.get("/api/symbols/meta", this.getSymbolMeta.bind(this));

    // Settings endpoints
    app.get("/api/settings/webhook", this.getWebhookSettings.bind(this));
    app.post("/api/settings/webhook/rotate", this.rotateWebhookCredentials.bind(this));
    app.post("/api/settings", this.updateSettings.bind(this));

    // Strategy endpoints
    app.get("/api/strategies", this.getStrategies.bind(this));
    app.post("/api/strategies", this.createStrategy.bind(this));
    app.put("/api/strategies/:id", this.updateStrategy.bind(this));
    app.delete("/api/strategies/:id", this.deleteStrategy.bind(this));

    // Alert endpoints
    app.get("/api/alerts", this.getAlerts.bind(this));
    app.get("/api/alerts/:id", this.getAlert.bind(this));

    // Health and stats endpoints
    app.get("/api/trading/health", this.getTradingHealth.bind(this));
    app.get("/api/trading/stats", this.getTradingStats.bind(this));
    
    // Debug endpoint
    app.get("/api/debug/routes", (req, res) => {
      res.json({ 
        message: "Trading API routes are working",
        timestamp: new Date().toISOString(),
        user: req.user ? { id: req.user.id } : null
      });
    });
  }

  /**
   * Place a new order
   */
  async placeOrder(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const orderData = req.body;
      const userId = req.user.id;

      // Get user access token
      const token = await prisma.fyersToken.findFirst({
        where: { userId, appId: process.env.FYERS_APP_ID }
      });

      if (!token) {
        return res.status(401).json({ error: "No Fyers access token found" });
      }

      // Validate order
      const validation = await orderValidation.validateOrder(orderData, userId, token.accessToken);
      
      if (!validation.isValid) {
        return res.status(400).json({
          error: "Order validation failed",
          details: validation.errors,
          warnings: validation.warnings
        });
      }

      // Determine mode
      const mode = orderData.mode || 'paper';

      let result;
      if (mode === 'paper') {
        result = await paperEngine.submitOrder(orderData, userId, token.accessToken);
      } else {
        result = await fyersService.placeOrder(orderData, userId);
      }

      res.json({
        success: true,
        order: result.order || result,
        message: result.message || "Order placed successfully"
      });

    } catch (error) {
      console.error("Error placing order:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get orders for user
   */
  async getOrders(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { mode, state, limit = 50, offset = 0 } = req.query;
      const userId = req.user.id;

      const where = { userId };
      if (mode) where.mode = mode;
      if (state) where.state = state;

      const orders = await prisma.order.findMany({
        where,
        include: {
          strategy: true,
          alert: true,
          executions: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      res.json({ orders });

    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get specific order
   */
  async getOrder(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await prisma.order.findFirst({
        where: { id, userId },
        include: {
          strategy: true,
          alert: true,
          executions: true
        }
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      res.json({ order });

    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Cancel order
   */
  async cancelOrder(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const userId = req.user.id;

      const order = await prisma.order.findFirst({
        where: { id, userId }
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      let success = false;
      if (order.mode === 'paper') {
        success = await paperEngine.cancelOrder(id);
      } else {
        success = await fyersService.cancelOrder(id, userId);
      }

      if (success) {
        res.json({ success: true, message: "Order cancelled successfully" });
      } else {
        res.status(400).json({ error: "Order could not be cancelled" });
      }

    } catch (error) {
      console.error("Error cancelling order:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Modify order
   */
  async modifyOrder(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const modifications = req.body;
      const userId = req.user.id;

      const order = await prisma.order.findFirst({
        where: { id, userId }
      });

      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      if (order.mode !== 'live') {
        return res.status(400).json({ error: "Only live orders can be modified" });
      }

      const success = await fyersService.modifyOrder(id, modifications, userId);

      if (success) {
        res.json({ success: true, message: "Order modified successfully" });
      } else {
        res.status(400).json({ error: "Order could not be modified" });
      }

    } catch (error) {
      console.error("Error modifying order:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get executions
   */
  async getExecutions(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { mode, limit = 100, offset = 0 } = req.query;
      const userId = req.user.id;

      const where = {
        order: { userId }
      };
      if (mode) where.mode = mode;

      const executions = await prisma.execution.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              symbol: true,
              side: true,
              type: true,
              productType: true
            }
          }
        },
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      res.json({ executions });

    } catch (error) {
      console.error("Error fetching executions:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get positions
   */
  async getPositions(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { mode } = req.query;
      const userId = req.user.id;

      const where = { userId };
      if (mode) where.mode = mode;

      const positions = await prisma.position.findMany({
        where,
        orderBy: { updatedAt: 'desc' }
      });

      // Calculate current MTM if paper mode
      if (!mode || mode === 'paper') {
        const token = await prisma.fyersToken.findFirst({
          where: { userId, appId: process.env.FYERS_APP_ID }
        });

        if (token) {
          await paperEngine.calculatePortfolioPnL(userId, token.accessToken);
        }
      }

      res.json({ positions });

    } catch (error) {
      console.error("Error fetching positions:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get portfolio
   */
  async getPortfolio(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { mode = 'paper' } = req.query;
      const userId = req.user.id;

      const portfolio = await prisma.portfolio.findUnique({
        where: {
          userId_mode: { userId, mode }
        }
      });

      if (!portfolio) {
        return res.json({
          portfolio: {
            userId,
            mode,
            cashBalance: 0,
            dayPnl: 0,
            totalPnl: 0,
            updatedAt: new Date()
          }
        });
      }

      res.json({ portfolio });

    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get symbol metadata
   */
  async getSymbolMeta(req, res) {
    try {
      const { symbol } = req.query;
      
      if (!symbol) {
        return res.status(400).json({ error: "Symbol parameter required" });
      }

      const symbolMaster = require("../services/symbolMaster");
      const meta = await symbolMaster.getSymbolMeta(symbol);

      res.json({ symbol, meta });

    } catch (error) {
      console.error("Error fetching symbol meta:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get webhook settings
   */
  async getWebhookSettings(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      // Single webhook URL for all users (Chartlink model)
      const webhookUrl = `${process.env.APP_BASE_URL || 'https://fyers-simple-app-production.up.railway.app'}/webhooks/chartlink`;

      res.json({
        webhookUrl: webhookUrl,
        webhookSecret: "Not required for Chartlink",
        defaultMode: 'paper',
        description: "Single webhook URL for all Chartlink strategies. Users will receive orders based on their subscription preferences."
      });

    } catch (error) {
      console.error("Error fetching webhook settings:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Rotate webhook credentials
   */
  async rotateWebhookCredentials(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const credentials = await webhookService.generateWebhookCredentials(userId);

      res.json({
        success: true,
        webhookUrl: credentials.webhookUrl,
        webhookSecret: credentials.webhookSecret,
        message: "Webhook credentials rotated successfully"
      });

    } catch (error) {
      console.error("Error rotating webhook credentials:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update user settings
   */
  async updateSettings(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const { defaultMode, settings } = req.body;

      const updatedSettings = await prisma.userSettings.upsert({
        where: { userId },
        update: {
          defaultMode,
          settings
        },
        create: {
          userId,
          defaultMode: defaultMode || 'paper',
          settings: settings || {},
          webhookToken: '', // Will be generated separately
          webhookSecret: ''
        }
      });

      res.json({ success: true, settings: updatedSettings });

    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get strategies
   */
  async getStrategies(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const strategies = await prisma.strategy.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ strategies });

    } catch (error) {
      console.error("Error fetching strategies:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create strategy
   */
  async createStrategy(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;
      const strategyData = req.body;

      const strategy = await prisma.strategy.create({
        data: {
          userId,
          name: strategyData.name,
          modeOverride: strategyData.modeOverride,
          requireManualReview: strategyData.requireManualReview || false,
          allowedSymbols: strategyData.allowedSymbols || [],
          riskLimits: strategyData.riskLimits || {}
        }
      });

      res.json({ success: true, strategy });

    } catch (error) {
      console.error("Error creating strategy:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update strategy
   */
  async updateStrategy(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const userId = req.user.id;
      const updateData = req.body;

      const strategy = await prisma.strategy.updateMany({
        where: { id, userId },
        data: updateData
      });

      if (strategy.count === 0) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      res.json({ success: true, message: "Strategy updated successfully" });

    } catch (error) {
      console.error("Error updating strategy:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete strategy
   */
  async deleteStrategy(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const userId = req.user.id;

      const strategy = await prisma.strategy.deleteMany({
        where: { id, userId }
      });

      if (strategy.count === 0) {
        return res.status(404).json({ error: "Strategy not found" });
      }

      res.json({ success: true, message: "Strategy deleted successfully" });

    } catch (error) {
      console.error("Error deleting strategy:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get alerts
   */
  async getAlerts(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const userId = req.user.id;

      const where = { userId };
      if (status) where.status = status;

      const alerts = await prisma.alert.findMany({
        where,
        include: {
          strategy: true,
          orders: true
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset)
      });

      res.json({ alerts });

    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get specific alert
   */
  async getAlert(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const { id } = req.params;
      const userId = req.user.id;

      const alert = await prisma.alert.findFirst({
        where: { id, userId },
        include: {
          strategy: true,
          orders: {
            include: {
              executions: true
            }
          }
        }
      });

      if (!alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      res.json({ alert });

    } catch (error) {
      console.error("Error fetching alert:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get trading system health
   */
  async getTradingHealth(req, res) {
    try {
      const paperStats = paperEngine.getStats();
      const fyersStats = fyersService.getStats();
      const webhookStats = webhookService.getStats();

      res.json({
        paper: paperStats,
        fyers: fyersStats,
        webhook: webhookStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error fetching trading health:", error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get trading statistics
   */
  async getTradingStats(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const userId = req.user.id;

      const [orderStats, executionStats, positionStats] = await Promise.all([
        prisma.order.groupBy({
          by: ['mode', 'state'],
          where: { userId },
          _count: true
        }),
        prisma.execution.groupBy({
          by: ['mode'],
          where: { order: { userId } },
          _count: true,
          _sum: { qty: true }
        }),
        prisma.position.groupBy({
          by: ['mode'],
          where: { userId },
          _count: true,
          _sum: { qty: true, mtm: true }
        })
      ]);

      res.json({
        orders: orderStats,
        executions: executionStats,
        positions: positionStats
      });

    } catch (error) {
      console.error("Error fetching trading stats:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new TradingAPI();
