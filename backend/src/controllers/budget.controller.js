import Budget from "../models/Budget.js";

/**
 * NEW DEFAULT:
 * - use kind: "income" | "expense"
 * - keep type for backward compatibility (optional)
 */
function defaultSections() {
  return [
    { name: "Income 💰", kind: "income", type: "income", items: [] },
    { name: "Expenses 💸", kind: "expense", type: "expense", items: [] },
    // Savings & Debt are still “outflow” in the new UI model:
    { name: "Savings 🏦", kind: "expense", type: "saving", items: [] },
    { name: "Debt 💳", kind: "expense", type: "debt", items: [] },
  ];
}

function isValidMonth(m) {
  return Number.isInteger(m) && m >= 1 && m <= 12;
}

function clampAmount(x) {
  const n = Number(x);
  if (Number.isNaN(n) || n < 0) return 0;
  // keep cents
  return Math.round(n * 100) / 100;
}

/**
 * Accepts BOTH:
 * - new payload: { name, kind: "income"|"expense", items: [...] }
 * - old payload: { name, type: "income"|"expense"|"saving"|"debt", items: [...] }
 *
 * Output stored in DB:
 * - kind always present (income/expense)
 * - type also present (income/expense/saving/debt) for compatibility
 */
function sanitizeSections(inputSections = []) {
  const cleaned = [];

  for (const s of inputSections) {
    const name = String(s?.name || "")
      .trim()
      .slice(0, 40);
    if (!name) continue;

    const rawKind = String(s?.kind || "").toLowerCase();
    const rawType = String(s?.type || "").toLowerCase();

    // Determine kind
    // - prefer kind if provided
    // - fallback based on type
    const kind =
      rawKind === "income" || rawKind === "expense"
        ? rawKind
        : rawType === "income"
        ? "income"
        : "expense";

    // Determine type (compat):
    // - if old type is valid, keep it (income/expense/saving/debt)
    // - else derive from kind
    const typeAllowed = ["income", "expense", "saving", "debt"];
    const type = typeAllowed.includes(rawType)
      ? rawType
      : kind === "income"
      ? "income"
      : "expense";

    const items = Array.isArray(s?.items)
      ? s.items
          .map((i) => ({
            label: String(i?.label || "")
              .trim()
              .slice(0, 80),
            amount: clampAmount(i?.amount),
          }))
          .filter((i) => i.label) // remove empty labels
      : [];

    cleaned.push({ name, kind, type, items });
  }

  // If user deletes everything, fallback to defaults
  return cleaned.length ? cleaned : defaultSections();
}

function normalizeSectionsForResponse(docSections) {
  const secs = Array.isArray(docSections) ? docSections : defaultSections();

  // Ensure kind exists in response even for older docs
  return secs.map((s) => {
    const rawKind = String(s?.kind || "").toLowerCase();
    const rawType = String(s?.type || "").toLowerCase();

    const kind =
      rawKind === "income" || rawKind === "expense"
        ? rawKind
        : rawType === "income"
        ? "income"
        : "expense";

    // keep type if present
    const type = s?.type;

    return {
      name: s?.name,
      kind,
      type,
      items: Array.isArray(s?.items) ? s.items : [],
    };
  });
}

export async function getBudget(req, res) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isInteger(year) || !isValidMonth(month)) {
      return res.status(400).json({ message: "year and month are required" });
    }

    const doc = await Budget.findOne({ userId: req.user.id, year, month });

    if (!doc) {
      return res.json({
        budget: {
          year,
          month,
          sections: defaultSections(),
        },
      });
    }

    return res.json({
      budget: {
        year: doc.year,
        month: doc.month,
        sections: normalizeSectionsForResponse(doc.sections),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch budget" });
  }
}

export async function upsertBudget(req, res) {
  try {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!Number.isInteger(year) || !isValidMonth(month)) {
      return res.status(400).json({ message: "year and month are required" });
    }

    const { sections } = req.body;
    if (!Array.isArray(sections)) {
      return res.status(400).json({ message: "sections must be an array" });
    }

    const cleaned = sanitizeSections(sections);

    const doc = await Budget.findOneAndUpdate(
      { userId: req.user.id, year, month },
      { $set: { sections: cleaned } },
      { new: true, upsert: true }
    );

    return res.json({
      budget: {
        year: doc.year,
        month: doc.month,
        sections: normalizeSectionsForResponse(doc.sections),
      },
    });
  } catch (err) {
    // Duplicate key race condition (rare but possible)
    if (err?.code === 11000) {
      return res.status(409).json({ message: "Budget already exists" });
    }
    return res.status(500).json({ message: "Failed to save budget" });
  }
}
