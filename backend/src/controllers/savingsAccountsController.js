import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";

function isHexColor(v) {
  return typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function computeAggregates(userId) {
  // Group completed transactions per account
  const rows = await SavingsTransaction.aggregate([
    { $match: { userId, status: "completed" } },
    {
      $group: {
        _id: "$accountId",
        totalContributed: {
          $sum: {
            $cond: [{ $eq: ["$type", "capital_add"] }, "$amount", 0],
          },
        },
        totalDividendsReceived: {
          $sum: {
            $cond: [{ $eq: ["$type", "dividend"] }, "$amount", 0],
          },
        },
        totalWithdrawn: {
          $sum: {
            $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0],
          },
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

export async function listAccounts(req, res) {
  const userId = req.user._id;

  const accounts = await SavingsAccount.find({ userId })
    .sort({ createdAt: -1 })
    .lean();
  const agg = await computeAggregates(userId);

  const out = accounts.map((a) => {
    const x = agg[String(a._id)] || {
      totalContributed: 0,
      totalDividendsReceived: 0,
      totalWithdrawn: 0,
    };
    const starting = safeNumber(a.startingBalance, 0);

    const currentBalance =
      starting +
      x.totalContributed +
      x.totalDividendsReceived -
      x.totalWithdrawn;

    return {
      ...a,
      totalContributed: x.totalContributed,
      totalDividendsReceived: x.totalDividendsReceived,
      totalWithdrawn: x.totalWithdrawn,
      currentBalance: Number(currentBalance.toFixed(2)),
    };
  });

  res.json({ accounts: out });
}

export async function createAccount(req, res) {
  const userId = req.user._id;
  const data = req.validatedBody;

  const name = String(req.body.name || "").trim();
  if (!name)
    return res.status(400).json({ message: "Account name is required." });

  const color = isHexColor(req.body.color) ? req.body.color : "#0ea5e9";

  const account = await SavingsAccount.create({
    userId,
    name,
    color,
    goal: Math.max(safeNumber(req.body.goal, 0), 0),
    startingBalance: Math.max(safeNumber(req.body.startingBalance, 0), 0),

    ratePercent: Math.max(safeNumber(req.body.ratePercent, 0), 0),
    returnFrequency: req.body.returnFrequency || "daily_working",
    monthlyContribution: Math.max(
      safeNumber(req.body.monthlyContribution, 0),
      0,
    ),

    autoDepositReminder: !!req.body.autoDepositReminder,
  });

  res.status(201).json({ account });
}

export async function updateAccount(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  const account = await SavingsAccount.findOne({ _id: id, userId });
  if (!account) return res.status(404).json({ message: "Account not found." });

  const name = String(req.body.name || "").trim();
  if (!name)
    return res.status(400).json({ message: "Account name is required." });

  account.name = name;
  account.color = isHexColor(req.body.color) ? req.body.color : account.color;
  account.goal = Math.max(safeNumber(req.body.goal, account.goal), 0);

  account.startingBalance = Math.max(
    safeNumber(req.body.startingBalance, account.startingBalance),
    0,
  );

  account.ratePercent = Math.max(
    safeNumber(req.body.ratePercent, account.ratePercent),
    0,
  );
  account.returnFrequency = req.body.returnFrequency || account.returnFrequency;
  account.monthlyContribution = Math.max(
    safeNumber(req.body.monthlyContribution, account.monthlyContribution),
    0,
  );

  account.autoDepositReminder = !!req.body.autoDepositReminder;

  await account.save();
  res.json({ account });
}

export async function deleteAccount(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  const account = await SavingsAccount.findOne({ _id: id, userId });
  if (!account) return res.status(404).json({ message: "Account not found." });

  // Delete tx + recurring rules by cascade (simple)
  await SavingsTransaction.deleteMany({ userId, accountId: id });
  // recurring rules deleted in recurring controller if you want, but we can do here too:
  // await RecurringRule.deleteMany({ userId, accountId: id });

  await account.deleteOne();
  res.json({ ok: true });
}
