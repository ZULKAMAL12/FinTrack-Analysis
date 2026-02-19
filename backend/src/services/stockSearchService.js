import axios from "axios";
import NodeCache from "node-cache";
import logger from "../utils/logger.js";

// Cache search results for 24 hours
const searchCache = new NodeCache({ stdTTL: 86400 });

class StockSearchService {
  /**
   * Comprehensive search: stocks, crypto, commodities, Malaysian stocks
   */
  async searchStocks(query) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `search:${query.toLowerCase()}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    try {
      const results = [];

      // 1. Search cryptocurrencies first
      const cryptoResults = this.searchCrypto(query);
      results.push(...cryptoResults);

      // 2. Search gold/commodities
      const commodityResults = this.searchCommodities(query);
      results.push(...commodityResults);

      // 3. Search Malaysian stocks
      const malaysianResults = await this.searchMalaysianStocks(query);
      results.push(...malaysianResults);

      // 4. Search US stocks via Yahoo Finance
      const yahooResults = await this.searchYahooFinance(query);
      results.push(...yahooResults);

      // Remove duplicates and limit to 10
      const uniqueResults = this.deduplicateResults(results).slice(0, 10);

      searchCache.set(cacheKey, uniqueResults);
      return uniqueResults;
    } catch (error) {
      logger.error("Stock search error:", {
        query,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Search cryptocurrencies (local database)
   */
  searchCrypto(query) {
    const cryptoList = [
      { symbol: "BTC", name: "Bitcoin", type: "crypto" },
      { symbol: "ETH", name: "Ethereum", type: "crypto" },
      { symbol: "USDT", name: "Tether", type: "crypto" },
      { symbol: "BNB", name: "Binance Coin", type: "crypto" },
      { symbol: "SOL", name: "Solana", type: "crypto" },
      { symbol: "XRP", name: "Ripple", type: "crypto" },
      { symbol: "ADA", name: "Cardano", type: "crypto" },
      { symbol: "DOGE", name: "Dogecoin", type: "crypto" },
      { symbol: "AVAX", name: "Avalanche", type: "crypto" },
      { symbol: "MATIC", name: "Polygon", type: "crypto" },
      { symbol: "DOT", name: "Polkadot", type: "crypto" },
      { symbol: "LINK", name: "Chainlink", type: "crypto" },
      { symbol: "UNI", name: "Uniswap", type: "crypto" },
      { symbol: "LTC", name: "Litecoin", type: "crypto" },
      { symbol: "ATOM", name: "Cosmos", type: "crypto" },
      { symbol: "ETC", name: "Ethereum Classic", type: "crypto" },
      { symbol: "XLM", name: "Stellar", type: "crypto" },
      { symbol: "NEAR", name: "NEAR Protocol", type: "crypto" },
      { symbol: "APT", name: "Aptos", type: "crypto" },
      { symbol: "ARB", name: "Arbitrum", type: "crypto" },
    ];

    const q = query.toLowerCase();
    return cryptoList
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
      .map((c) => ({
        symbol: c.symbol,
        name: c.name,
        type: "crypto",
        exchange: "CRYPTO",
        currency: "USD",
      }));
  }

  /**
   * Search commodities (gold, silver, etc.)
   */
  searchCommodities(query) {
    const commodities = [
      { symbol: "XAU", name: "Gold", type: "gold" },
      { symbol: "XAG", name: "Silver", type: "gold" },
      { symbol: "XPT", name: "Platinum", type: "gold" },
      { symbol: "XPD", name: "Palladium", type: "gold" },
    ];

    const q = query.toLowerCase();
    return commodities
      .filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q),
      )
      .map((c) => ({
        symbol: c.symbol,
        name: c.name,
        type: c.type,
        exchange: "COMMODITY",
        currency: "USD",
      }));
  }

  /**
   * Search Malaysian stocks (Bursa Malaysia)
   */
  async searchMalaysianStocks(query) {
    // Popular Malaysian stocks
    const malaysianStocks = [
      { symbol: "MAYBANK.KL", name: "Malayan Banking Berhad" },
      { symbol: "CIMB.KL", name: "CIMB Group Holdings" },
      { symbol: "PBBANK.KL", name: "Public Bank Berhad" },
      { symbol: "TENAGA.KL", name: "Tenaga Nasional Berhad" },
      { symbol: "PETDAG.KL", name: "Petronas Dagangan Berhad" },
      { symbol: "PETGAS.KL", name: "Petronas Gas Berhad" },
      { symbol: "IOICORP.KL", name: "IOI Corporation Berhad" },
      { symbol: "SIME.KL", name: "Sime Darby Berhad" },
      { symbol: "PCHEM.KL", name: "Petronas Chemicals Group" },
      { symbol: "DIGI.KL", name: "Digi.Com Berhad" },
      { symbol: "AXIATA.KL", name: "Axiata Group Berhad" },
      { symbol: "MISC.KL", name: "MISC Berhad" },
      { symbol: "HLFG.KL", name: "Hong Leong Financial Group" },
      { symbol: "GENTING.KL", name: "Genting Berhad" },
      { symbol: "GENM.KL", name: "Genting Malaysia Berhad" },
      { symbol: "RHBBANK.KL", name: "RHB Bank Berhad" },
      { symbol: "AMMB.KL", name: "AMMB Holdings Berhad" },
      { symbol: "TOPGLOV.KL", name: "Top Glove Corporation" },
      { symbol: "HAPSENG.KL", name: "Hap Seng Consolidated" },
      { symbol: "KLK.KL", name: "Kuala Lumpur Kepong Berhad" },
    ];

    const q = query.toLowerCase();
    const matches = malaysianStocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q),
    );

    return matches.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      type: "stock",
      exchange: "KLSE",
      currency: "MYR",
    }));
  }

  /**
   * Search US stocks via Yahoo Finance
   */
  async searchYahooFinance(query) {
    try {
      const response = await axios.get(
        "https://query2.finance.yahoo.com/v1/finance/search",
        {
          params: {
            q: query,
            quotesCount: 10,
            newsCount: 0,
            enableFuzzyQuery: false,
            quotesQueryId: "tss_match_phrase_query",
          },
          timeout: 5000,
        },
      );

      return (response.data.quotes || [])
        .filter((item) => {
          return (
            item.quoteType === "EQUITY" ||
            item.quoteType === "ETF" ||
            item.isYahooFinance
          );
        })
        .map((item) => ({
          symbol: item.symbol,
          name: item.longname || item.shortname || item.symbol,
          type: item.quoteType === "ETF" ? "etf" : "stock",
          exchange: item.exchDisp || item.exchange || "US",
          currency: "USD",
        }));
    } catch (error) {
      logger.error("Yahoo Finance search error:", {
        query,
        error: error.message,
      });
      return [];
    }
  }

  /**
   * Remove duplicate results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter((item) => {
      const key = item.symbol.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Get trending stocks
   */
  async getTrendingStocks() {
    const cacheKey = "trending:stocks";
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(
        "https://query2.finance.yahoo.com/v1/finance/trending/US",
        { timeout: 5000 },
      );

      const results = (response.data.finance.result[0].quotes || [])
        .slice(0, 20)
        .map((item) => ({
          symbol: item.symbol,
          name: item.longName || item.shortName || item.symbol,
          type: "stock",
          price: item.regularMarketPrice || 0,
          change: item.regularMarketChangePercent || 0,
          volume: item.regularMarketVolume || 0,
        }));

      searchCache.set(cacheKey, results, 300); // Cache for 5 minutes
      return results;
    } catch (error) {
      logger.error("Trending stocks error:", error.message);
      return [];
    }
  }

  /**
   * Get stocks by category/sector
   */
  async getStocksByCategory(category) {
    const categoryStocks = {
      technology: [
        "AAPL",
        "MSFT",
        "GOOGL",
        "META",
        "NVDA",
        "TSLA",
        "AMD",
        "INTC",
      ],
      finance: ["JPM", "BAC", "WFC", "GS", "MS", "C", "BLK", "AXP"],
      healthcare: ["JNJ", "UNH", "PFE", "ABBV", "TMO", "MRK", "CVS", "LLY"],
      consumer: ["AMZN", "WMT", "HD", "NKE", "MCD", "SBUX", "TGT", "COST"],
      energy: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO"],
      malaysian: [
        "MAYBANK.KL",
        "CIMB.KL",
        "TENAGA.KL",
        "PBBANK.KL",
        "PETDAG.KL",
        "IOICORP.KL",
        "SIME.KL",
        "PCHEM.KL",
      ],
    };

    const symbols = categoryStocks[category.toLowerCase()] || [];
    return symbols;
  }

  /**
   * Get financial news from Finnhub
   */
  async getFinancialNews(category = "general", limit = 10) {
    const cacheKey = `news:${category}:${limit}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;

    try {
      const apiKey = process.env.FINNHUB_API_KEY;

      if (!apiKey) {
        logger.warn("FINNHUB_API_KEY not configured");
        return [];
      }

      const response = await axios.get("https://finnhub.io/api/v1/news", {
        params: {
          category,
          token: apiKey,
        },
        timeout: 5000,
      });

      const news = (response.data || []).slice(0, limit).map((item) => ({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        url: item.url,
        image: item.image,
        datetime: new Date(item.datetime * 1000).toISOString(),
      }));

      searchCache.set(cacheKey, news, 1800); // Cache for 30 minutes
      return news;
    } catch (error) {
      logger.error("Financial news error:", error.message);
      return [];
    }
  }
}

export default new StockSearchService();
