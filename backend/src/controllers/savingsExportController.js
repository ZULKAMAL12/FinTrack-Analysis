import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function clampInt(v, min, max) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

function csvEscape(val) {
  const s = val === null || val === undefined ? "" : String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(headers, rows) {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

function sendCSV(res, filename, csv) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

export async function exportTransactions(req, res) {
  const userId = req.user._id;

  const year = req.query.year ? clampInt(req.query.year, 2000, 2100) : null;
  const accountId =
    req.query.accountId && req.query.accountId !== "all"
      ? req.query.accountId
      : null;

  const filter = { userId };
  if (year) filter.year = year;
  if (accountId) filter.accountId = accountId;

  const tx = await SavingsTransaction.find(filter)
    .sort({ year: 1, month: 1, day: 1, createdAt: 1 })
    .lean();

  if (!tx.length)
    return sendCSV(res, `savings_transactions_${year || "all"}.csv`, "");

  const accountIds = [...new Set(tx.map((t) => String(t.accountId)))];
  const accounts = await SavingsAccount.find(
    { userId, _id: { $in: accountIds } },
    { name: 1 },
  ).lean();
  const nameMap = {};
  for (const a of accounts) nameMap[String(a._id)] = a.name;

  const headers = [
    "No",
    "Account Name",
    "Account ID",
    "Year",
    "Month",
    "Date (ISO)",
    "Transaction Type",
    "Amount (RM)",
    "Status",
    "Source",
    "Notes",
    "Created At",
  ];

  const rows = tx.map((t, idx) => [
    idx + 1,
    nameMap[String(t.accountId)] || "",
    String(t.accountId),
    t.year,
    t.month,
    t.dateISO || "",
    t.type,
    safeNumber(t.amount, 0).toFixed(2),
    t.status || "completed",
    t.source || "manual",
    t.notes || "",
    t.createdAt ? new Date(t.createdAt).toISOString() : "",
  ]);

  const yPart = year ? String(year) : "all";
  const csv = toCSV(headers, rows);
  sendCSV(res, `savings_transactions_${yPart}.csv`, csv);
}

async function computeAccountAgg(userId) {
  const rows = await SavingsTransaction.aggregate([
    { $match: { userId, status: "completed" } },
    {
      $group: {
        _id: "$accountId",
        totalContributed: {
          $sum: { $cond: [{ $eq: ["$type", "capital_add"] }, "$amount", 0] },
        },
        totalDividendsReceived: {
          $sum: { $cond: [{ $eq: ["$type", "dividend"] }, "$amount", 0] },
        },
        totalWithdrawn: {
          $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] },
        },
      },
    },
  ]);

  const map = {};
  for (const r of rows) {
    map[String(r._id)] = {
      totalContributed: safeNumber(r.totalContributed),
      totalDividendsReceived: safeNumber(r.totalDividendsReceived),
      totalWithdrawn: safeNumber(r.totalWithdrawn),
    };
  }
  return map;
}

export async function exportAccounts(req, res) {
  const userId = req.user._id;

  const accounts = await SavingsAccount.find({ userId })
    .sort({ createdAt: 1 })
    .lean();
  if (!accounts.length) return sendCSV(res, "savings_accounts_summary.csv", "");

  const agg = await computeAccountAgg(userId);

  const headers = [
    "No",
    "Account Name",
    "Goal (RM)",
    "Total Contributed (RM)",
    "Total Dividends Received (RM)",
    "Total Withdrawn (RM)",
    "Current Balance (RM)",
    "Expected Rate (% p.a.)",
    "Return Frequency",
    "ROI (actual, %)",
    "Account Created Date",
  ];

  const rows = accounts.map((a, idx) => {
    const x = agg[String(a._id)] || {
      totalContributed: 0,
      totalDividendsReceived: 0,
      totalWithdrawn: 0,
    };
    const currentBalance =
      safeNumber(a.startingBalance, 0) +
      x.totalContributed +
      x.totalDividendsReceived -
      x.totalWithdrawn;
    const roi =
      x.totalContributed > 0
        ? (x.totalDividendsReceived / x.totalContributed) * 100
        : 0;

    return [
      idx + 1,
      a.name || "",
      safeNumber(a.goal, 0).toFixed(2),
      x.totalContributed.toFixed(2),
      x.totalDividendsReceived.toFixed(2),
      x.totalWithdrawn.toFixed(2),
      Number(currentBalance.toFixed(2)).toFixed(2),
      safeNumber(a.ratePercent, 0).toFixed(2),
      a.returnFrequency || "daily_working",
      roi.toFixed(2),
      a.createdAt ? new Date(a.createdAt).toISOString() : "",
    ];
  });

  const csv = toCSV(headers, rows);
  sendCSV(res, "savings_accounts_summary.csv", csv);
}

