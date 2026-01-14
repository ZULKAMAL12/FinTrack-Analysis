import Transaction from "../models/Transaction.js";

export async function getDashboard(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month)
    return res.status(400).json({ message: "year and month are required" });

  const userId = req.user.id;

  const tx = await Transaction.find({ userId, year, month });

  const income = tx
    .filter((t) => t.type === "income")
    .reduce((a, b) => a + b.amount, 0);
  const expense = tx
    .filter((t) => t.type === "expense")
    .reduce((a, b) => a + b.amount, 0);

  const byCategory = {};
  for (const t of tx.filter((t) => t.type === "expense")) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }

  res.json({
    month: { year, month },
    totals: { income, expense, cashflow: income - expense },
    expenseByCategory: Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
  });
}
