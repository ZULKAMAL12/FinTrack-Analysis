import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import RecurringRule from "../models/RecurringRule.js";
import logger from "../utils/logger.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Helper: Calculate deposit streak
 */
async function calculateDepositStreak(userId) {
  const now = new Date();
  let currentYear = now.getFullYear();
  let currentMonth = now.getMonth() + 1;

  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;

  // Check last 24 months
  for (let i = 0; i < 24; i++) {
    const hasDeposit = await SavingsTransaction.exists({
      userId,
      year: currentYear,
      month: currentMonth,
      type: "capital_add",
      status: "completed",
    });

    if (hasDeposit) {
      tempStreak++;
      if (i === 0) currentStreak = tempStreak;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      if (i === 0) currentStreak = 0;
      tempStreak = 0;
    }

    currentMonth--;
    if (currentMonth === 0) {
      currentMonth = 12;
      currentYear--;
    }
  }

  return { currentStreak, longestStreak };
}

/**
 * Get smart alerts
 */
export async function getSmartAlerts(req, res) {
  const userId = req.user._id;

  try {
    const alerts = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    const accounts = await SavingsAccount.find({ userId }).lean();
    const rules = await RecurringRule.find({ userId, isActive: true }).lean();

    // Get pending transactions
    const pendingTx = await SavingsTransaction.find({
      userId,
      status: "pending",
      year: currentYear,
      month: currentMonth,
    }).lean();

    // ALERT 1: Pending deposits
    if (pendingTx.length > 0) {
      alerts.push({
        type: "pending_deposits",
        severity: "medium",
        title: `${pendingTx.length} pending deposit${pendingTx.length > 1 ? "s" : ""}`,
        message: `You have ${pendingTx.length} pending recurring deposit${pendingTx.length > 1 ? "s" : ""} waiting for confirmation.`,
        count: pendingTx.length,
        action: "review_pending",
      });
    }

    // ALERT 2: Missed deposits
    for (const rule of rules) {
      const account = accounts.find(
        (a) => a._id.toString() === rule.accountId.toString()
      );
      if (!account) continue;

      const ruleStartYear = rule.startYear || 2020;
      const ruleStartMonth = rule.startMonth || 1;
      const ruleStart = new Date(ruleStartYear, ruleStartMonth - 1, 1);
      const currentMonthStart = new Date(currentYear, currentMonth - 1, 1);

      if (currentMonthStart >= ruleStart) {
        let ruleActive = true;
        if (rule.endYear && rule.endMonth) {
          const ruleEnd = new Date(rule.endYear, rule.endMonth - 1, 1);
          if (currentMonthStart > ruleEnd) ruleActive = false;
        }

        if (ruleActive) {
          const hasTxThisMonth = await SavingsTransaction.exists({
            userId,
            accountId: rule.accountId,
            year: currentYear,
            month: currentMonth,
            type: "capital_add",
          });

          if (!hasTxThisMonth && currentDay > (rule.dayOfMonth || 5)) {
            alerts.push({
              type: "missed_deposit",
              severity: "high",
              title: `Missed deposit: ${account.name}`,
              message: `No deposit recorded for ${account.name} this month. Usually RM ${safeNumber(rule.amount).toFixed(0)} on day ${rule.dayOfMonth || 5}.`,
              accountId: account._id,
              accountName: account.name,
              expectedAmount: rule.amount,
              expectedDay: rule.dayOfMonth || 5,
              action: "add_deposit",
            });
          }
        }
      }
    }

    // ALERT 3: No deposits this month
    if (currentDay > 7) {
      const hasAnyDepositThisMonth = await SavingsTransaction.exists({
        userId,
        year: currentYear,
        month: currentMonth,
        type: "capital_add",
        status: "completed",
      });

      if (!hasAnyDepositThisMonth) {
        alerts.push({
          type: "no_deposits",
          severity: "medium",
          title: "No deposits this month",
          message: `You haven't recorded any deposits yet for ${now.toLocaleString("en", { month: "long" })} ${currentYear}.`,
          action: "add_deposit",
        });
      }
    }

    // ALERT 4: Streak
    const streakData = await calculateDepositStreak(userId);
    if (streakData.currentStreak >= 3) {
      alerts.push({
        type: "streak",
        severity: "low",
        title: `🔥 ${streakData.currentStreak}-month streak!`,
        message: `You've deposited consistently for ${streakData.currentStreak} months. Keep it up!`,
        streak: streakData.currentStreak,
        action: "celebrate",
      });
    }

    const severityOrder = { high: 1, medium: 2, low: 3 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({ alerts });
  } catch (error) {
    logger.error("Get smart alerts error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ message: "Failed to get alerts" });
  }
}

/**
 * Get deposit statistics
 */
export async function getDepositStats(req, res) {
  const userId = req.user._id;

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let lastMonth = currentMonth - 1;
    let lastMonthYear = currentYear;
    if (lastMonth === 0) {
      lastMonth = 12;
      lastMonthYear--;
    }

    // Current month
    const currentMonthTx = await SavingsTransaction.find({
      userId,
      year: currentYear,
      month: currentMonth,
      status: "completed",
    }).lean();

    const currentCapital = currentMonthTx
      .filter((t) => t.type === "capital_add")
      .reduce((sum, t) => sum + safeNumber(t.amount), 0);

    const currentDividends = currentMonthTx
      .filter((t) => t.type === "dividend")
      .reduce((sum, t) => sum + safeNumber(t.amount), 0);

    const currentWithdrawals = currentMonthTx
      .filter((t) => t.type === "withdrawal")
      .reduce((sum, t) => sum + safeNumber(t.amount), 0);

    // Last month
    const lastMonthTx = await SavingsTransaction.find({
      userId,
      year: lastMonthYear,
      month: lastMonth,
      status: "completed",
    }).lean();

    const lastCapital = lastMonthTx
      .filter((t) => t.type === "capital_add")
      .reduce((sum, t) => sum + safeNumber(t.amount), 0);

    const lastDividends = lastMonthTx
      .filter((t) => t.type === "dividend")
      .reduce((sum, t) => sum + safeNumber(t.amount), 0);

    const lastWithdrawals = lastMonthTx
      .filter((t) => t.type === "withdrawal")
      .reduce((sum, t) => sum + safeNumber(t.amount), 0);

    const capitalChange =
      lastCapital > 0 ? ((currentCapital - lastCapital) / lastCapital) * 100 : 0;
    const dividendsChange =
      lastDividends > 0
        ? ((currentDividends - lastDividends) / lastDividends) * 100
        : 0;

    const streakData = await calculateDepositStreak(userId);

    // Consistency (last 6 months)
    const consistencyMonths = [];
    let year = currentYear;
    let month = currentMonth;

    for (let i = 0; i < 6; i++) {
      const hasDeposit = await SavingsTransaction.exists({
        userId,
        year,
        month,
        type: "capital_add",
        status: "completed",
      });

      consistencyMonths.push({ year, month, deposited: hasDeposit });

      month--;
      if (month === 0) {
        month = 12;
        year--;
      }
    }

    const monthsWithDeposits = consistencyMonths.filter((m) => m.deposited).length;
    const consistencyScore = (monthsWithDeposits / 6) * 100;

    res.json({
      currentMonth: {
        year: currentYear,
        month: currentMonth,
        capital: parseFloat(currentCapital.toFixed(2)),
        dividends: parseFloat(currentDividends.toFixed(2)),
        withdrawals: parseFloat(currentWithdrawals.toFixed(2)),
      },
      lastMonth: {
        year: lastMonthYear,
        month: lastMonth,
        capital: parseFloat(lastCapital.toFixed(2)),
        dividends: parseFloat(lastDividends.toFixed(2)),
        withdrawals: parseFloat(lastWithdrawals.toFixed(2)),
      },
      changes: {
        capitalChange: parseFloat(capitalChange.toFixed(2)),
        dividendsChange: parseFloat(dividendsChange.toFixed(2)),
        capitalTrend: capitalChange > 0 ? "up" : capitalChange < 0 ? "down" : "same",
        dividendsTrend:
          dividendsChange > 0 ? "up" : dividendsChange < 0 ? "down" : "same",
      },
      streak: {
        current: streakData.currentStreak,
        longest: streakData.longestStreak,
      },
      consistency: {
        score: parseFloat(consistencyScore.toFixed(1)),
        monthsWithDeposits,
        totalMonths: 6,
        details: consistencyMonths.reverse(),
      },
    });
  } catch (error) {
    logger.error("Get deposit stats error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({ message: "Failed to get deposit stats" });
  }
}