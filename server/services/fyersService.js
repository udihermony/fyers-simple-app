const { fyersModel, fyersOrderSocket } = require("fyers-api-v3");
const { prisma } = require("../prisma/client");

class FyersService {
  constructor() {
    this.clients = new Map(); // Cache clients per user
    this.orderSocket = null;
    this.isSocketConnected = false;
  }

  /**
   * Get or create Fyers client for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getClient(userId) {
    if (this.clients.has(userId)) {
      return this.clients.get(userId);
    }

    const token = await prisma.fyersToken.findFirst({
      where: { userId, appId: process.env.FYERS_APP_ID }
    });

    if (!token) {
      throw new Error("No Fyers token found for user");
    }

    const fyers = new fyersModel({
      path: process.env.LOG_PATH || "/tmp",
      enableLogging: process.env.FYERS_ENABLE_LOGGING === "1"
    });

    fyers.setAppId(process.env.FYERS_APP_ID);
    fyers.setAccessToken(token.accessToken);

    this.clients.set(userId, fyers);
    return fyers;
  }

  /**
   * Place a live order
   * @param {Object} orderData - Order data
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async placeOrder(orderData, userId) {
    try {
      const fyers = await this.getClient(userId);
      
      // Prepare order payload for Fyers API
      const payload = {
        symbol: orderData.symbol,
        qty: orderData.qty,
        type: orderData.type,
        side: orderData.side,
        productType: orderData.productType,
        limitPrice: orderData.limitPrice || 0,
        stopPrice: orderData.stopPrice || 0,
        validity: orderData.validity || "DAY",
        stopLoss: orderData.stopLoss || 0,
        takeProfit: orderData.takeProfit || 0,
        offlineOrder: orderData.offlineOrder || false,
        disclosedQty: orderData.disclosedQty || 0
      };

      // Add order tag if provided and allowed
      if (orderData.orderTag && !['BO', 'CO'].includes(orderData.productType)) {
        payload.orderTag = orderData.orderTag;
      }

      console.log("Placing Fyers order:", payload);

      // Place order via REST API
      const response = await this.placeOrderRest(payload, fyers);
      
      if (response.s === 'ok') {
        // Create order record in database
        const order = await prisma.order.create({
          data: {
            userId,
            mode: 'live',
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
            state: 'working',
            liveOrderId: response.id,
            strategyId: orderData.strategyId,
            alertId: orderData.alertId
          }
        });

        // Log event
        await this.logEvent('order_placed', order.id, {
          orderData,
          userId,
          fyersOrderId: response.id,
          response
        });

        return {
          success: true,
          order,
          fyersOrderId: response.id,
          message: response.message
        };
      } else {
        throw new Error(response.message || 'Order placement failed');
      }
    } catch (error) {
      console.error("Error placing Fyers order:", error);
      throw error;
    }
  }

  /**
   * Place order via REST API
   * @param {Object} payload - Order payload
   * @param {Object} fyers - Fyers client
   * @returns {Promise<Object>}
   */
  async placeOrderRest(payload, fyers) {
    try {
      // Use the SDK method if available
      if (typeof fyers.place_order === 'function') {
        return await fyers.place_order(payload);
      }

      // Fallback to direct HTTP call
      const response = await fetch("https://api-t1.fyers.in/api/v3/orders/sync", {
        method: "POST",
        headers: {
          "Authorization": `${process.env.FYERS_APP_ID}:${fyers.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      return await response.json();
    } catch (error) {
      console.error("REST order placement error:", error);
      throw error;
    }
  }

  /**
   * Cancel a live order
   * @param {string} orderId - Order ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async cancelOrder(orderId, userId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order || order.mode !== 'live' || !order.liveOrderId) {
        return false;
      }

      const fyers = await this.getClient(userId);
      
      // Cancel order via Fyers API
      const response = await this.cancelOrderRest(order.liveOrderId, fyers);
      
      if (response.s === 'ok') {
        await prisma.order.update({
          where: { id: orderId },
          data: { state: 'cancelled' }
        });

        await this.logEvent('order_cancelled', orderId, {
          fyersOrderId: order.liveOrderId,
          response
        });

        return true;
      } else {
        throw new Error(response.message || 'Order cancellation failed');
      }
    } catch (error) {
      console.error("Error cancelling Fyers order:", error);
      throw error;
    }
  }

  /**
   * Cancel order via REST API
   * @param {string} fyersOrderId - Fyers order ID
   * @param {Object} fyers - Fyers client
   * @returns {Promise<Object>}
   */
  async cancelOrderRest(fyersOrderId, fyers) {
    try {
      // Use the SDK method if available
      if (typeof fyers.cancel_order === 'function') {
        return await fyers.cancel_order({ id: fyersOrderId });
      }

      // Fallback to direct HTTP call
      const response = await fetch("https://api-t1.fyers.in/api/v3/orders/cancel", {
        method: "POST",
        headers: {
          "Authorization": `${process.env.FYERS_APP_ID}:${fyers.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: fyersOrderId })
      });

      return await response.json();
    } catch (error) {
      console.error("REST order cancellation error:", error);
      throw error;
    }
  }