export async function exportYearlySummary(req, res) {
  const userId = req.user._id;
  const year = clampInt(req.query.year, 2000, 2100);
  const accountId =
    req.query.accountId && req.query.accountId !== "all"
      ? req.query.accountId
      : null;

  const txFilter = { userId, year, status: "completed" };
  if (accountId) txFilter.accountId = accountId;

  const rows = await SavingsTransaction.aggregate([
    { $match: txFilter },
    {
      $group: {
        _id: "$accountId",
        capitalAdded: {
          $sum: { $cond: [{ $eq: ["$type", "capital_add"] }, "$amount", 0] },
        },
        dividends: {
          $sum: { $cond: [{ $eq: ["$type", "dividend"] }, "$amount", 0] },
        },
        withdrawals: {
          $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] },
        },
      },
    },
  ]);

  if (!rows.length)
    return sendCSV(res, `savings_yearly_summary_${year}.csv`, "");

  const accountIds = rows.map((r) => r._id);
  const accounts = await SavingsAccount.find(
    { userId, _id: { $in: accountIds } },
    { name: 1, startingBalance: 1 },
  ).lean();
  const nameMap = {};
  const startMap = {};
  for (const a of accounts) {
    nameMap[String(a._id)] = a.name;
    startMap[String(a._id)] = safeNumber(a.startingBalance, 0);
  }

  // End-of-year balance = startingBalance + lifetime completed up to that year
  // For simplicity, we compute "balance up to end of year" by summing all completed tx up to that year.
  const lifetimeAgg = await SavingsTransaction.aggregate([
    {
      $match: {
        userId,
        status: "completed",
        year: { $lte: year },
        ...(accountId ? { accountId } : {}),
      },
    },
    {
      $group: {
        _id: "$accountId",
        cap: {
          $sum: { $cond: [{ $eq: ["$type", "capital_add"] }, "$amount", 0] },
        },
        div: {
          $sum: { $cond: [{ $eq: ["$type", "dividend"] }, "$amount", 0] },
        },
        wd: {
          $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] },
        },
      },
    },
  ]);

  const lifeMap = {};
  for (const r of lifetimeAgg) {
    lifeMap[String(r._id)] = {
      cap: safeNumber(r.cap),
      div: safeNumber(r.div),
      wd: safeNumber(r.wd),
    };
  }

  const headers = [
    "No",
    "Account Name",
    "Year",
    "Capital Added (RM)",
    "Dividends Earned (RM)",
    "Withdrawals (RM)",
    "Net Change (RM)",
    "End-of-Year Balance (RM)",
    "Yearly ROI (%)",
  ];

  const outRows = rows.map((r, idx) => {
    const aId = String(r._id);
    const cap = safeNumber(r.capitalAdded, 0);
    const div = safeNumber(r.dividends, 0);
    const wd = safeNumber(r.withdrawals, 0);
    const netChange = cap + div - wd;

    const life = lifeMap[aId] || { cap: 0, div: 0, wd: 0 };
    const eoyBalance =
      safeNumber(startMap[aId], 0) + life.cap + life.div - life.wd;

    const yearlyRoi = cap > 0 ? (div / cap) * 100 : 0;

    return [
      idx + 1,
      nameMap[aId] || "",
      year,
      cap.toFixed(2),
      div.toFixed(2),
      wd.toFixed(2),
      netChange.toFixed(2),
      Number(eoyBalance.toFixed(2)).toFixed(2),
      yearlyRoi.toFixed(2),
    ];
  });

  const csv = toCSV(headers, outRows);
  sendCSV(res, `savings_yearly_summary_${year}.csv`, csv);
}
