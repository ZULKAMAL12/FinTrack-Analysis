import InvestmentAsset from "../models/InvestmentAsset.js";
import priceService from "../services/priceService.js";
import logger from "../utils/logger.js";

/**
 * Get prices for user's assets
 */
export async function getPrices(req, res) {
  const userId = req.user._id;

  try {
    const assets = req.body.assets;

    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        message: "Assets array is required",
      });
    }

    // Validate and get prices
    const prices = await priceService.getBatchPrices(assets);

    res.json({ prices });
  } catch (error) {
    logger.error("Get prices error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch prices",
    });
  }
}

/**
 * Refresh prices (force cache clear)
 */
export async function refreshPrices(req, res) {
  const userId = req.user._id;

  try {
    const assets = req.body.assets;

    if (!Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({
        message: "Assets array is required",
      });
    }

    // Clear cache for fresh prices
    priceService.clearCache();

    // Get fresh prices
    const prices = await priceService.getBatchPrices(assets);

    // Update lastKnownPrice for user's assets
    const updatePromises = assets.map(async (assetInfo) => {
      const priceData = prices[assetInfo.symbol];
      if (!priceData || priceData.error) return;

      try {
        await InvestmentAsset.updateOne(
          {
            userId,
            symbol: assetInfo.symbol,
            deletedAt: null,
          },
          {
            lastKnownPrice: priceData.price,
            lastPriceUpdate: new Date(),
          },
        );
      } catch (updateError) {
        logger.error("Failed to update asset price:", {
          symbol: assetInfo.symbol,
          error: updateError.message,
        });
      }
    });

    await Promise.all(updatePromises);

    logger.info("Prices refreshed", {
      userId,
      assetCount: assets.length,
      ip: req.ip,
    });

    res.json({ prices });
  } catch (error) {
    logger.error("Refresh prices error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to refresh prices",
    });
  }
}
