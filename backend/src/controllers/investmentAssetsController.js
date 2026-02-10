import InvestmentAsset from "../models/InvestmentAsset.js";
import InvestmentTransaction from "../models/InvestmentTransaction.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";

/**
 * Get all assets for the user
 */
export async function listAssets(req, res) {
  const userId = req.user._id;

  try {
    const assets = await InvestmentAsset.find({
      userId,
      deletedAt: null,
    }).sort({ createdAt: -1 });

    res.json({ assets });
  } catch (error) {
    logger.error("List assets error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch assets",
    });
  }
}

/**
 * Get single asset by ID
 */
export async function getAsset(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid asset ID format",
      });
    }

    const asset = await InvestmentAsset.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!asset) {
      return res.status(404).json({
        message: "Asset not found",
      });
    }

    res.json({ asset });
  } catch (error) {
    logger.error("Get asset error:", {
      userId,
      assetId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch asset",
    });
  }
}

/**
 * Create new asset
 */
export async function createAsset(req, res) {
  const userId = req.user._id;
  const data = req.validatedBody;

  try {
    // Check for duplicate symbol
    const existing = await InvestmentAsset.findOne({
      userId,
      symbol: data.symbol,
      deletedAt: null,
    });

    if (existing) {
      return res.status(409).json({
        message: `You already have an asset with symbol ${data.symbol}`,
      });
    }

    const asset = await InvestmentAsset.create({
      userId,
      name: data.name,
      symbol: data.symbol,
      type: data.type,
      exchange: data.exchange,
      currency: data.currency,
      totalUnits: 0,
      totalInvested: 0,
      lastKnownPrice: 0,
    });

    logger.info("Asset created", {
      userId,
      assetId: asset._id,
      symbol: asset.symbol,
      type: asset.type,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      asset,
      message: "Asset added to portfolio",
    });
  } catch (error) {
    logger.error("Create asset error:", {
      userId,
      error: error.message,
      stack: error.stack,
      data,
    });

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        message: messages.join(", "),
        errors: error.errors,
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Asset with this symbol already exists in your portfolio",
      });
    }

    res.status(500).json({
      message: "Failed to create asset",
    });
  }
}

/**
 * Update asset
 */
export async function updateAsset(req, res) {
  const userId = req.user._id;
  const { id } = req.params;
  const data = req.validatedBody;

  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid asset ID format",
      });
    }

    const asset = await InvestmentAsset.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!asset) {
      return res.status(404).json({
        message: "Asset not found",
      });
    }

    // Only allow updating certain fields
    if (data.name !== undefined) asset.name = data.name;
    if (data.color !== undefined) asset.color = data.color;

    await asset.save();

    logger.info("Asset updated", {
      userId,
      assetId: id,
      symbol: asset.symbol,
      ip: req.ip,
    });

    res.json({
      asset,
      message: "Asset updated successfully",
    });
  } catch (error) {
    logger.error("Update asset error:", {
      userId,
      assetId: id,
      error: error.message,
      stack: error.stack,
    });

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      message: "Failed to update asset",
    });
  }
}

/**
 * Delete asset (soft delete)
 */
export async function deleteAsset(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid asset ID format",
      });
    }

    const asset = await InvestmentAsset.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!asset) {
      return res.status(404).json({
        message: "Asset not found",
      });
    }

    // Use transaction for atomic delete
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Soft delete asset
      asset.deletedAt = new Date();
      await asset.save({ session });

      // Note: We keep transactions for historical records
      // but you could also delete them if needed

      await session.commitTransaction();

      logger.warn("Asset deleted", {
        userId,
        assetId: id,
        symbol: asset.symbol,
        name: asset.name,
        totalUnits: asset.totalUnits,
        totalInvested: asset.totalInvested,
        ip: req.ip,
      });

      res.json({
        ok: true,
        message: "Asset removed from portfolio",
      });
    } catch (txError) {
      await session.abortTransaction();
      throw txError;
    } finally {
      session.endSession();
    }
  } catch (error) {
    logger.error("Delete asset error:", {
      userId,
      assetId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to delete asset",
    });
  }
}

/**
 * Recalculate asset totals from transactions
 */
export async function recalculateAssetTotals(assetId, session = null) {
  const asset = await InvestmentAsset.findById(assetId).session(session);
  if (!asset) return;

  // Get all transactions for this asset
  const transactions = await InvestmentTransaction.find({
    assetId,
  })
    .session(session)
    .sort({ createdAt: 1 });

  let totalUnits = 0;
  let totalInvested = 0;

  for (const tx of transactions) {
    if (tx.type === "buy") {
      totalUnits += tx.units;
      totalInvested += tx.totalAmount;
    } else if (tx.type === "sell") {
      totalUnits -= tx.units;
      // Reduce invested proportionally
      const sellRatio = tx.units / (totalUnits + tx.units);
      totalInvested -= totalInvested * sellRatio;
    }
  }

  asset.totalUnits = Math.max(0, totalUnits);
  asset.totalInvested = Math.max(0, totalInvested);

  await asset.save({ session });
}
