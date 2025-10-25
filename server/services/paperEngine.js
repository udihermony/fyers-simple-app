const { prisma } = require("../prisma/client");
const marketData = require('./marketData');
const symbolMaster = require('./symbolMaster');

class PaperTradingEngine {
  constructor() {
    this.activeOrders = new Map(); // Track orders being processed
    this.processingInterval = null;
    this.isProcessing = false;
  }

  /**
   * Start the paper trading engine
   */
  start() {
    if (this.processingInterval) {
      return; // Already running
    }

    // Process orders every 2 seconds
    this.processingInterval = setInterval(() => {
      this.processOrders().catch(error => {
        console.error("Error processing paper orders:", error);
      });
    }, 2000);

    console.log("Paper trading engine started");
  }

  /**
   * Stop the paper trading engine
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    console.log("Paper trading engine stopped");
  }

  /**
   * Submit a new paper order
   * @param {Object} orderData - Order data
   * @param {string} userId - User ID
   * @param {string} accessToken - Fyers access token
   * @returns {Promise<Object>}
   */
  async submitOrder(orderData, userId, accessToken) {
    try {
      // Create order in database
      const order = await prisma.order.create({
        data: {
          userId,
          mode: 'paper',
          side: orderData.side,
          type: orderData.type,
          productType: orderData.productType,
          symbol: orderData.symbol,
          qty: orderData.qty,
          limitPrice: orderData.limitPrice,
          stopPrice: orderData.stopPrice,
          stopLoss: orderData.stopLoss,
          takeProfit: orderData.takeProfit,
          orderTag: orderData.orderTag,
          offlineOrder: orderData.offlineOrder || false,
          disclosedQty: orderData.disclosedQty || 0,
          validity: orderData.validity || 'DAY',
          state: 'new',
          strategyId: orderData.strategyId,
          alertId: orderData.alertId
        }
      });

      // Log event
      await this.logEvent('order_placed', order.id, {
        orderData,
        userId
      });

      // Start processing immediately for market orders
      if (orderData.type === 2) { // Market order
        await this.processOrder(order.id, accessToken);
      }

      return order;
    } catch (error) {
      console.error("Error submitting paper order:", error);
      throw error;
    }
  }

