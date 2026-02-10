import InvestmentAsset from "../models/InvestmentAsset.js";
import InvestmentTransaction from "../models/InvestmentTransaction.js";
import { recalculateAssetTotals } from "./investmentAssetsController.js";
import mongoose from "mongoose";
import logger from "../utils/logger.js";
import { sanitize } from "../utils/sanitize.js";

/**
 * List transactions with filters
 */
export async function listTransactions(req, res) {
  const userId = req.user._id;

  try {
    const year = parseInt(req.query.year);
    if (!year || year < 2000 || year > 2100) {
      return res.status(400).json({
        message: "Valid year (2000-2100) is required",
      });
    }

    const month = req.query.month ? parseInt(req.query.month) : null;
    if (month && (month < 1 || month > 12)) {
      return res.status(400).json({
        message: "Month must be between 1 and 12",
      });
    }

    const assetId =
      req.query.assetId && req.query.assetId !== "all"
        ? req.query.assetId
        : null;

    if (assetId && !assetId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid asset ID format",
      });
    }

    // Build filter
    const filter = { userId, year };
    if (month) filter.month = month;
    if (assetId) filter.assetId = assetId;

    const transactions = await InvestmentTransaction.find(filter)
      .sort({ year: -1, month: -1, day: -1, createdAt: -1 })
      .lean();

    res.json({ transactions });
  } catch (error) {
    logger.error("List transactions error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch transactions",
    });
  }
}

/**
 * Create transaction (buy/sell/dividend)
 */
export async function createTransaction(req, res) {
  const userId = req.user._id;
  const data = req.validatedBody;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Verify asset ownership
    const asset = await InvestmentAsset.findOne({
      _id: data.assetId,
      userId,
      deletedAt: null,
    }).session(session);

    if (!asset) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Asset not found or access denied",
      });
    }

    // For sell transactions, verify sufficient units
    if (data.type === "sell") {
      if (data.units > asset.totalUnits) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Cannot sell ${data.units} units. You only have ${asset.totalUnits} units.`,
        });
      }
    }

    // Sanitize notes
    const notes = sanitize(data.notes || "");

    // Generate dateISO
    const day = data.day || 1;
    const dateISO = new Date(Date.UTC(data.year, data.month - 1, day, 0, 0, 0));

    // Create transaction
    const transaction = await InvestmentTransaction.create(
      [
        {
          userId,
          assetId: data.assetId,
          type: data.type,
          units: data.units,
          pricePerUnit: data.pricePerUnit,
          totalAmount: data.totalAmount,
          currency: asset.currency,
          year: data.year,
          month: data.month,
          day: data.day,
          dateISO,
          notes,
          assetSymbol: asset.symbol,
          assetName: asset.name,
        },
      ],
      { session },
    );

    // Recalculate asset totals
    await recalculateAssetTotals(asset._id, session);

    await session.commitTransaction();

    logger.info("Transaction created", {
      userId,
      assetId: data.assetId,
      assetSymbol: asset.symbol,
      transactionId: transaction[0]._id,
      type: data.type,
      units: data.units,
      pricePerUnit: data.pricePerUnit,
      totalAmount: data.totalAmount,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      transaction: transaction[0],
      message: "Transaction recorded successfully",
    });
  } catch (error) {
    await session.abortTransaction();

    logger.error("Create transaction error:", {
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

    res.status(500).json({
      message: "Failed to create transaction",
    });
  } finally {
    session.endSession();
  }
}

/**
 * Update transaction (limited fields)
 */
export async function updateTransaction(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid transaction ID format",
      });
    }

    const transaction = await InvestmentTransaction.findOne({
      _id: id,
      userId,
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    // Only allow updating notes
    if (typeof req.body.notes === "string") {
      transaction.notes = sanitize(req.body.notes.substring(0, 500));
    }

    await transaction.save();

    logger.info("Transaction updated", {
      userId,
      transactionId: id,
      ip: req.ip,
    });

    res.json({
      transaction,
      message: "Transaction updated successfully",
    });
  } catch (error) {
    logger.error("Update transaction error:", {
      userId,
      transactionId: id,
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
      message: "Failed to update transaction",
    });
  }
}

/**
 * Delete transaction
 */
export async function deleteTransaction(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Invalid transaction ID format",
      });
    }

    const transaction = await InvestmentTransaction.findOne({
      _id: id,
      userId,
    }).session(session);

    if (!transaction) {
      await session.abortTransaction();
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    const assetId = transaction.assetId;

    // Log before deletion
    logger.warn("Transaction deleted", {
      userId,
      transactionId: id,
      assetId,
      assetSymbol: transaction.assetSymbol,
      type: transaction.type,
      units: transaction.units,
      pricePerUnit: transaction.pricePerUnit,
      totalAmount: transaction.totalAmount,
      year: transaction.year,
      month: transaction.month,
      ip: req.ip,
    });

    await transaction.deleteOne({ session });

    // Recalculate asset totals
    await recalculateAssetTotals(assetId, session);

    await session.commitTransaction();

    res.json({
      ok: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();

    logger.error("Delete transaction error:", {
      userId,
      transactionId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to delete transaction",
    });
  } finally {
    session.endSession();
  }
}