  /**
   * Modify a live order
   * @param {string} orderId - Order ID
   * @param {Object} modifications - Modifications to apply
   * @param {string} userId - User ID
   * @returns {Promise<boolean>}
   */
  async modifyOrder(orderId, modifications, userId) {
    try {
      const order = await prisma.order.findUnique({
        where: { id: orderId }
      });

      if (!order || order.mode !== 'live' || !order.liveOrderId) {
        return false;
      }

      const fyers = await this.getClient(userId);
      
      // Prepare modification payload
      const payload = {
        id: order.liveOrderId,
        ...modifications
      };

      // Modify order via Fyers API
      const response = await this.modifyOrderRest(payload, fyers);
      
      if (response.s === 'ok') {
        // Update order in database
        const updateData = {};
        if (modifications.qty) updateData.qty = modifications.qty;
        if (modifications.limitPrice) updateData.limitPrice = modifications.limitPrice;
        if (modifications.stopPrice) updateData.stopPrice = modifications.stopPrice;

        await prisma.order.update({
          where: { id: orderId },
          data: updateData
        });

        await this.logEvent('order_modified', orderId, {
          fyersOrderId: order.liveOrderId,
          modifications,
          response
        });

        return true;
      } else {
        throw new Error(response.message || 'Order modification failed');
      }
    } catch (error) {
      console.error("Error modifying Fyers order:", error);
      throw error;
    }
  }

