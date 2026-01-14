import Budget from "../models/Budget.js";

function defaultSections() {
  return [
    {
      name: "Income 💰",
      type: "income",
      items: [],
    },
    {
      name: "Expenses 💸",
      type: "expense",
      items: [],
    },
    {
      name: "Savings 🏦",
      type: "saving",
      items: [],
    },
    {
      name: "Debt 💳",
      type: "debt",
      items: [],
    },
  ];
}

export async function getBudget(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month)
    return res.status(400).json({ message: "year and month are required" });

  const doc = await Budget.findOne({ userId: req.user.id, year, month });
  if (!doc) {
    return res.json({
      budget: { year, month, sections: defaultSections() },
    });
  }

  res.json({
    budget: {
      year: doc.year,
      month: doc.month,
      sections: doc.sections || defaultSections(),
    },
  });
}

export async function upsertBudget(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);

  if (!year || !month)
    return res.status(400).json({ message: "year and month are required" });

  const { sections } = req.body;
  if (!Array.isArray(sections))
    return res.status(400).json({ message: "sections must be an array" });

  // Basic sanitization
  const cleaned = sections.map((s) => ({
    name: String(s.name || "").trim(),
    type: s.type,
    items: Array.isArray(s.items)
      ? s.items.map((i) => ({
          label: String(i.label || "").trim(),
          amount: Number(i.amount) || 0,
        }))
      : [],
  }));

  const doc = await Budget.findOneAndUpdate(
    { userId: req.user.id, year, month },
    { $set: { sections: cleaned } },
    { new: true, upsert: true }
  );

  res.json({
    budget: { year: doc.year, month: doc.month, sections: doc.sections },
  });
}
