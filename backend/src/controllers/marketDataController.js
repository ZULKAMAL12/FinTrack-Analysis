import stockSearchService from "../services/stockSearchService.js";
import priceService from "../services/priceService.js";
import logger from "../utils/logger.js";

/**
 * Search for stocks/ETFs
 */
export async function searchStocks(req, res) {
  const userId = req.user._id;

  try {
    const query = req.query.q || "";

    if (query.length < 2) {
      return res.json({ results: [] });
    }

    const results = await stockSearchService.searchStocks(query);

    logger.info("Stock search", {
      userId,
      query,
      resultCount: results.length,
    });

    res.json({ results });
  } catch (error) {
    logger.error("Search stocks error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to search stocks",
    });
  }
}

/**
 * Get trending stocks
 */
export async function getTrendingStocks(req, res) {
  const userId = req.user._id;

  try {
    const trending = await stockSearchService.getTrendingStocks();

    res.json({ stocks: trending });
  } catch (error) {
    logger.error("Get trending stocks error:", {
      userId,
      error: error.message,
    });

    res.status(500).json({
      message: "Failed to fetch trending stocks",
    });
  }
}

/**
 * Get stocks by category with real prices
 */
export async function getStocksByCategory(req, res) {
  const userId = req.user._id;

  try {
    const category = req.query.category || "technology";

    const symbols = await stockSearchService.getStocksByCategory(category);

    // Get prices for these stocks
    const assets = symbols.map((symbol) => ({
      symbol,
      type: "stock",
      exchange: symbol.endsWith(".KL") ? "KLSE" : "US",
    }));

    const prices = await priceService.getBatchPrices(assets);

    const stocks = symbols.map((symbol) => {
      const priceData = prices[symbol] || {};
      return {
        symbol,
        name: symbol,
        price: priceData.price || 0,
        change: priceData.change24h || 0,
        currency: priceData.currency || "USD",
      };
    });

    res.json({ category, stocks });
  } catch (error) {
    logger.error("Get stocks by category error:", {
      userId,
      error: error.message,
    });

    res.status(500).json({
      message: "Failed to fetch stocks",
    });
  }
}

/**
 * Get financial news
 */
export async function getFinancialNews(req, res) {
  const userId = req.user._id;

  try {
    const category = req.query.category || "general";
    const limit = parseInt(req.query.limit) || 10;

    const news = await stockSearchService.getFinancialNews(category, limit);

    res.json({ news });
  } catch (error) {
    logger.error("Get financial news error:", {
      userId,
      error: error.message,
    });

    res.status(500).json({
      message: "Failed to fetch news",
    });
  }
}
