import SavingsRecurringRule from "../models/SavingsRecurringRule.js";
import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import logger from "../utils/logger.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * List all recurring rules for the user
 */
export async function listRules(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { accountId } = req.query;

    const query = { userId };
    if (accountId) query.accountId = accountId;

    const rules = await SavingsRecurringRule.find(query).sort({ createdAt: -1 });
    res.json({ rules });
  } catch (error) {
    logger.error("Error listing recurring rules:", error);
    res.status(500).json({ message: "Failed to retrieve rules" });
  }
}

/**
 * Create a new recurring rule
 */
export async function createRule(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { accountId, amount, dayOfMonth, isActive } = req.body;

    // Validate required fields
    if (!accountId) {
      return res.status(400).json({ message: "accountId is required" });
    }

    // Verify account exists and belongs to user
    const account = await SavingsAccount.findOne({ _id: accountId, userId });
    if (!account) {
      return res.status(404).json({ message: "Account not found" });
    }

    const numAmount = safeNumber(amount);
    if (numAmount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0" });
    }

    const numDay = Math.max(1, Math.min(28, Math.floor(Number(dayOfMonth) || 5)));

    // Get current year/month for start
    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth() + 1;

    const rule = new SavingsRecurringRule({
      userId,
      accountId,
      amount: numAmount,
      frequency: "monthly",
      dayOfMonth: numDay,
      startYear,
      startMonth,
      mode: "pending",
      isActive: isActive !== false,
    });

    await rule.save();

    logger.info(`Recurring rule created: ${rule._id} by user ${userId}`);
    res.status(201).json({ rule });
  } catch (error) {
    logger.error("Error creating recurring rule:", error);
    res.status(500).json({ message: "Failed to create rule" });
  }
}

/**
 * Update an existing recurring rule
 */
export async function updateRule(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;
    const { amount, dayOfMonth, isActive } = req.body;

    const rule = await SavingsRecurringRule.findOne({ _id: id, userId });
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    // Update amount if provided
    if (amount !== undefined) {
      const numAmount = safeNumber(amount);
      if (numAmount <= 0) {
        return res.status(400).json({ message: "Amount must be greater than 0" });
      }
      rule.amount = numAmount;
    }

    // Update day if provided
    if (dayOfMonth !== undefined) {
      rule.dayOfMonth = Math.max(1, Math.min(28, Math.floor(Number(dayOfMonth))));
    }

    // Update active status
    if (isActive !== undefined) {
      rule.isActive = !!isActive;
    }

    // Always keep mode as pending
    rule.mode = "pending";

    await rule.save();

    logger.info(`Recurring rule updated: ${rule._id} by user ${userId}`);
    res.json({ rule });
  } catch (error) {
    logger.error("Error updating recurring rule:", error);
    res.status(500).json({ message: "Failed to update rule" });
  }
}

/**
 * Delete a recurring rule
 */
export async function deleteRule(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { id } = req.params;

    const rule = await SavingsRecurringRule.findOne({ _id: id, userId });
    if (!rule) {
      return res.status(404).json({ message: "Rule not found" });
    }

    await SavingsRecurringRule.deleteOne({ _id: id });

    logger.info(`Recurring rule deleted: ${id} by user ${userId}`);
    res.json({ message: "Rule deleted successfully" });
  } catch (error) {
    logger.error("Error deleting recurring rule:", error);
    res.status(500).json({ message: "Failed to delete rule" });
  }
}

/**
 * Generate missing recurring transactions for all active rules
 */
export async function generateMissingTransactions(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    // Find all active rules for this user
    const rules = await SavingsRecurringRule.find({ userId, isActive: true });

    if (rules.length === 0) {
      return res.json({ message: "No active recurring rules found", generated: 0 });
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let generatedCount = 0;

    for (const rule of rules) {
      // Verify account still exists
      const account = await SavingsAccount.findById(rule.accountId);
      if (!account) continue;

      // Generate from start to current month
      const startYear = rule.startYear || currentYear;
      const startMonth = rule.startMonth || 1;

      let year = startYear;
      let month = startMonth;

      while (year < currentYear || (year === currentYear && month <= currentMonth)) {
        // Check if transaction already exists
        const existing = await SavingsTransaction.findOne({
          userId,
          accountId: rule.accountId,
          year,
          month,
          type: "capital_add",
          source: "recurring",
        });

        if (!existing) {
          // Create pending transaction
          const transaction = new SavingsTransaction({
            userId,
            accountId: rule.accountId,
            type: "capital_add",
            amount: rule.amount,
            year,
            month,
            day: rule.dayOfMonth,
            dateISO: new Date(Date.UTC(year, month - 1, rule.dayOfMonth)).toISOString(),
            status: "pending",
            source: "recurring",
            notes: `Auto-generated recurring deposit`,
          });

          await transaction.save();
          generatedCount++;
        }

        // Move to next month
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }

        // Stop if we've reached an end date (if set)
        if (rule.endYear && rule.endMonth) {
          if (year > rule.endYear || (year === rule.endYear && month > rule.endMonth)) {
            break;
          }
        }
      }
    }

    logger.info(`Generated ${generatedCount} missing recurring transactions for user ${userId}`);
    res.json({
      message: `Generated ${generatedCount} pending transactions`,
      generated: generatedCount,
    });
  } catch (error) {
    logger.error("Error generating missing transactions:", error);
    res.status(500).json({ message: "Failed to generate transactions" });
  }
}