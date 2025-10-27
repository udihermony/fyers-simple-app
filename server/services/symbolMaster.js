// File: Symbol Master Service
// Path: server/services/symbolMaster.js

const { prisma } = require("../prisma/client");

class SymbolMasterService {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours
  }

  /**
   * Get symbol metadata (tick size, lot size, segment, exchange)
   * @param {string} symbol - Symbol like "NSE:SBIN-EQ"
   * @returns {Promise<{tickSize: number, lotSize: number, segment: string, exchange: string}>}
   */
  async getSymbolMeta(symbol) {
    const cacheKey = symbol;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    try {
      // Try to get from database first
      let meta = await prisma.symbolMeta.findUnique({
        where: { symbol }
      });

      if (!meta) {
        // If not in DB, fetch from Fyers and cache
        meta = await this.fetchAndCacheSymbolMeta(symbol);
      }

      if (!meta) {
        throw new Error(`Symbol metadata not found for ${symbol}`);
      }

      const result = {
        tickSize: meta.tickSize,
        lotSize: meta.lotSize,
        segment: meta.segment,
        exchange: meta.exchange
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error(`Error getting symbol meta for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch symbol metadata from Fyers API and store in database
   * @param {string} symbol 
   * @returns {Promise<Object|null>}
   */
  async fetchAndCacheSymbolMeta(symbol) {
    try {
      // This would typically call Fyers symbol master API
      // For now, we'll use common defaults based on symbol patterns
      const meta = this.getDefaultSymbolMeta(symbol);
      
      if (meta) {
        await prisma.symbolMeta.upsert({
          where: { symbol },
          update: meta,
          create: { symbol, ...meta }
        });
        return meta;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching symbol meta for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Get default symbol metadata based on symbol patterns
   * @param {string} symbol 
   * @returns {Object|null}
   */
  getDefaultSymbolMeta(symbol) {
    const symbolUpper = symbol.toUpperCase();
    
    // Equity symbols
    if (symbolUpper.includes('-EQ')) {
      return {
        tickSize: 0.05,
        lotSize: 1,
        segment: 'EQ',
        exchange: symbolUpper.split(':')[0] || 'NSE'
      };
    }
    
    // Futures symbols
    if (symbolUpper.includes('-FUT')) {
      return {
        tickSize: 0.05,
        lotSize: 25, // Default lot size for futures
        segment: 'FUT',
        exchange: symbolUpper.split(':')[0] || 'NSE'
      };
    }
    
    // Options symbols
    if (symbolUpper.includes('-OPT')) {
      return {
        tickSize: 0.05,
        lotSize: 25, // Default lot size for options
        segment: 'OPT',
        exchange: symbolUpper.split(':')[0] || 'NSE'
      };
    }
    
    // Currency futures
    if (symbolUpper.includes('USDINR') || symbolUpper.includes('EURINR')) {
      return {
        tickSize: 0.0025,
        lotSize: 1000,
        segment: 'CUR',
        exchange: 'MCX'
      };
    }
    
    // Commodity futures
    if (symbolUpper.includes('GOLD') || symbolUpper.includes('SILVER')) {
      return {
        tickSize: 1,
        lotSize: 1,
        segment: 'COM',
        exchange: 'MCX'
      };
    }
    
    // Default for unknown symbols
    return {
      tickSize: 0.05,
      lotSize: 1,
      segment: 'EQ',
      exchange: 'NSE'
    };
  }

  /**
   * Validate if a price is a valid tick multiple
   * @param {number} price 
   * @param {number} tickSize 
   * @returns {boolean}
   */
  isValidTickMultiple(price, tickSize) {
    if (tickSize === 0) return true;
    return Math.abs(price / tickSize - Math.round(price / tickSize)) < 1e-6;
  }

  /**
   * Round price to nearest valid tick
   * @param {number} price 
   * @param {number} tickSize 
   * @returns {number}
   */
  roundToTick(price, tickSize) {
    if (tickSize === 0) return price;
    return Math.round(price / tickSize) * tickSize;
  }

  /**
   * Validate if quantity is valid for the symbol
   * @param {number} qty 
   * @param {number} lotSize 
   * @returns {boolean}
   */
  isValidLotMultiple(qty, lotSize) {
    return qty > 0 && qty % lotSize === 0;
  }

  /**
   * Get all cached symbols
   * @returns {Array<string>}
   */
  getCachedSymbols() {
    return Array.from(this.cache.keys());
  }

  /**
   * Clear cache for a specific symbol or all symbols
   * @param {string} symbol - Optional, if not provided clears all
   */
  clearCache(symbol = null) {
    if (symbol) {
      this.cache.delete(symbol);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Preload common symbols
   */
  async preloadCommonSymbols() {
    const commonSymbols = [
      'NSE:SBIN-EQ',
      'NSE:TCS-EQ',
      'NSE:RELIANCE-EQ',
      'NSE:INFY-EQ',
      'NSE:HDFC-EQ',
      'NSE:ICICIBANK-EQ',
      'NSE:KOTAKBANK-EQ',
      'NSE:LT-EQ',
      'NSE:ITC-EQ',
      'NSE:HINDUNILVR-EQ'
    ];

    for (const symbol of commonSymbols) {
      try {
        await this.getSymbolMeta(symbol);
      } catch (error) {
        console.warn(`Failed to preload symbol ${symbol}:`, error.message);
      }
    }
  }
}

module.exports = new SymbolMasterService();
