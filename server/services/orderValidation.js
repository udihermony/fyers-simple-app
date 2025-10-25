const symbolMaster = require('./symbolMaster');
const marketData = require('./marketData');

class OrderValidationService {
  constructor() {
    this.maxNotionalPerOrder = parseFloat(process.env.MAX_NOTIONAL_PER_ORDER || "1000000"); // 10L default
    this.maxOrdersPerMinute = parseInt(process.env.MAX_ORDERS_PER_MINUTE || "10", 10);
    this.orderCounts = new Map(); // Track orders per minute per user
  }

  /**
   * Validate order payload comprehensively
   * @param {Object} orderPayload - Order data from Chartlink or manual input
   * @param {string} userId - User ID for risk checks
   * @param {string} accessToken - Fyers access token for market data
   * @returns {Promise<{isValid: boolean, errors: Array<string>, warnings: Array<string>}>}
   */
  async validateOrder(orderPayload, userId, accessToken) {
    const errors = [];
    const warnings = [];

    try {
      // Basic field validation
      const basicValidation = this.validateBasicFields(orderPayload);
      errors.push(...basicValidation.errors);
      warnings.push(...basicValidation.warnings);

      if (basicValidation.errors.length > 0) {
        return { isValid: false, errors, warnings };
      }

      // Get symbol metadata
      const symbolMeta = await symbolMaster.getSymbolMeta(orderPayload.symbol);
      
      // Price validations
      const priceValidation = await this.validatePrices(orderPayload, symbolMeta, accessToken);
      errors.push(...priceValidation.errors);
      warnings.push(...priceValidation.warnings);

      // Quantity validations
      const qtyValidation = this.validateQuantity(orderPayload.qty, symbolMeta);
      errors.push(...qtyValidation.errors);
      warnings.push(...qtyValidation.warnings);

      // Product type validations
      const productValidation = this.validateProductType(orderPayload);
      errors.push(...productValidation.errors);
      warnings.push(...productValidation.warnings);

      // Risk validations
      const riskValidation = await this.validateRiskLimits(orderPayload, userId);
      errors.push(...riskValidation.errors);
      warnings.push(...riskValidation.warnings);

      // Order tag validation
      const tagValidation = this.validateOrderTag(orderPayload.orderTag, orderPayload.productType);
      errors.push(...tagValidation.errors);
      warnings.push(...tagValidation.warnings);

      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };

    } catch (error) {
      console.error("Order validation error:", error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Validate basic required fields
   * @param {Object} payload 
   * @returns {Object}
   */
  validateBasicFields(payload) {
    const errors = [];
    const warnings = [];

    // Required fields
    const requiredFields = ['symbol', 'side', 'type', 'productType', 'qty'];
    for (const field of requiredFields) {
      if (!payload[field] && payload[field] !== 0) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Symbol format validation
    if (payload.symbol && !this.isValidSymbolFormat(payload.symbol)) {
      errors.push(`Invalid symbol format: ${payload.symbol}. Expected format: EXCHANGE:SYMBOL-SEGMENT`);
    }

    // Side validation
    if (payload.side && ![1, -1].includes(payload.side)) {
      errors.push(`Invalid side: ${payload.side}. Must be 1 (buy) or -1 (sell)`);
    }

    // Type validation
    if (payload.type && ![1, 2, 3, 4].includes(payload.type)) {
      errors.push(`Invalid order type: ${payload.type}. Must be 1-4 (limit, market, stop, stop-limit)`);
    }

    // Product type validation
    const validProductTypes = ['INTRADAY', 'CNC', 'MARGIN', 'CO', 'BO', 'MTF'];
    if (payload.productType && !validProductTypes.includes(payload.productType)) {
      errors.push(`Invalid product type: ${payload.productType}. Must be one of: ${validProductTypes.join(', ')}`);
    }

    // Quantity validation
    if (payload.qty && (typeof payload.qty !== 'number' || payload.qty <= 0)) {
      errors.push(`Invalid quantity: ${payload.qty}. Must be a positive number`);
    }

    return { errors, warnings };
  }

  /**
   * Validate prices against tick size and market conditions
   * @param {Object} payload 
   * @param {Object} symbolMeta 
   * @param {string} accessToken 
   * @returns {Promise<Object>}
   */
  async validatePrices(payload, symbolMeta, accessToken) {
    const errors = [];
    const warnings = [];

    try {
      const ltp = await marketData.getLTP(payload.symbol, accessToken);
      
      // Validate limit price
      if (payload.limitPrice && payload.limitPrice > 0) {
        if (!symbolMaster.isValidTickMultiple(payload.limitPrice, symbolMeta.tickSize)) {
          errors.push(`Limit price ${payload.limitPrice} is not a valid tick multiple. Tick size: ${symbolMeta.tickSize}`);
        }
        
        if (ltp && payload.type === 1) { // Limit order
          const spread = Math.abs(payload.limitPrice - ltp) / ltp;
          if (spread > 0.1) { // More than 10% away from LTP
            warnings.push(`Limit price is ${(spread * 100).toFixed(1)}% away from LTP (${ltp})`);
          }
        }
      }

      // Validate stop price
      if (payload.stopPrice && payload.stopPrice > 0) {
        if (!symbolMaster.isValidTickMultiple(payload.stopPrice, symbolMeta.tickSize)) {
          errors.push(`Stop price ${payload.stopPrice} is not a valid tick multiple. Tick size: ${symbolMeta.tickSize}`);
        }

        if (ltp && payload.type >= 3) { // Stop or stop-limit orders
          if (payload.side === 1) { // Buy
            if (payload.stopPrice < ltp) {
              errors.push(`Buy stop price ${payload.stopPrice} must be >= LTP ${ltp}`);
            }
          } else { // Sell
            if (payload.stopPrice > ltp) {
              errors.push(`Sell stop price ${payload.stopPrice} must be <= LTP ${ltp}`);
            }
          }
        }
      }

      // Validate stop-loss for CO/BO
      if (payload.stopLoss && payload.stopLoss > 0) {
        if (!symbolMaster.isValidTickMultiple(payload.stopLoss, symbolMeta.tickSize)) {
          errors.push(`Stop loss ${payload.stopLoss} is not a valid tick multiple. Tick size: ${symbolMeta.tickSize}`);
        }

        if (['CO', 'BO'].includes(payload.productType)) {
          if (payload.stopLoss <= 0) {
            errors.push(`Stop loss is required and must be > 0 for ${payload.productType} orders`);
          }
        }
      }

      // Validate take-profit for BO
      if (payload.takeProfit && payload.takeProfit > 0) {
        if (!symbolMaster.isValidTickMultiple(payload.takeProfit, symbolMeta.tickSize)) {
          errors.push(`Take profit ${payload.takeProfit} is not a valid tick multiple. Tick size: ${symbolMeta.tickSize}`);
        }

        if (payload.productType === 'BO' && payload.takeProfit <= 0) {
          errors.push(`Take profit is required and must be > 0 for BO orders`);
        }
      }

      // Stop-limit specific validations
      if (payload.type === 4) { // Stop-limit
        if (payload.side === 1) { // Buy
          if (payload.stopPrice < payload.limitPrice) {
            errors.push(`For buy stop-limit: stop price ${payload.stopPrice} must be >= limit price ${payload.limitPrice}`);
          }
        } else { // Sell
          if (payload.stopPrice > payload.limitPrice) {
            errors.push(`For sell stop-limit: stop price ${payload.stopPrice} must be <= limit price ${payload.limitPrice}`);
          }
        }
      }

    } catch (error) {
      warnings.push(`Could not validate prices against market data: ${error.message}`);
    }

    return { errors, warnings };
  }

  /**
   * Validate quantity against lot size
   * @param {number} qty 
   * @param {Object} symbolMeta 
   * @returns {Object}
   */
  validateQuantity(qty, symbolMeta) {
    const errors = [];
    const warnings = [];

    if (!symbolMaster.isValidLotMultiple(qty, symbolMeta.lotSize)) {
      errors.push(`Quantity ${qty} must be a multiple of lot size ${symbolMeta.lotSize}`);
    }

    if (qty > 10000) {
      warnings.push(`Large quantity: ${qty}. Please verify this is intentional.`);
    }

    return { errors, warnings };
  }

  /**
   * Validate product type specific rules
   * @param {Object} payload 
   * @returns {Object}
   */
  validateProductType(payload) {
    const errors = [];
    const warnings = [];

    // CO (Cover Order) validations
    if (payload.productType === 'CO') {
      if (!payload.stopLoss || payload.stopLoss <= 0) {
        errors.push('Stop loss is mandatory for CO orders');
      }
      if (payload.disclosedQty && payload.disclosedQty > 0) {
        errors.push('Disclosed quantity must be 0 for CO orders');
      }
      if (payload.validity !== 'DAY') {
        errors.push('Validity must be DAY for CO orders');
      }
      if (![1, 2].includes(payload.type)) { // Only limit or market
        errors.push('CO orders only support limit (1) or market (2) types');
      }
    }

    // BO (Bracket Order) validations
    if (payload.productType === 'BO') {
      if (!payload.stopLoss || payload.stopLoss <= 0) {
        errors.push('Stop loss is mandatory for BO orders');
      }
      if (!payload.takeProfit || payload.takeProfit <= 0) {
        errors.push('Take profit is mandatory for BO orders');
      }
      if (payload.disclosedQty && payload.disclosedQty > 0) {
        errors.push('Disclosed quantity must be 0 for BO orders');
      }
      if (payload.validity !== 'DAY') {
        errors.push('Validity must be DAY for BO orders');
      }
    }

    // MTF validations
    if (payload.productType === 'MTF') {
      warnings.push('MTF orders require special approval. Please verify symbol is MTF enabled.');
    }

    return { errors, warnings };
  }

  /**
   * Validate risk limits
   * @param {Object} payload 
   * @param {string} userId 
   * @returns {Promise<Object>}
   */
  async validateRiskLimits(payload, userId) {
    const errors = [];
    const warnings = [];

    // Calculate notional value
    const notional = (payload.limitPrice || 0) * payload.qty;
    
    if (notional > this.maxNotionalPerOrder) {
      errors.push(`Order notional ${notional} exceeds maximum allowed ${this.maxNotionalPerOrder}`);
    }

    // Check order rate limiting
    const now = Date.now();
    const minuteKey = `${userId}_${Math.floor(now / 60000)}`;
    
    if (!this.orderCounts.has(minuteKey)) {
      this.orderCounts.set(minuteKey, 0);
    }
    
    const currentCount = this.orderCounts.get(minuteKey);
    if (currentCount >= this.maxOrdersPerMinute) {
      errors.push(`Order rate limit exceeded: ${currentCount}/${this.maxOrdersPerMinute} orders per minute`);
    }

    // Clean up old entries
    this.cleanupOrderCounts();

    return { errors, warnings };
  }

  /**
   * Validate order tag
   * @param {string} orderTag 
   * @param {string} productType 
   * @returns {Object}
   */
  validateOrderTag(orderTag, productType) {
    const errors = [];
    const warnings = [];

    if (orderTag) {
      // Order tag not allowed for BO/CO
      if (['BO', 'CO'].includes(productType)) {
        errors.push('Order tag is not supported for BO and CO orders');
      }

      // Validate format
      if (orderTag.length < 1 || orderTag.length > 30) {
        errors.push('Order tag must be 1-30 characters long');
      }

      if (!/^[a-zA-Z0-9]+$/.test(orderTag)) {
        errors.push('Order tag must contain only alphanumeric characters');
      }

      if (['clientID', 'Untagged'].includes(orderTag)) {
        errors.push(`Order tag cannot be '${orderTag}'`);
      }
    }

    return { errors, warnings };
  }

  /**
   * Check if symbol format is valid
   * @param {string} symbol 
   * @returns {boolean}
   */
  isValidSymbolFormat(symbol) {
    // Basic format: EXCHANGE:SYMBOL-SEGMENT
    return /^[A-Z]+:[A-Z0-9]+-[A-Z]+$/.test(symbol);
  }

  /**
   * Clean up old order count entries
   */
  cleanupOrderCounts() {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    for (const [key] of this.orderCounts) {
      const minute = parseInt(key.split('_')[1]);
      if (currentMinute - minute > 5) { // Keep last 5 minutes
        this.orderCounts.delete(key);
      }
    }
  }

  /**
   * Get validation statistics
   * @returns {Object}
   */
  getStats() {
    return {
      maxNotionalPerOrder: this.maxNotionalPerOrder,
      maxOrdersPerMinute: this.maxOrdersPerMinute,
      activeOrderCounts: this.orderCounts.size
    };
  }
}

module.exports = new OrderValidationService();
