import SavingsTransaction from "../models/SavingsTransaction.js";
import SavingsAccount from "../models/SavingsAccount.js";
import logger from "../utils/logger.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * List transactions with optional filters
 */
export async function listTransactions(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { year, month, accountId } = req.query;

    const query = { userId };

    if (year) {
      const numYear = parseInt(year);
      if (numYear >= 2000 && numYear <= 2100) {
        query.year = numYear;
      }
    }

    if (month) {
      const numMonth = parseInt(month);
      if (numMonth >= 1 && numMonth <= 12) {
        query.month = numMonth;
      }
    }

    if (accountId && accountId !== "all") {
      query.accountId = accountId;
    }

    const transactions = await SavingsTransaction.find(query).sort({
      year: -1,
      month: -1,
      day: -1,
    });

    // Populate account names
    const accounts = await SavingsAccount.find({ userId });
    const accountMap = {};
    accounts.forEach((acc) => {
      accountMap[acc._id.toString()] = acc.name;
    });

    const transactionsWithNames = transactions.map((tx) => ({
      ...tx.toObject(),
      accountName: accountMap[tx.accountId?.toString()] || "Unknown",
    }));

    res.json({ transactions: transactionsWithNames });
  } catch (error) {
    logger.error("Error listing transactions:", error);
    res.status(500).json({ message: "Failed to retrieve transactions" });
  }
}

/**
 * Create a new transaction
 */
export async function createTransaction(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const {
      accountId,
      type,
      amount,
      year,
      month,
      day,
      dateISO,
      status,
      source,
      notes,
    } = req.body;

    // Validate account exists
    const account = await SavingsAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Validate amount
    const numAmount = safeNumber(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    // Validate type
    if (!["capital_add", "dividend", "withdrawal"].includes(type)) {
      return res.status(400).json({ message: "Invalid transaction type" });
    }

    // Validate year/month
    const numYear = parseInt(year);
    const numMonth = parseInt(month);
    if (numYear < 2000 || numYear > 2100) {
      return res.status(400).json({ message: "Invalid year" });
    }
    if (numMonth < 1 || numMonth > 12) {
      return res.status(400).json({ message: "Invalid month" });
    }

    // Create transaction
    const transaction = new SavingsTransaction({
      userId,
      accountId,
      type,
      amount: numAmount,
      year: numYear,
      month: numMonth,
      day: day ? parseInt(day) : undefined,
      dateISO: dateISO || new Date().toISOString(),
      status: status || "completed",
      source: source || "manual",
      notes: notes ? String(notes).substring(0, 500) : undefined,
    });

    await transaction.save();

    logger.info(`Savings transaction created: ${transaction._id} by user ${userId}`);
    res.status(201).json({ transaction });
  } catch (error) {
    logger.error("Error creating transaction:", error);
    res.status(500).json({ message: "Failed to create transaction" });
  }
}

/**
 * Update a transaction (mainly for status changes)
 */
export async function updateTransaction(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { status, amount, notes } = req.body;

    const transaction = await SavingsTransaction.findOne({ _id: id, userId });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    // Update fields
    if (status && ["pending", "completed"].includes(status)) {
      transaction.status = status;
    }

    if (amount !== undefined) {
      const numAmount = safeNumber(amount);
      if (numAmount <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }
      transaction.amount = numAmount;
    }

    if (notes !== undefined) {
      transaction.notes = notes ? String(notes).substring(0, 500) : undefined;
    }

    await transaction.save();

    logger.info(`Savings transaction updated: ${transaction._id} by user ${userId}`);
    res.json({ transaction });
  } catch (error) {
    logger.error("Error updating transaction:", error);
    res.status(500).json({ message: "Failed to update transaction" });
  }
}

/**
 * Delete a transaction
 */
export async function deleteTransaction(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const transaction = await SavingsTransaction.findOne({ _id: id, userId });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    await SavingsTransaction.deleteOne({ _id: id });

    logger.info(`Savings transaction deleted: ${id} by user ${userId}`);
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    logger.error("Error deleting transaction:", error);
    res.status(500).json({ message: "Failed to delete transaction" });
  }
}

/**
 * Bulk confirm multiple pending transactions
 */
export async function bulkConfirmTransactions(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { transactionIds } = req.body;

    if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
      return res.status(400).json({ message: "transactionIds array is required" });
    }

    // Update all matching transactions
    const result = await SavingsTransaction.updateMany(
      {
        _id: { $in: transactionIds },
        userId,
        status: "pending",
      },
      {
        $set: { status: "completed" },
      }
    );

    logger.info(
      `Bulk confirmed ${result.modifiedCount} transactions for user ${userId}`
    );
    res.json({
      message: `${result.modifiedCount} transaction(s) confirmed`,
      confirmed: result.modifiedCount,
    });
  } catch (error) {
    logger.error("Error bulk confirming transactions:", error);
    res.status(500).json({ message: "Failed to confirm transactions" });
  }
}