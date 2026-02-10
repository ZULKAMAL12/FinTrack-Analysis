import RecurringRule from "../models/RecurringRule.js";
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

function nowYM() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function compareYM(aY, aM, bY, bM) {
  if (aY !== bY) return aY - bY;
  return aM - bM;
}

function withinEnd(y, m, endY, endM) {
  if (!endY || !endM) return true;
  return compareYM(y, m, endY, endM) <= 0;
}

export async function listRules(req, res) {
  const userId = req.user._id;
  const accountId = req.query.accountId;

  const filter = { userId };
  if (accountId) filter.accountId = accountId;

  const rules = await RecurringRule.find(filter).sort({ createdAt: -1 }).lean();
  res.json({ rules });
}

export async function createRule(req, res) {
  const userId = req.user._id;
  const accountId = req.body.accountId;

  if (!accountId)
    return res.status(400).json({ message: "accountId is required." });

  const account = await SavingsAccount.findOne({ _id: accountId, userId });
  if (!account) return res.status(404).json({ message: "Account not found." });

  const amount = safeNumber(req.body.amount, -1);
  if (!(amount > 0))
    return res.status(400).json({ message: "Amount must be > 0." });

  const rule = await RecurringRule.create({
    userId,
    accountId,
    amount,
    frequency: "monthly",
    dayOfMonth: clampInt(req.body.dayOfMonth || 5, 1, 28),
    startYear: clampInt(req.body.startYear, 2000, 2100),
    startMonth: clampInt(req.body.startMonth, 1, 12),
    endYear: req.body.endYear
      ? clampInt(req.body.endYear, 2000, 2100)
      : undefined,
    endMonth: req.body.endMonth
      ? clampInt(req.body.endMonth, 1, 12)
      : undefined,
    mode: req.body.mode === "auto_confirm" ? "auto_confirm" : "pending",
    isActive: req.body.isActive !== false,
  });

  res.status(201).json({ rule });
}

export async function updateRule(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  const rule = await RecurringRule.findOne({ _id: id, userId });
  if (!rule) return res.status(404).json({ message: "Rule not found." });

  rule.amount = Math.max(safeNumber(req.body.amount, rule.amount), 0);
  rule.dayOfMonth = clampInt(req.body.dayOfMonth ?? rule.dayOfMonth, 1, 28);
  rule.startYear = clampInt(req.body.startYear ?? rule.startYear, 2000, 2100);
  rule.startMonth = clampInt(req.body.startMonth ?? rule.startMonth, 1, 12);

  rule.endYear = req.body.endYear
    ? clampInt(req.body.endYear, 2000, 2100)
    : undefined;
  rule.endMonth = req.body.endMonth
    ? clampInt(req.body.endMonth, 1, 12)
    : undefined;

  rule.mode = req.body.mode === "auto_confirm" ? "auto_confirm" : "pending";
  rule.isActive = req.body.isActive !== false;

  await rule.save();
  res.json({ rule });
}

export async function deleteRule(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  const rule = await RecurringRule.findOne({ _id: id, userId });
  if (!rule) return res.status(404).json({ message: "Rule not found." });

  await rule.deleteOne();
  res.json({ ok: true });
}

export async function generateMissing(req, res) {
  const userId = req.user._id;
  const { year: nowY, month: nowM } = nowYM();

  const rules = await RecurringRule.find({
    userId,
    isActive: true,
    frequency: "monthly",
  }).lean();
  if (rules.length === 0) return res.json({ ok: true, created: 0 });

  let created = 0;

  for (const r of rules) {
    // Ensure account exists
    const acc = await SavingsAccount.findOne({
      _id: r.accountId,
      userId,
    }).lean();
    if (!acc) continue;

    let y = r.startYear;
    let m = r.startMonth;

    // Generate from start to current month (inclusive), respecting optional end
    while (
      compareYM(y, m, nowY, nowM) <= 0 &&
      withinEnd(y, m, r.endYear, r.endMonth)
    ) {
      // Attempt to insert; unique index prevents duplicates
      const day = clampInt(r.dayOfMonth || 5, 1, 28);
      const status = r.mode === "auto_confirm" ? "completed" : "pending";

      try {
        await SavingsTransaction.create({
          userId,
          accountId: r.accountId,
          type: "capital_add",
          amount: safeNumber(r.amount, 0),
          year: y,
          month: m,
          day,
          dateISO: new Date(Date.UTC(y, m - 1, day)).toISOString(),
          status,
          source: "recurring",
          ruleId: r._id,
          notes: `Recurring deposit (day ${day})`,
        });
        created += 1;
      } catch (e) {
        // Duplicate? ignore
      }

      // next month
      m += 1;
      if (m === 13) {
        m = 1;
        y += 1;
      }
    }

    // Update lastGeneratedAt (optional)
    await RecurringRule.updateOne(
      { _id: r._id },
      { $set: { lastGeneratedAt: new Date() } },
    );
  }

  res.json({ ok: true, created });
}
