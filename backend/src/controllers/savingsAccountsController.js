import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import logger from "../utils/logger.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sanitizeString(str) {
  return String(str || "").trim();
}

/**
 * List all savings accounts for the authenticated user
 */
export async function listAccounts(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    
    // Get all accounts
    const accounts = await SavingsAccount.find({ userId }).sort({ createdAt: -1 });

    // Calculate current balances for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (acc) => {
        // Get all completed transactions for this account
        const transactions = await SavingsTransaction.find({
          accountId: acc._id,
          status: "completed",
        });

        let totalContributed = 0;
        let totalDividends = 0;
        let totalWithdrawn = 0;

        for (const tx of transactions) {
          const amount = safeNumber(tx.amount);
          if (tx.type === "capital_add") {
            totalContributed += amount;
          } else if (tx.type === "dividend") {
            totalDividends += amount;
          } else if (tx.type === "withdrawal") {
            totalWithdrawn += amount;
          }
        }

        // Current balance = starting + contributed + dividends - withdrawn
        const currentBalance =
          safeNumber(acc.startingBalance) +
          totalContributed +
          totalDividends -
          totalWithdrawn;

        return {
          ...acc.toObject(),
          currentBalance: Math.max(0, currentBalance),
          totalContributed,
          totalDividendsReceived: totalDividends,
          totalWithdrawn,
        };
      })
    );

    res.json({ accounts: accountsWithBalances });
  } catch (error) {
    logger.error("Error listing savings accounts:", error);
    res.status(500).json({ message: "Failed to retrieve accounts" });
  }
}

/**
 * Create a new savings account
 */
export async function createAccount(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { name, color, goal, startingBalance, autoDepositReminder } = req.body;

    // Validate required fields
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName) {
      return res.status(400).json({ message: "Account name is required" });
    }
    if (sanitizedName.length > 100) {
      return res.status(400).json({ message: "Account name too long (max 100 characters)" });
    }

    // Validate color
    const colorRegex = /^#([0-9a-fA-F]{6})$/;
    const sanitizedColor = colorRegex.test(color) ? color : "#0ea5e9";

    // Create account with defaults for simplified frontend
    const account = new SavingsAccount({
      userId,
      name: sanitizedName,
      color: sanitizedColor,
      goal: safeNumber(goal),
      startingBalance: safeNumber(startingBalance),
      // Set defaults for fields frontend doesn't expose
      ratePercent: 0,
      returnFrequency: "monthly",
      monthlyContribution: 0,
      autoDepositReminder: !!autoDepositReminder,
    });

    await account.save();

    // Return with calculated fields
    const accountWithBalance = {
      ...account.toObject(),
      currentBalance: safeNumber(account.startingBalance),
      totalContributed: 0,
      totalDividendsReceived: 0,
      totalWithdrawn: 0,
    };

    logger.info(`Savings account created: ${account._id} by user ${userId}`);
    res.status(201).json({ account: accountWithBalance });
  } catch (error) {
    logger.error("Error creating savings account:", error);
    res.status(500).json({ message: "Failed to create account" });
  }
}

/**
 * Update an existing savings account
 */
export async function updateAccount(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { name, color, goal, startingBalance } = req.body;

    const account = await SavingsAccount.findOne({ _id: id, userId });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Validate name
    const sanitizedName = sanitizeString(name);
    if (!sanitizedName) {
      return res.status(400).json({ message: "Account name is required" });
    }
    if (sanitizedName.length > 100) {
      return res.status(400).json({ message: "Account name too long (max 100 characters)" });
    }

    // Validate color
    const colorRegex = /^#([0-9a-fA-F]{6})$/;
    const sanitizedColor = colorRegex.test(color) ? color : account.color;

    // Update fields
    account.name = sanitizedName;
    account.color = sanitizedColor;
    account.goal = safeNumber(goal);
    account.startingBalance = safeNumber(startingBalance);

    await account.save();

    // Recalculate balance
    const transactions = await SavingsTransaction.find({
      accountId: account._id,
      status: "completed",
    });

    let totalContributed = 0;
    let totalDividends = 0;
    let totalWithdrawn = 0;

    for (const tx of transactions) {
      const amount = safeNumber(tx.amount);
      if (tx.type === "capital_add") {
        totalContributed += amount;
      } else if (tx.type === "dividend") {
        totalDividends += amount;
      } else if (tx.type === "withdrawal") {
        totalWithdrawn += amount;
      }
    }

    const currentBalance =
      safeNumber(account.startingBalance) +
      totalContributed +
      totalDividends -
      totalWithdrawn;

    const accountWithBalance = {
      ...account.toObject(),
      currentBalance: Math.max(0, currentBalance),
      totalContributed,
      totalDividendsReceived: totalDividends,
      totalWithdrawn,
    };

    logger.info(`Savings account updated: ${account._id} by user ${userId}`);
    res.json({ account: accountWithBalance });
  } catch (error) {
    logger.error("Error updating savings account:", error);
    res.status(500).json({ message: "Failed to update account" });
  }
}

/**
 * Delete a savings account
 */
export async function deleteAccount(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const account = await SavingsAccount.findOne({ _id: id, userId });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Delete all transactions for this account
    await SavingsTransaction.deleteMany({ accountId: id });

    // Delete the account
    await SavingsAccount.deleteOne({ _id: id });

    logger.info(`Savings account deleted: ${id} by user ${userId}`);
    res.json({ message: "Account deleted successfully" });
  } catch (error) {
    logger.error("Error deleting savings account:", error);
    res.status(500).json({ message: "Failed to delete account" });
  }
}