  /**
   * Modify order via REST API
   * @param {Object} payload - Modification payload
   * @param {Object} fyers - Fyers client
   * @returns {Promise<Object>}
   */
  async modifyOrderRest(payload, fyers) {
    try {
      // Use the SDK method if available
      if (typeof fyers.modify_order === 'function') {
        return await fyers.modify_order(payload);
      }

      // Fallback to direct HTTP call
      const response = await fetch("https://api-t1.fyers.in/api/v3/orders/modify", {
        method: "POST",
        headers: {
          "Authorization": `${process.env.FYERS_APP_ID}:${fyers.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      return await response.json();
    } catch (error) {
      console.error("REST order modification error:", error);
      throw error;
    }
  }

  /**
   * Get order book
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getOrderBook(userId) {
    try {
      const fyers = await this.getClient(userId);
      
      // Use the SDK method if available
      if (typeof fyers.get_orderbook === 'function') {
        return await fyers.get_orderbook();
      }

      // Fallback to direct HTTP call
      const response = await fetch("https://api-t1.fyers.in/api/v3/orders", {
        headers: {
          "Authorization": `${process.env.FYERS_APP_ID}:${fyers.access_token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error("Error fetching order book:", error);
      throw error;
    }
  }

  /**
   * Get trade book
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getTradeBook(userId) {
    try {
      const fyers = await this.getClient(userId);
      
      // Use the SDK method if available
      if (typeof fyers.get_tradebook === 'function') {
        return await fyers.get_tradebook();
      }

      // Fallback to direct HTTP call
      const response = await fetch("https://api-t1.fyers.in/api/v3/tradebook", {
        headers: {
          "Authorization": `${process.env.FYERS_APP_ID}:${fyers.access_token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error("Error fetching trade book:", error);
      throw error;
    }
  }

  /**
   * Get positions
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  async getPositions(userId) {
    try {
      const fyers = await this.getClient(userId);
      
      // Use the SDK method if available
      if (typeof fyers.get_positions === 'function') {
        return await fyers.get_positions();
      }

      // Fallback to direct HTTP call
      const response = await fetch("https://api-t1.fyers.in/api/v3/positions", {
        headers: {
          "Authorization": `${process.env.FYERS_APP_ID}:${fyers.access_token}`
        }
      });

      return await response.json();
    } catch (error) {
      console.error("Error fetching positions:", error);
      throw error;
    }
  }

  /**
   * Start WebSocket connection for order updates
   * @param {string} userId - User ID
   */
  async startOrderSocket(userId) {
    try {
      const token = await prisma.fyersToken.findFirst({
        where: { userId, appId: process.env.FYERS_APP_ID }
      });

      if (!token) {
        throw new Error("No Fyers token found for user");
      }

      if (this.orderSocket) {
        this.orderSocket.disconnect();
      }

      this.orderSocket = new fyersOrderSocket(
        `${process.env.FYERS_APP_ID}:${token.accessToken}`,
        process.env.LOG_PATH || "/tmp",
        true
      );

      this.orderSocket.on("connect", () => {
        console.log("Fyers order socket connected");
        this.isSocketConnected = true;
        
        // Subscribe to order, trade, and position updates
        this.orderSocket.subscribe([
          this.orderSocket.orderUpdates,
          this.orderSocket.tradeUpdates,
          this.orderSocket.positionUpdates
        ]);
      });

      this.orderSocket.on("disconnect", () => {
        console.log("Fyers order socket disconnected");
        this.isSocketConnected = false;
      });

      this.orderSocket.on("orders", (msg) => {
        this.handleOrderUpdate(msg);
      });

      this.orderSocket.on("trades", (msg) => {
        this.handleTradeUpdate(msg);
      });

      this.orderSocket.on("positions", (msg) => {
        this.handlePositionUpdate(msg);
      });

      this.orderSocket.connect();
    } catch (error) {
      console.error("Error starting order socket:", error);
      throw error;
    }
  }

  /**
   * Stop WebSocket connection
   */
  stopOrderSocket() {
    if (this.orderSocket) {
      this.orderSocket.disconnect();
      this.orderSocket = null;
      this.isSocketConnected = false;
    }
  }

  /**
   * Handle order updates from WebSocket
   * @param {Object} msg - Order update message
   */
  async handleOrderUpdate(msg) {
    try {
      console.log("Order update received:", msg);
      
      // Update order state in database
      if (msg.id) {
        await prisma.order.updateMany({
          where: { liveOrderId: msg.id },
          data: {
            state: this.mapFyersOrderState(msg.status),
            updatedAt: new Date()
          }
        });
      }
    } catch (error) {
      console.error("Error handling order update:", error);
    }
  }

  /**
   * Handle trade updates from WebSocket
   * @param {Object} msg - Trade update message
   */
  async handleTradeUpdate(msg) {
    try {
      console.log("Trade update received:", msg);
      
      // Create execution record
      if (msg.id) {
        const order = await prisma.order.findFirst({
          where: { liveOrderId: msg.id }
        });

        if (order) {
          await prisma.execution.create({
            data: {
              orderId: order.id,
              symbol: msg.symbol,
              price: msg.price,
              qty: msg.qty,
              side: msg.side,
              mode: 'live'
            }
          });
        }
      }
    } catch (error) {
      console.error("Error handling trade update:", error);
    }
  }

  /**
   * Handle position updates from WebSocket
   * @param {Object} msg - Position update message
   */
  async handlePositionUpdate(msg) {
    try {
      console.log("Position update received:", msg);
      // Position updates are handled by the frontend polling
    } catch (error) {
      console.error("Error handling position update:", error);
    }
  }

  /**
   * Map Fyers order state to our state
   * @param {string} fyersState - Fyers order state
   * @returns {string}
   */
  mapFyersOrderState(fyersState) {
    const stateMap = {
      '1': 'new',
      '2': 'working',
      '3': 'filled',
      '4': 'cancelled',
      '5': 'rejected',
      '6': 'partial'
    };
    
    return stateMap[fyersState] || 'working';
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
   * Get service statistics
   * @returns {Object}
   */
  getStats() {
    return {
      connectedClients: this.clients.size,
      socketConnected: this.isSocketConnected,
      hasOrderSocket: !!this.orderSocket
    };
  }
}

module.exports = new FyersService();
