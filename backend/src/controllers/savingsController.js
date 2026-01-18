import mongoose from "mongoose";
import SavingsAccount from "../models/SavingsAccount.js";

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function cleanStr(v) {
  return String(v || "").trim();
}
function isHexColor(v) {
  return typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v);
}
function pickFreq(v) {
  const allowed = ["daily", "weekly", "monthly", "yearly"];
  return allowed.includes(v) ? v : "daily";
}

async function getOwnedAccount(req, res) {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: "Invalid account id" });
    return null;
  }

  const acc = await SavingsAccount.findOne({ _id: id, userId: req.user.id });
  if (!acc) {
    res.status(404).json({ message: "Savings account not found" });
    return null;
  }

  return acc;
}

/* GET /api/savings */
export async function listSavings(req, res) {
  const accounts = await SavingsAccount.find({ userId: req.user.id })
    .sort({ updatedAt: -1 })
    .lean();

  res.json({ accounts });
}

/* POST /api/savings */
export async function createSavingsAccount(req, res) {
  const name = cleanStr(req.body.name);
  if (!name) return res.status(400).json({ message: "name is required" });

  const color = isHexColor(req.body.color) ? req.body.color : "#0ea5e9";
  const goal = Math.max(toNum(req.body.goal, 0), 0);

  const autoSave = !!req.body.autoSave;
  const autoAmount = Math.max(toNum(req.body.autoAmount, 0), 0);

  const initialCapital = Math.max(toNum(req.body.initialCapital, 0), 0);
  const ratePercent = Math.max(toNum(req.body.ratePercent, 0), 0);
  const returnFrequency = pickFreq(req.body.returnFrequency);
  const monthlyContribution = Math.max(
    toNum(req.body.monthlyContribution, 0),
    0
  );

  // ✅ if user already has money in account, set capital immediately
  const capital = initialCapital;

  const account = await SavingsAccount.create({
    userId: req.user.id,
    name,
    color,
    goal,
    autoSave,
    autoAmount,
    initialCapital,
    ratePercent,
    returnFrequency,
    monthlyContribution,
    capital,
    dividend: 0,
    history:
      initialCapital > 0
        ? [{ type: "adjust", amount: initialCapital, note: "Initial balance" }]
        : [],
  });

  res.status(201).json({ account });
}


/* PUT /api/savings/:id */
export async function updateSavingsAccount(req, res) {
  const acc = await getOwnedAccount(req, res);
  if (!acc) return;

  if (req.body.name !== undefined) {
    const name = cleanStr(req.body.name);
    if (!name) return res.status(400).json({ message: "name cannot be empty" });
    acc.name = name;
  }

  if (req.body.color !== undefined) {
    acc.color = isHexColor(req.body.color) ? req.body.color : acc.color;
  }

  if (req.body.goal !== undefined)
    acc.goal = Math.max(toNum(req.body.goal, 0), 0);

  if (req.body.autoSave !== undefined) acc.autoSave = !!req.body.autoSave;
  if (req.body.autoAmount !== undefined)
    acc.autoAmount = Math.max(toNum(req.body.autoAmount, 0), 0);

  if (req.body.ratePercent !== undefined)
    acc.ratePercent = Math.max(toNum(req.body.ratePercent, 0), 0);

  if (req.body.returnFrequency !== undefined)
    acc.returnFrequency = pickFreq(req.body.returnFrequency);

  if (req.body.monthlyContribution !== undefined)
    acc.monthlyContribution = Math.max(
      toNum(req.body.monthlyContribution, 0),
      0
    );

  if (req.body.initialCapital !== undefined)
    acc.initialCapital = Math.max(toNum(req.body.initialCapital, 0), 0);

  await acc.save();
  res.json({ account: acc });
}

/* POST /api/savings/:id/transactions */
export async function addSavingsTransaction(req, res) {
  const acc = await getOwnedAccount(req, res);
  if (!acc) return;

  const type = cleanStr(req.body.type);
  const amount = toNum(req.body.amount, -1);
  const note = cleanStr(req.body.note);

  const allowed = ["deposit", "withdraw", "dividend", "auto", "adjust"];
  if (!allowed.includes(type))
    return res.status(400).json({ message: "Invalid transaction type" });

  if (!Number.isFinite(amount) || amount <= 0)
    return res.status(400).json({ message: "amount must be > 0" });

  if (type === "withdraw") {
    if (acc.capital - amount < 0)
      return res.status(400).json({ message: "Insufficient capital" });
    acc.capital = Math.max(acc.capital - amount, 0);
  } else if (type === "dividend") {
    acc.dividend = Math.max(acc.dividend + amount, 0);
  } else {
    // deposit/auto/adjust increase capital
    acc.capital = Math.max(acc.capital + amount, 0);
  }

  acc.history.push({ type, amount, date: new Date(), note });

  // keep history reasonable
  if (acc.history.length > 250) {
    acc.history = acc.history.slice(acc.history.length - 250);
  }

  await acc.save();
  res.json({ account: acc });
}
//delete saving
export async function deleteSavingsAccount(req, res) {
  const { id } = req.params;

  const doc = await SavingsAccount.findOneAndDelete({
    _id: id,
    userId: req.user.id,
  });

  if (!doc) return res.status(404).json({ message: "Account not found" });

  res.json({ ok: true });
}
