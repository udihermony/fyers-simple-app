const { fyersModel } = require("fyers-api-v3");

class MarketDataService {
  constructor() {
    this.quoteCache = new Map();
    this.cacheExpiry = 5 * 1000; // 5 seconds for quotes
    this.fyersClient = null;
  }

  /**
   * Initialize Fyers client with access token
   * @param {string} accessToken 
   */
  initializeClient(accessToken) {
    this.fyersClient = new fyersModel({
      path: process.env.LOG_PATH || "/tmp",
      enableLogging: process.env.FYERS_ENABLE_LOGGING === "1"
    });
    this.fyersClient.setAppId(process.env.FYERS_APP_ID);
    this.fyersClient.setAccessToken(accessToken);
  }

  /**
   * Get current quotes for symbols
   * @param {Array<string>} symbols - Array of symbols like ["NSE:SBIN-EQ"]
   * @param {string} accessToken - Fyers access token
   * @returns {Promise<Object>}
   */
  async getQuotes(symbols, accessToken) {
    if (!accessToken) {
      throw new Error("Access token required for market data");
    }

    if (!this.fyersClient) {
      this.initializeClient(accessToken);
    }

    const cacheKey = symbols.sort().join(',');
    const cached = this.quoteCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      const quotes = await this.fyersClient.getQuotes(symbols);
      
      // Cache the result
      this.quoteCache.set(cacheKey, {
        data: quotes,
        timestamp: Date.now()
      });

      return quotes;
    } catch (error) {
      console.error("Error fetching quotes:", error);
      throw error;
    }
  }

  /**
   * Get Last Traded Price (LTP) for a symbol
   * @param {string} symbol 
   * @param {string} accessToken 
   * @returns {Promise<number|null>}
   */
  async getLTP(symbol, accessToken) {
    try {
      const quotes = await this.getQuotes([symbol], accessToken);
      
      if (quotes && quotes.d && quotes.d[symbol]) {
        const symbolData = quotes.d[symbol];
        return symbolData.v?.lp || symbolData.v?.c || null;
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting LTP for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get bid-ask spread for a symbol
   * @param {string} symbol 
   * @param {string} accessToken 
   * @returns {Promise<{bid: number, ask: number, spread: number}|null>}
   */
  async getBidAsk(symbol, accessToken) {
    try {
      const quotes = await this.getQuotes([symbol], accessToken);
      
      if (quotes && quotes.d && quotes.d[symbol]) {
        const symbolData = quotes.d[symbol];
        const bid = symbolData.v?.bid || 0;
        const ask = symbolData.v?.ask || 0;
        const spread = ask - bid;
        
        return { bid, ask, spread };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting bid-ask for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Check if market is open for a symbol
   * @param {string} symbol 
   * @param {string} accessToken 
   * @returns {Promise<boolean>}
   */
  async isMarketOpen(symbol, accessToken) {
    try {
      const quotes = await this.getQuotes([symbol], accessToken);
      
      if (quotes && quotes.d && quotes.d[symbol]) {
        const symbolData = quotes.d[symbol];
        return symbolData.v?.tt === "EQ" || symbolData.v?.tt === "FUT" || symbolData.v?.tt === "OPT";
      }
      
      return false;
    } catch (error) {
      console.error(`Error checking market status for ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Get market depth for a symbol
   * @param {string} symbol 
   * @param {string} accessToken 
   * @returns {Promise<Object|null>}
   */
  async getMarketDepth(symbol, accessToken) {
    try {
      const quotes = await this.getQuotes([symbol], accessToken);
      
      if (quotes && quotes.d && quotes.d[symbol]) {
        const symbolData = quotes.d[symbol];
        return {
          bids: symbolData.v?.bids || [],
          asks: symbolData.v?.asks || [],
          timestamp: symbolData.v?.timestamp || Date.now()
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting market depth for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Simulate realistic fill price for paper trading
   * @param {string} symbol 
   * @param {number} side - 1 for buy, -1 for sell
   * @param {number} orderType - 1=limit, 2=market, 3=stop, 4=stop-limit
   * @param {number} limitPrice - For limit orders
   * @param {number} stopPrice - For stop orders
   * @param {string} accessToken 
   * @returns {Promise<number|null>}
   */
  async simulateFillPrice(symbol, side, orderType, limitPrice, stopPrice, accessToken) {
    try {
      console.log(`Simulating fill for ${symbol}, side: ${side}, type: ${orderType}`);
      
      const ltp = await this.getLTP(symbol, accessToken);
      console.log(`LTP for ${symbol}: ${ltp}`);
      if (!ltp) {
        console.log(`No LTP available for ${symbol}`);
        return null;
      }

      const bidAsk = await this.getBidAsk(symbol, accessToken);
      console.log(`Bid-Ask for ${symbol}:`, bidAsk);
      if (!bidAsk) {
        console.log(`No bid-ask data available for ${symbol}`);
        return null;
      }

      // Add slippage (configurable, default 0.1%)
      const slippageBps = parseInt(process.env.PAPER_SLIPPAGE_BPS || "10", 10);
      const slippage = ltp * (slippageBps / 10000);

      switch (orderType) {
        case 1: // Limit order
          if (side === 1) { // Buy
            // Fill at limit price if market touches it, otherwise at ask + slippage
            return Math.min(limitPrice, bidAsk.ask + slippage);
          } else { // Sell
            // Fill at limit price if market touches it, otherwise at bid - slippage
            return Math.max(limitPrice, bidAsk.bid - slippage);
          }

        case 2: // Market order
          if (side === 1) { // Buy at ask + slippage
            return bidAsk.ask + slippage;
          } else { // Sell at bid - slippage
            return bidAsk.bid - slippage;
          }

        case 3: // Stop order (SL-M)
          if (side === 1) { // Buy stop
            return ltp >= stopPrice ? bidAsk.ask + slippage : null;
          } else { // Sell stop
            return ltp <= stopPrice ? bidAsk.bid - slippage : null;
          }

        case 4: // Stop-limit order (SL-L)
          if (side === 1) { // Buy stop-limit
            return ltp >= stopPrice ? Math.min(limitPrice, bidAsk.ask + slippage) : null;
          } else { // Sell stop-limit
            return ltp <= stopPrice ? Math.max(limitPrice, bidAsk.bid - slippage) : null;
          }

        default:
          return null;
      }
    } catch (error) {
      console.error(`Error simulating fill price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Clear quote cache
   * @param {string} symbols - Optional, specific symbols to clear
   */
  clearCache(symbols = null) {
    if (symbols) {
      const cacheKey = Array.isArray(symbols) ? symbols.sort().join(',') : symbols;
      this.quoteCache.delete(cacheKey);
    } else {
      this.quoteCache.clear();
    }
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getCacheStats() {
    return {
      size: this.quoteCache.size,
      keys: Array.from(this.quoteCache.keys()),
      expiry: this.cacheExpiry
    };
  }
}

module.exports = new MarketDataService();