  /**
   * Process all active paper orders
   * @param {string} accessToken - Fyers access token
   */
  async processOrders(accessToken) {
    if (this.isProcessing) {
      return; // Prevent concurrent processing
    }

    this.isProcessing = true;

    try {
      // Get all working paper orders
      const orders = await prisma.order.findMany({
        where: {
          mode: 'paper',
          state: {
            in: ['new', 'working']
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      for (const order of orders) {
        try {
          await this.processOrder(order.id, accessToken);
        } catch (error) {
          console.error(`Error processing order ${order.id}:`, error);
          await this.rejectOrder(order.id, `Processing error: ${error.message}`);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a specific order
   * @param {string} orderId - Order ID
   * @param {string} accessToken - Fyers access token
   */
  async processOrder(orderId, accessToken) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order || order.mode !== 'paper') {
      return;
    }

    if (order.state === 'filled' || order.state === 'cancelled' || order.state === 'rejected') {
      return;
    }

    // Update state to working
    if (order.state === 'new') {
      await prisma.order.update({
        where: { id: orderId },
        data: { state: 'working' }
      });
    }

    try {
      const fillPrice = await marketData.simulateFillPrice(
        order.symbol,
        order.side,
        order.type,
        order.limitPrice,
        order.stopPrice,
        accessToken
      );

      if (fillPrice && fillPrice > 0) {
        await this.fillOrder(orderId, fillPrice, order.qty);
      } else if (order.type === 2) { // Market order should always fill
        // If market order can't fill, reject it
        await this.rejectOrder(orderId, "Market order could not be filled - insufficient liquidity");
      }
    } catch (error) {
      console.error(`Error processing order ${orderId}:`, error);
      await this.rejectOrder(orderId, `Processing error: ${error.message}`);
    }
  }

  /**
   * Fill an order
   * @param {string} orderId - Order ID
   * @param {number} fillPrice - Fill price
   * @param {number} fillQty - Fill quantity
   */
  async fillOrder(orderId, fillPrice, fillQty) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) return;

    await prisma.$transaction(async (tx) => {
      // Create execution record
      const execution = await tx.execution.create({
        data: {
          orderId,
          symbol: order.symbol,
          price: fillPrice,
          qty: fillQty,
          side: order.side,
          mode: 'paper'
        }
      });

      // Update order state
      await tx.order.update({
        where: { id: orderId },
        data: {
          state: 'filled',
          filledAt: new Date()
        }
      });

      // Update position
      await this.updatePosition(tx, order.userId, order.symbol, order.side, fillQty, fillPrice);

      // Handle CO/BO orders
      if (['CO', 'BO'].includes(order.productType)) {
        await this.handleCOBOOrders(tx, order, fillPrice);
      }
    });

    // Log event
    await this.logEvent('order_filled', orderId, {
      fillPrice,
      fillQty,
      symbol: order.symbol
    });

    console.log(`Paper order ${orderId} filled at ${fillPrice} for ${fillQty} ${order.symbol}`);
  }

  /**
   * Reject an order
   * @param {string} orderId - Order ID
   * @param {string} reason - Rejection reason
   */
  async rejectOrder(orderId, reason) {
    await prisma.order.update({
      where: { id: orderId },
      data: {
        state: 'rejected'
      }
    });

    await this.logEvent('order_rejected', orderId, { reason });
    console.log(`Paper order ${orderId} rejected: ${reason}`);
  }

  /**
   * Cancel an order
   * @param {string} orderId - Order ID
   * @returns {Promise<boolean>}
   */
  async cancelOrder(orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order || order.mode !== 'paper') {
      return false;
    }

    if (['filled', 'cancelled', 'rejected'].includes(order.state)) {
      return false;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { state: 'cancelled' }
    });

    await this.logEvent('order_cancelled', orderId, {});
    console.log(`Paper order ${orderId} cancelled`);
    return true;
  }

  /**
   * Update position after fill
   * @param {Object} tx - Prisma transaction
   * @param {string} userId - User ID
   * @param {string} symbol - Symbol
   * @param {number} side - 1 for buy, -1 for sell
   * @param {number} qty - Quantity
   * @param {number} price - Price
   */
  async updatePosition(tx, userId, symbol, side, qty, price) {
    const existingPosition = await tx.position.findUnique({
      where: {
        userId_symbol_mode: {
          userId,
          symbol,
          mode: 'paper'
        }
      }
    });

    if (existingPosition) {
      const newQty = existingPosition.qty + (side * qty);
      
      if (newQty === 0) {
        // Close position
        await tx.position.delete({
          where: { id: existingPosition.id }
        });
      } else {
        // Update position
        const newAvgPrice = ((existingPosition.qty * existingPosition.avgPrice) + (side * qty * price)) / Math.abs(newQty);
        
        await tx.position.update({
          where: { id: existingPosition.id },
          data: {
            qty: newQty,
            avgPrice: newAvgPrice,
            updatedAt: new Date()
          }
        });
      }
    } else if (side * qty > 0) {
      // Create new position
      await tx.position.create({
        data: {
          userId,
          symbol,
          qty: side * qty,
          avgPrice: price,
          mode: 'paper'
        }
      });
    }
  }

  /**
   * Handle CO/BO order logic
   * @param {Object} tx - Prisma transaction
   * @param {Object} parentOrder - Parent order
   * @param {number} fillPrice - Fill price
   */
  async handleCOBOOrders(tx, parentOrder, fillPrice) {
    if (parentOrder.productType === 'CO') {
      // Create stop loss order
      const stopPrice = fillPrice - (parentOrder.side * parentOrder.stopLoss);
      
      await tx.order.create({
        data: {
          userId: parentOrder.userId,
          mode: 'paper',
          side: -parentOrder.side, // Opposite side
          type: 2, // Market order
          productType: 'INTRADAY',
          symbol: parentOrder.symbol,
          qty: parentOrder.qty,
          stopPrice: stopPrice,
          validity: 'DAY',
          state: 'new',
          strategyId: parentOrder.strategyId,
          alertId: parentOrder.alertId
        }
      });
    } else if (parentOrder.productType === 'BO') {
      // Create stop loss and take profit orders
      const stopPrice = fillPrice - (parentOrder.side * parentOrder.stopLoss);
      const targetPrice = fillPrice + (parentOrder.side * parentOrder.takeProfit);
      
      // Stop loss order
      await tx.order.create({
        data: {
          userId: parentOrder.userId,
          mode: 'paper',
          side: -parentOrder.side,
          type: 2, // Market order
          productType: 'INTRADAY',
          symbol: parentOrder.symbol,
          qty: parentOrder.qty,
          stopPrice: stopPrice,
          validity: 'DAY',
          state: 'new',
          strategyId: parentOrder.strategyId,
          alertId: parentOrder.alertId
        }
      });

      // Take profit order
      await tx.order.create({
        data: {
          userId: parentOrder.userId,
          mode: 'paper',
          side: -parentOrder.side,
          type: 1, // Limit order
          productType: 'INTRADAY',
          symbol: parentOrder.symbol,
          qty: parentOrder.qty,
          limitPrice: targetPrice,
          validity: 'DAY',
          state: 'new',
          strategyId: parentOrder.strategyId,
          alertId: parentOrder.alertId
        }
      });
    }
  }

  /**
   * Calculate portfolio PnL
   * @param {string} userId - User ID
   * @param {string} accessToken - Fyers access token
   */
  async calculatePortfolioPnL(userId, accessToken) {
    try {
      const positions = await prisma.position.findMany({
        where: {
          userId,
          mode: 'paper'
        }
      });

      let totalPnL = 0;
      const symbols = positions.map(p => p.symbol);

      if (symbols.length > 0) {
        const quotes = await marketData.getQuotes(symbols, accessToken);
        
        for (const position of positions) {
          const symbolData = quotes?.d?.[position.symbol];
          if (symbolData?.v?.lp) {
            const currentPrice = symbolData.v.lp;
            const mtm = (currentPrice - position.avgPrice) * position.qty;
            
            await prisma.position.update({
              where: { id: position.id },
              data: { mtm }
            });
            
            totalPnL += mtm;
          }
        }
      }

      // Update portfolio
      await prisma.portfolio.upsert({
        where: {
          userId_mode: {
            userId,
            mode: 'paper'
          }
        },
        update: {
          totalPnl: totalPnL,
          updatedAt: new Date()
        },
        create: {
          userId,
          mode: 'paper',
          totalPnl: totalPnL
        }
      });

      return totalPnL;
    } catch (error) {
      console.error("Error calculating portfolio PnL:", error);
      return 0;
    }
  }

  /**
   * Log an event
   * @param {string} type - Event type
   * @param {string} refId - Reference ID
   * @param {Object} payload - Event payload
   */
  async logEvent(type, refId, payload) {
    try {
      await prisma.event.create({
        data: {
          refType: 'order',
          refId,
          type,
          payload
        }
      });
    } catch (error) {
      console.error("Error logging event:", error);
    }
  }

  /**
   * Get engine statistics
   * @returns {Object}
   */
  getStats() {
    return {
      isRunning: !!this.processingInterval,
      activeOrders: this.activeOrders.size,
      isProcessing: this.isProcessing
    };
  }
}

module.exports = new PaperTradingEngine();
