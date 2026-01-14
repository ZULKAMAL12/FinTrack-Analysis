import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";

export async function listTransactions(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  const filter = { userId: req.user.id };
  if (year) filter.year = year;
  if (month) filter.month = month;

  const tx = await Transaction.find(filter)
    .sort({ date: -1, createdAt: -1 })
    .limit(500);

  res.json({ transactions: tx });
}

export async function createTransaction(req, res) {
  const {
    accountId,
    type,
    category,
    amount,
    date,
    description = "",
  } = req.body;

  if (!accountId || !type || !category || amount === undefined || !date) {
    return res
      .status(400)
      .json({ message: "accountId, type, category, amount, date required" });
  }

  const account = await Account.findOne({
    _id: accountId,
    userId: req.user.id,
  });
  if (!account) return res.status(404).json({ message: "Account not found" });

  const d = new Date(date);
  if (isNaN(d.getTime()))
    return res.status(400).json({ message: "Invalid date" });

  const amt = Number(amount);
  if (!(amt > 0))
    return res.status(400).json({ message: "amount must be > 0" });

  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  const tx = await Transaction.create({
    userId: req.user.id,
    accountId,
    type,
    category,
    amount: amt,
    date: d,
    description,
    year,
    month,
  });

  res.status(201).json({ transaction: tx });
}

export async function deleteTransaction(req, res) {
  const { id } = req.params;
  const deleted = await Transaction.findOneAndDelete({
    _id: id,
    userId: req.user.id,
  });
  if (!deleted)
    return res.status(404).json({ message: "Transaction not found" });
  res.json({ ok: true });
}
