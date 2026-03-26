import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import logger from "../utils/logger.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Export transactions as CSV
 */
export async function exportTransactions(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { year, accountId } = req.query;

    const query = { userId };

    if (year) {
      const numYear = parseInt(year);
      if (numYear >= 2000 && numYear <= 2100) {
        query.year = numYear;
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

    // Get account names
    const accounts = await SavingsAccount.find({ userId });
    const accountMap = {};
    accounts.forEach((acc) => {
      accountMap[acc._id.toString()] = acc.name;
    });

    // Build CSV
    const headers = [
      "Date",
      "Account",
      "Type",
      "Amount",
      "Status",
      "Source",
      "Notes",
    ];

    const rows = transactions.map((tx) => {
      const accountName = accountMap[tx.accountId?.toString()] || "Unknown";
      const date = `${tx.year}-${String(tx.month).padStart(2, "0")}-${String(tx.day || 1).padStart(2, "0")}`;
      
      return [
        date,
        accountName,
        tx.type,
        tx.amount.toFixed(2),
        tx.status || "completed",
        tx.source || "manual",
        (tx.notes || "").replace(/"/g, '""'),
      ];
    });

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const filename = `savings_transactions_${year || "all"}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);

    logger.info(`Exported transactions for user ${userId}`);
  } catch (error) {
    logger.error("Error exporting transactions:", error);
    res.status(500).json({ message: "Failed to export transactions" });
  }
}

/**
 * Export account summary as CSV
 */
export async function exportAccounts(req, res) {
  try {
    const userId = req.user.id || req.user._id;

    const accounts = await SavingsAccount.find({ userId }).sort({ createdAt: -1 });

    // Calculate balances for each account
    const accountsWithBalances = await Promise.all(
      accounts.map(async (acc) => {
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

        return {
          name: acc.name,
          currentBalance: Math.max(0, currentBalance),
          goal: safeNumber(acc.goal),
          totalContributed,
          totalDividends,
          totalWithdrawn,
          startingBalance: safeNumber(acc.startingBalance),
        };
      })
    );

    // Build CSV
    const headers = [
      "Account Name",
      "Current Balance",
      "Goal",
      "Total Contributed",
      "Total Dividends",
      "Total Withdrawn",
      "Starting Balance",
    ];

    const rows = accountsWithBalances.map((acc) => [
      acc.name,
      acc.currentBalance.toFixed(2),
      acc.goal.toFixed(2),
      acc.totalContributed.toFixed(2),
      acc.totalDividends.toFixed(2),
      acc.totalWithdrawn.toFixed(2),
      acc.startingBalance.toFixed(2),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const filename = `savings_accounts_summary.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);

    logger.info(`Exported account summary for user ${userId}`);
  } catch (error) {
    logger.error("Error exporting accounts:", error);
    res.status(500).json({ message: "Failed to export accounts" });
  }
}

/**
 * Export yearly summary as CSV
 */
export async function exportYearlySummary(req, res) {
  try {
    const userId = req.user.id || req.user._id;
    const { year } = req.query;

    const numYear = year ? parseInt(year) : new Date().getFullYear();

    // Get monthly breakdown
    const summaryData = [];

    for (let month = 1; month <= 12; month++) {
      const transactions = await SavingsTransaction.find({
        userId,
        year: numYear,
        month,
        status: "completed",
      });

      let deposits = 0;
      let dividends = 0;
      let withdrawals = 0;

      for (const tx of transactions) {
        const amount = safeNumber(tx.amount);
        if (tx.type === "capital_add") deposits += amount;
        else if (tx.type === "dividend") dividends += amount;
        else if (tx.type === "withdrawal") withdrawals += amount;
      }

      const monthName = new Date(numYear, month - 1, 1).toLocaleString("en", {
        month: "long",
      });

      summaryData.push({
        month: monthName,
        deposits,
        dividends,
        withdrawals,
        net: deposits + dividends - withdrawals,
      });
    }

    // Build CSV
    const headers = ["Month", "Deposits", "Dividends", "Withdrawals", "Net"];

    const rows = summaryData.map((row) => [
      row.month,
      row.deposits.toFixed(2),
      row.dividends.toFixed(2),
      row.withdrawals.toFixed(2),
      row.net.toFixed(2),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell}"`).join(",")
      ),
    ].join("\n");

    const filename = `savings_yearly_summary_${numYear}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);

    logger.info(`Exported yearly summary for user ${userId}, year ${numYear}`);
  } catch (error) {
    logger.error("Error exporting yearly summary:", error);
    res.status(500).json({ message: "Failed to export yearly summary" });
  }
}