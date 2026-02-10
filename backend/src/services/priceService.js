import YahooFinance from "yahoo-finance2";
import axios from "axios";
import NodeCache from "node-cache";
import logger from "../utils/logger.js";

// Cache prices for 5 minutes (free tier friendly)
const priceCache = new NodeCache({ stdTTL: 300 });

// ✅ V3 requires instantiation
const yahooFinance = new YahooFinance();

class PriceService {
  /**
   * Get stock price from Yahoo Finance (v3 compatible)
   */
  async getStockPrice(symbol, exchange = "US") {
    const cacheKey = `stock:${symbol}:${exchange}`;
    const cached = priceCache.get(cacheKey);
    if (cached) return cached;

    try {
      // For Malaysian stocks, ensure .KL suffix
      const yahooSymbol =
        exchange === "KLSE" && !symbol.endsWith(".KL")
          ? `${symbol}.KL`
          : symbol;

      // ✅ V3 API: Use instantiated yahooFinance
      const quote = await yahooFinance.quote(yahooSymbol);

      if (!quote) {
        throw new Error(`No data found for ${yahooSymbol}`);
      }

      const priceData = {
        price: quote.regularMarketPrice || 0,
        currency: quote.currency || "USD",
        change24h:
          quote.regularMarketChangePercent !== undefined
            ? quote.regularMarketChangePercent
            : 0,
        lastUpdated: new Date(),
        source: "yahoo-finance",
      };

      priceCache.set(cacheKey, priceData);
      return priceData;
    } catch (error) {
      logger.error("Yahoo Finance error:", {
        symbol,
        exchange,
        error: error.message,
      });
      return {
        price: 0,
        currency: "USD",
        change24h: 0,
        lastUpdated: new Date(),
        source: "yahoo-finance",
        error: true,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Get crypto price from CoinGecko (free, no API key)
   */
  async getCryptoPrice(symbol) {
    const cacheKey = `crypto:${symbol}`;
    const cached = priceCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Map common symbols to CoinGecko IDs
      const coinMap = {
        BTC: "bitcoin",
        ETH: "ethereum",
        USDT: "tether",
        BNB: "binancecoin",
        SOL: "solana",
        XRP: "ripple",
        ADA: "cardano",
        DOGE: "dogecoin",
        MATIC: "matic-network",
        DOT: "polkadot",
        AVAX: "avalanche-2",
        LINK: "chainlink",
        UNI: "uniswap",
      };

      const coinId = coinMap[symbol.toUpperCase()] || symbol.toLowerCase();

      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: {
            ids: coinId,
            vs_currencies: "usd",
            include_24hr_change: true,
          },
          timeout: 10000,
        },
      );

      const data = response.data[coinId];
      if (!data) {
        throw new Error(`Crypto ${symbol} not found on CoinGecko`);
      }

      const priceData = {
        price: data.usd || 0,
        currency: "USD",
        change24h: data.usd_24h_change || 0,
        lastUpdated: new Date(),
        source: "coingecko",
      };

      priceCache.set(cacheKey, priceData);
      return priceData;
    } catch (error) {
      logger.error("CoinGecko error:", {
        symbol,
        error: error.message,
      });
      return {
        price: 0,
        currency: "USD",
        change24h: 0,
        lastUpdated: new Date(),
        source: "coingecko",
        error: true,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Get gold price from GoldAPI
   */
  async getGoldPrice() {
    const cacheKey = "gold:XAU";
    const cached = priceCache.get(cacheKey);
    if (cached) return cached;

    try {
      const apiKey = process.env.GOLD_API_KEY;
      if (!apiKey) {
        logger.warn("GOLD_API_KEY not configured");
        return {
          price: 0,
          currency: "USD",
          change24h: 0,
          lastUpdated: new Date(),
          source: "goldapi",
          error: true,
          errorMessage: "API key not configured",
        };
      }

      const response = await axios.get("https://www.goldapi.io/api/XAU/USD", {
        headers: { "x-access-token": apiKey },
        timeout: 10000,
      });

      const priceData = {
        price: response.data.price || 0,
        currency: "USD",
        change24h: response.data.ch || 0,
        lastUpdated: new Date(),
        source: "goldapi",
      };

      priceCache.set(cacheKey, priceData);
      return priceData;
    } catch (error) {
      logger.error("GoldAPI error:", {
        error: error.message,
        response: error.response?.data,
      });
      return {
        price: 0,
        currency: "USD",
        change24h: 0,
        lastUpdated: new Date(),
        source: "goldapi",
        error: true,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Get MYR exchange rate
   */
  async getMYRRate(fromCurrency = "USD") {
    if (fromCurrency === "MYR") return 1;

    const cacheKey = `fx:${fromCurrency}:MYR`;
    const cached = priceCache.get(cacheKey);
    if (cached) return cached;

    try {
      const apiKey = process.env.EXCHANGE_RATE_API_KEY;
      if (!apiKey) {
        logger.warn("EXCHANGE_RATE_API_KEY not configured, using fallback");
        // Fallback rate (approximate)
        const fallbackRate = 4.5;
        priceCache.set(cacheKey, fallbackRate);
        return fallbackRate;
      }

      const response = await axios.get(
        `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${fromCurrency}`,
        { timeout: 10000 },
      );

      const rate = response.data.conversion_rates?.MYR || 4.5;
      priceCache.set(cacheKey, rate);
      return rate;
    } catch (error) {
      logger.error("Exchange rate error:", {
        fromCurrency,
        error: error.message,
      });
      // Fallback rate
      return 4.5;
    }
  }

  /**
   * Get price for any asset type
   */
  async getAssetPrice(symbol, type, exchange = "US") {
    try {
      let priceData;

      switch (type) {
        case "crypto":
          priceData = await this.getCryptoPrice(symbol);
          break;
        case "gold":
          priceData = await this.getGoldPrice();
          break;
        case "stock":
        case "etf":
        default:
          priceData = await this.getStockPrice(symbol, exchange);
          break;
      }

      // Get MYR conversion rate
      const myrRate = await this.getMYRRate(priceData.currency);

      return {
        ...priceData,
        myrRate,
      };
    } catch (error) {
      logger.error("Get asset price error:", {
        symbol,
        type,
        exchange,
        error: error.message,
      });
      return {
        price: 0,
        currency: "USD",
        change24h: 0,
        myrRate: 4.5,
        lastUpdated: new Date(),
        error: true,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Get prices for multiple assets (batched)
   */
  async getBatchPrices(assets) {
    const promises = assets.map((asset) =>
      this.getAssetPrice(asset.symbol, asset.type, asset.exchange),
    );

    const results = await Promise.allSettled(promises);

    const prices = {};
    assets.forEach((asset, index) => {
      const result = results[index];
      if (result.status === "fulfilled") {
        prices[asset.symbol] = result.value;
      } else {
        prices[asset.symbol] = {
          price: 0,
          currency: "USD",
          change24h: 0,
          myrRate: 4.5,
          lastUpdated: new Date(),
          error: true,
          errorMessage: result.reason?.message || "Unknown error",
        };
      }
    });

    return prices;
  }

  /**
   * Clear cache (useful for forced refresh)
   */
  clearCache() {
    priceCache.flushAll();
    logger.info("Price cache cleared");
  }
}

export default new PriceService();
