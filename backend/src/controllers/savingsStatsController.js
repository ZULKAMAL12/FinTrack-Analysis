import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import logger from "../utils/logger.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Get smart alerts for the user
 */
export async function getAlerts(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const alerts = [];

    // Get all accounts with balances
    const accounts = await SavingsAccount.find({ userId });
    
    for (const acc of accounts) {
      const transactions = await SavingsTransaction.find({
        accountId: acc._id,
        status: "completed",
      });

      let totalContributed = 0;
      let totalDividends = 0;
      let totalWithdrawn = 0;

      for (const tx of transactions) {
        const amount = safeNumber(tx.amount);
        if (tx.type === "capital_add") totalContributed += amount;
        else if (tx.type === "dividend") totalDividends += amount;
        else if (tx.type === "withdrawal") totalWithdrawn += amount;
      }

      const currentBalance =
        safeNumber(acc.startingBalance) +
        totalContributed +
        totalDividends -
        totalWithdrawn;

      const goal = safeNumber(acc.goal);

      // Alert: Near goal
      if (goal > 0 && currentBalance >= goal * 0.8 && currentBalance < goal) {
        alerts.push({
          severity: "low",
          title: `${acc.name} is 80% to goal!`,
          message: `You're ${formatRM(currentBalance)} of ${formatRM(goal)}. Just ${formatRM(goal - currentBalance)} to go!`,
        });
      }

      // Alert: Goal achieved
      if (goal > 0 && currentBalance >= goal) {
        alerts.push({
          severity: "low",
          title: `🎉 Goal achieved: ${acc.name}!`,
          message: `Congratulations! You've reached your goal of ${formatRM(goal)}.`,
        });
      }

      // Alert: No recent deposits (if has recurring rule)
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const recentDeposits = await SavingsTransaction.find({
        accountId: acc._id,
        type: "capital_add",
        year: currentYear,
        month: currentMonth,
        status: "completed",
      });

      if (acc.autoDepositReminder && recentDeposits.length === 0) {
        alerts.push({
          severity: "medium",
          title: `No deposits this month: ${acc.name}`,
          message: `You haven't made any deposits to ${acc.name} this month yet.`,
        });
      }
    }

    // Check for pending transactions
    const pendingCount = await SavingsTransaction.countDocuments({
      userId,
      status: "pending",
    });

    if (pendingCount > 5) {
      alerts.push({
        severity: "medium",
        title: `${pendingCount} pending deposits`,
        message: `You have ${pendingCount} pending deposits waiting for confirmation.`,
      });
    }

    res.json({ alerts });
  } catch (error) {
    logger.error("Error getting alerts:", error);
    res.status(500).json({ message: "Failed to retrieve alerts" });
  }
}

/**
 * Get deposit statistics (current month vs last month)
 */
export async function getDepositStats(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let lastYear = currentYear;
    let lastMonth = currentMonth - 1;
    if (lastMonth < 1) {
      lastMonth = 12;
      lastYear--;
    }

    // Current month stats
    const currentTx = await SavingsTransaction.find({
      userId,
      year: currentYear,
      month: currentMonth,
      status: "completed",
    });

    let currentCapital = 0;
    let currentDividends = 0;

    for (const tx of currentTx) {
      const amount = safeNumber(tx.amount);
      if (tx.type === "capital_add") currentCapital += amount;
      else if (tx.type === "dividend") currentDividends += amount;
    }

    // Last month stats
    const lastTx = await SavingsTransaction.find({
      userId,
      year: lastYear,
      month: lastMonth,
      status: "completed",
    });

    let lastCapital = 0;
    let lastDividends = 0;

    for (const tx of lastTx) {
      const amount = safeNumber(tx.amount);
      if (tx.type === "capital_add") lastCapital += amount;
      else if (tx.type === "dividend") lastDividends += amount;
    }

    // Calculate changes
    const capitalChange = lastCapital > 0 ? ((currentCapital - lastCapital) / lastCapital) * 100 : 0;
    const dividendsChange = lastDividends > 0 ? ((currentDividends - lastDividends) / lastDividends) * 100 : 0;

    const capitalTrend = capitalChange > 0 ? "up" : capitalChange < 0 ? "down" : "same";
    const dividendsTrend = dividendsChange > 0 ? "up" : dividendsChange < 0 ? "down" : "same";

    // Calculate streak (consecutive months with deposits)
    let streakCount = 0;
    let longestStreak = 0;
    let checkYear = currentYear;
    let checkMonth = currentMonth;

    for (let i = 0; i < 12; i++) {
      const deposits = await SavingsTransaction.find({
        userId,
        year: checkYear,
        month: checkMonth,
        type: "capital_add",
        status: "completed",
      });

      if (deposits.length > 0) {
        streakCount++;
        if (streakCount > longestStreak) longestStreak = streakCount;
      } else {
        if (i === 0) streakCount = 0; // Current month break
        break;
      }

      checkMonth--;
      if (checkMonth < 1) {
        checkMonth = 12;
        checkYear--;
      }
    }

    // Calculate consistency (months with deposits in last 6 months)
    let monthsWithDeposits = 0;
    checkYear = currentYear;
    checkMonth = currentMonth;

    for (let i = 0; i < 6; i++) {
      const deposits = await SavingsTransaction.find({
        userId,
        year: checkYear,
        month: checkMonth,
        type: "capital_add",
        status: "completed",
      });

      if (deposits.length > 0) monthsWithDeposits++;

      checkMonth--;
      if (checkMonth < 1) {
        checkMonth = 12;
        checkYear--;
      }
    }

    const consistencyScore = Math.round((monthsWithDeposits / 6) * 100);

    res.json({
      currentMonth: {
        capital: currentCapital,
        dividends: currentDividends,
      },
      lastMonth: {
        capital: lastCapital,
        dividends: lastDividends,
      },
      changes: {
        capitalChange: Math.round(capitalChange),
        capitalTrend,
        dividendsChange: Math.round(dividendsChange),
        dividendsTrend,
      },
      streak: {
        current: streakCount,
        longest: longestStreak,
      },
      consistency: {
        score: consistencyScore,
        monthsWithDeposits,
      },
    });
  } catch (error) {
    logger.error("Error getting deposit stats:", error);
    res.status(500).json({ message: "Failed to retrieve deposit statistics" });
  }
}

function formatRM(amount) {
  return `RM ${Number(amount).toFixed(2)}`;
}