import Account from "../models/Account.js";

export async function listAccounts(req, res) {
  const accounts = await Account.find({ userId: req.user.id }).sort({
    createdAt: -1,
  });
  res.json({ accounts });
}

export async function createAccount(req, res) {
  const {
    name,
    type,
    openingBalance = 0,
    currency = "MYR",
    note = "",
  } = req.body;
  if (!name) return res.status(400).json({ message: "Account name required" });

  const account = await Account.create({
    userId: req.user.id,
    name,
    type,
    openingBalance: Number(openingBalance) || 0,
    currency,
    note,
  });

  res.status(201).json({ account });
}

export async function updateAccount(req, res) {
  const { id } = req.params;

  const account = await Account.findOne({ _id: id, userId: req.user.id });
  if (!account) return res.status(404).json({ message: "Account not found" });

  const { name, type, openingBalance, currency, note } = req.body;

  if (name !== undefined) account.name = name;
  if (type !== undefined) account.type = type;
  if (openingBalance !== undefined)
    account.openingBalance = Number(openingBalance) || 0;
  if (currency !== undefined) account.currency = currency;
  if (note !== undefined) account.note = note;

  await account.save();
  res.json({ account });
}

export async function deleteAccount(req, res) {
  const { id } = req.params;
  const deleted = await Account.findOneAndDelete({
    _id: id,
    userId: req.user.id,
  });
  if (!deleted) return res.status(404).json({ message: "Account not found" });
  res.json({ ok: true });
}
