import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import { sanitize } from "../utils/sanitize.js"; // You'll need to create this
import logger from "../utils/logger.js"; // You'll need to create this

const SORT_DESC = -1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/**
 * List transactions with pagination and filters
 */
export async function listTransactions(req, res) {
  const userId = req.user._id;

  try {
    // Parse query params with validation
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

    const accountId =
      req.query.accountId && req.query.accountId !== "all"
        ? req.query.accountId
        : null;

    // Validate accountId format if provided
    if (accountId && !accountId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid account ID format",
      });
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(req.query.limit) || DEFAULT_PAGE_SIZE),
    );
    const skip = (page - 1) * limit;

    // Build filter
    const filter = { userId, year };
    if (month) filter.month = month;
    if (accountId) filter.accountId = accountId;

    // Get total count for pagination
    const total = await SavingsTransaction.countDocuments(filter);

    // Use aggregation with $lookup for better performance
    const transactions = await SavingsTransaction.aggregate([
      { $match: filter },
      {
        $sort: {
          year: SORT_DESC,
          month: SORT_DESC,
          day: SORT_DESC,
          createdAt: SORT_DESC,
        },
      },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: "savingsaccounts",
          localField: "accountId",
          foreignField: "_id",
          as: "account",
        },
      },
      {
        $addFields: {
          accountName: { $arrayElemAt: ["$account.name", 0] },
        },
      },
      {
        $project: {
          account: 0, // Remove the joined array
        },
      },
    ]);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
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
 * Create a new transaction
 */
export async function createTransaction(req, res) {
  const userId = req.user._id;
  const data = req.validatedBody; // ✅ Use validated data from middleware

  try {
    // Verify account ownership
    const account = await SavingsAccount.findOne({
      _id: data.accountId,
      userId,
      deletedAt: null, // Don't allow transactions on deleted accounts
    });

    if (!account) {
      return res.status(404).json({
        message: "Account not found or access denied",
      });
    }

    // Sanitize notes
    const notes = sanitize(data.notes || "");

    // Generate dateISO if not provided
    let dateISO = data.dateISO;
    if (!dateISO) {
      const day = data.day || 1;
      dateISO = new Date(Date.UTC(data.year, data.month - 1, day, 0, 0, 0));
    }

    // Create transaction
    const transaction = await SavingsTransaction.create({
      userId,
      accountId: data.accountId,
      type: data.type,
      amount: data.amount,
      year: data.year,
      month: data.month,
      day: data.day,
      dateISO,
      status: data.status || "completed",
      source: data.source || "manual",
      ruleId: data.ruleId,
      notes,
    });

    // Audit log
    logger.info("Transaction created", {
      userId,
      accountId: data.accountId,
      accountName: account.name,
      transactionId: transaction._id,
      type: data.type,
      amount: data.amount,
      status: transaction.status,
      source: transaction.source,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json({
      transaction,
      message: "Transaction created successfully",
    });
  } catch (error) {
    logger.error("Create transaction error:", {
      userId,
      error: error.message,
      stack: error.stack,
      data,
    });

    // Handle validation errors
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        message: messages.join(", "),
        errors: error.errors,
      });
    }

    // Handle duplicate key errors (for recurring transactions)
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Transaction already exists for this period",
      });
    }

    res.status(500).json({
      message: "Failed to create transaction",
    });
  }
}

/**
 * Update transaction (limited fields)
 */
export async function patchTransaction(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    // Validate transaction ID format
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid transaction ID format",
      });
    }

    const transaction = await SavingsTransaction.findOne({
      _id: id,
      userId,
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    // Validate status change
    if (req.body.status) {
      if (!["pending", "completed"].includes(req.body.status)) {
        return res.status(400).json({
          message: "Status must be 'pending' or 'completed'",
        });
      }

      // Business rule: Only allow pending -> completed
      // Don't allow completed -> pending (would mess up calculations)
      if (transaction.status === "completed" && req.body.status === "pending") {
        return res.status(400).json({
          message: "Cannot change completed transaction back to pending",
        });
      }

      const oldStatus = transaction.status;
      transaction.status = req.body.status;

      // Audit log for status changes
      logger.info("Transaction status changed", {
        userId,
        transactionId: id,
        oldStatus,
        newStatus: req.body.status,
        type: transaction.type,
        amount: transaction.amount,
        source: transaction.source,
        ip: req.ip,
      });
    }

    // Allow notes update
    if (typeof req.body.notes === "string") {
      transaction.notes = sanitize(req.body.notes.substring(0, 500));
    }

    await transaction.save();

    res.json({
      transaction,
      message: "Transaction updated successfully",
    });
  } catch (error) {
    logger.error("Patch transaction error:", {
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
 * Delete transaction (soft delete recommended)
 */
export async function deleteTransaction(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        message: "Invalid transaction ID format",
      });
    }

    const transaction = await SavingsTransaction.findOne({
      _id: id,
      userId,
    });

    if (!transaction) {
      return res.status(404).json({
        message: "Transaction not found",
      });
    }

    // Business rule: Don't allow deleting completed recurring transactions
    if (
      transaction.source === "recurring" &&
      transaction.status === "completed"
    ) {
      return res.status(400).json({
        message:
          "Cannot delete completed recurring transactions. Please contact support.",
      });
    }

    // Audit log BEFORE deletion
    logger.warn("Transaction deleted", {
      userId,
      transactionId: id,
      accountId: transaction.accountId,
      type: transaction.type,
      amount: transaction.amount,
      status: transaction.status,
      source: transaction.source,
      year: transaction.year,
      month: transaction.month,
      ip: req.ip,
    });

    await transaction.deleteOne();

    res.json({
      ok: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    logger.error("Delete transaction error:", {
      userId,
      transactionId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to delete transaction",
    });
  }
}
