import Expense from "../models/Expense.js";
import Budget from "../models/Budget.js";
import logger from "../utils/logger.js";

/**
 * List expenses with filters
 */
export async function listExpenses(req, res) {
  const userId = req.user._id;

  try {
    const { year, month, type, category, search, page = 1, limit = 10 } = req.query;

    // Build query
    const query = { userId, deletedAt: null };

    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (type && type !== "All") query.type = type;
    if (category && category !== "All") query.category = category;

    // Search in note or category
    if (search) {
      query.$or = [
        { note: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [expenses, total] = await Promise.all([
      Expense.find(query)
        .sort({ dateISO: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Expense.countDocuments(query),
    ]);

    res.json({
      expenses,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("List expenses error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch expenses",
    });
  }
}

/**
 * Get expense summary (totals, comparison)
 */
export async function getExpenseSummary(req, res) {
  const userId = req.user._id;

  try {
    const { year, month } = req.query;

    const currentQuery = {
      userId,
      deletedAt: null,
      year: parseInt(year),
      month: parseInt(month),
    };

    // Get current month data
    const currentExpenses = await Expense.find(currentQuery).lean();

    const currentIncome = currentExpenses
      .filter((e) => e.type === "Income")
      .reduce((sum, e) => sum + e.amount, 0);

    const currentExpense = currentExpenses
      .filter((e) => e.type === "Expense")
      .reduce((sum, e) => sum + e.amount, 0);

    // Get last month data for comparison
    let lastMonth = parseInt(month) - 1;
    let lastYear = parseInt(year);
    if (lastMonth < 1) {
      lastMonth = 12;
      lastYear -= 1;
    }

    const lastMonthQuery = {
      userId,
      deletedAt: null,
      year: lastYear,
      month: lastMonth,
    };

    const lastMonthExpenses = await Expense.find(lastMonthQuery).lean();

    const lastMonthIncome = lastMonthExpenses
      .filter((e) => e.type === "Income")
      .reduce((sum, e) => sum + e.amount, 0);

    const lastMonthExpense = lastMonthExpenses
      .filter((e) => e.type === "Expense")
      .reduce((sum, e) => sum + e.amount, 0);

    // Category breakdown
    const categoryBreakdown = currentExpenses
      .filter((e) => e.type === "Expense")
      .reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {});

    const categoryData = Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      value,
    }));

    res.json({
      current: {
        income: currentIncome,
        expense: currentExpense,
        balance: currentIncome - currentExpense,
      },
      lastMonth: {
        income: lastMonthIncome,
        expense: lastMonthExpense,
        balance: lastMonthIncome - lastMonthExpense,
      },
      categoryBreakdown: categoryData,
    });
  } catch (error) {
    logger.error("Get expense summary error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch summary",
    });
  }
}

/**
 * Get spending insights with budget integration
 */
export async function getSpendingInsights(req, res) {
  const userId = req.user._id;

  try {
    const { year, month } = req.query;

    const currentQuery = {
      userId,
      deletedAt: null,
      type: "Expense",
      year: parseInt(year),
      month: parseInt(month),
    };

    const expenses = await Expense.find(currentQuery).lean();

    // Category breakdown with details
    const categoryBreakdown = expenses.reduce((acc, e) => {
      if (!acc[e.category]) {
        acc[e.category] = { total: 0, count: 0, transactions: [] };
      }
      acc[e.category].total += e.amount;
      acc[e.category].count += 1;
      acc[e.category].transactions.push({
        amount: e.amount,
        date: `${e.year}-${String(e.month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`,
        note: e.note,
      });
      return acc;
    }, {});

    // Sort by spending (top categories)
    const topCategories = Object.entries(categoryBreakdown)
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        average: data.total / data.count,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Payment method breakdown
    const paymentMethodBreakdown = expenses.reduce((acc, e) => {
      acc[e.paymentMethod] = (acc[e.paymentMethod] || 0) + e.amount;
      return acc;
    }, {});

    // Daily spending trend
    const dailySpending = expenses.reduce((acc, e) => {
      const day = e.day;
      acc[day] = (acc[day] || 0) + e.amount;
      return acc;
    }, {});

    const dailyTrend = Object.entries(dailySpending)
      .map(([day, amount]) => ({
        day: parseInt(day),
        amount,
      }))
      .sort((a, b) => a.day - b.day);

    // Get budget data from existing Budget model
    let budgetComparison = null;
    const budget = await Budget.findOne({
      userId,
      year: parseInt(year),
      month: parseInt(month),
    }).lean();

    if (budget) {
      const categorySpending = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {});

      // Extract all expense items from budget sections
      const budgetCategories = [];
      budget.sections.forEach((section) => {
        // Only process expense sections (kind or type)
        if (section.kind === "expense" || section.type === "expense") {
          section.items.forEach((item) => {
            budgetCategories.push({
              category: item.label,
              limit: item.amount,
            });
          });
        }
      });

      budgetComparison = budgetCategories.map((cat) => {
        const spent = categorySpending[cat.category] || 0;
        const remaining = cat.limit - spent;
        const percentage = cat.limit > 0 ? (spent / cat.limit) * 100 : 0;

        return {
          category: cat.category,
          limit: cat.limit,
          spent,
          remaining: Math.max(0, remaining),
          percentage: parseFloat(percentage.toFixed(1)),
          status:
            percentage >= 100
              ? "exceeded"
              : percentage >= 80
                ? "warning"
                : "ok",
        };
      });

      // Sort by most over budget first
      budgetComparison.sort((a, b) => b.percentage - a.percentage);
    }

    // Calculate spending velocity (daily average)
    const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const today = new Date();
    const currentDay =
      today.getFullYear() === parseInt(year) && today.getMonth() + 1 === parseInt(month)
        ? today.getDate()
        : daysInMonth;
    const dailyAverage = currentDay > 0 ? totalSpent / currentDay : 0;
    const projectedMonthlySpending = dailyAverage * daysInMonth;

    // Calculate budget totals
    let totalBudget = 0;
    let totalIncome = 0;
    if (budget) {
      budget.sections.forEach((section) => {
        const sectionTotal = section.items.reduce((sum, item) => sum + item.amount, 0);
        if (section.kind === "income" || section.type === "income") {
          totalIncome += sectionTotal;
        } else if (section.kind === "expense" || section.type === "expense") {
          totalBudget += sectionTotal;
        }
      });
    }

    res.json({
      summary: {
        totalSpent,
        transactionCount: expenses.length,
        dailyAverage: parseFloat(dailyAverage.toFixed(2)),
        projectedMonthly: parseFloat(projectedMonthlySpending.toFixed(2)),
        totalBudget,
        totalIncome,
        budgetRemaining: Math.max(0, totalBudget - totalSpent),
        overBudget: totalSpent > totalBudget,
      },
      topCategories,
      categoryBreakdown,
      paymentMethodBreakdown,
      dailyTrend,
      budgetComparison,
    });
  } catch (error) {
    logger.error("Get spending insights error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch insights",
    });
  }
}

/**
 * Get category trends (last 6 months)
 */
export async function getCategoryTrends(req, res) {
  const userId = req.user._id;

  try {
    const { year, month } = req.query;

    // Get last 6 months of data
    const months = [];
    let currentYear = parseInt(year);
    let currentMonth = parseInt(month);

    for (let i = 0; i < 6; i++) {
      months.unshift({ year: currentYear, month: currentMonth });
      currentMonth--;
      if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
      }
    }

    const trends = await Promise.all(
      months.map(async ({ year: y, month: m }) => {
        const expenses = await Expense.find({
          userId,
          deletedAt: null,
          type: "Expense",
          year: y,
          month: m,
        }).lean();

        const categoryTotals = expenses.reduce((acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + e.amount;
          return acc;
        }, {});

        return {
          year: y,
          month: m,
          label: `${y}-${String(m).padStart(2, "0")}`,
          categories: categoryTotals,
          total: expenses.reduce((sum, e) => sum + e.amount, 0),
        };
      })
    );

    res.json({ trends });
  } catch (error) {
    logger.error("Get category trends error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch trends",
    });
  }
}

/**
 * Get quick alerts for budget overspending
 */
export async function getQuickAlerts(req, res) {
  const userId = req.user._id;

  try {
    const { year, month } = req.query;

    const expenses = await Expense.find({
      userId,
      deletedAt: null,
      type: "Expense",
      year: parseInt(year),
      month: parseInt(month),
    }).lean();

    const budget = await Budget.findOne({
      userId,
      year: parseInt(year),
      month: parseInt(month),
    }).lean();

    const alerts = [];

    if (budget) {
      // Calculate category spending
      const categorySpending = expenses.reduce((acc, e) => {
        acc[e.category] = (acc[e.category] || 0) + e.amount;
        return acc;
      }, {});

      // Check each budget category
      budget.sections.forEach((section) => {
        if (section.kind === "expense" || section.type === "expense") {
          section.items.forEach((item) => {
            const spent = categorySpending[item.label] || 0;
            const percentage = item.amount > 0 ? (spent / item.amount) * 100 : 0;

            // Only show exceeded alerts when actually over budget (>100%, not >=100%)
            if (percentage > 100) {
              const overAmount = spent - item.amount;
              alerts.push({
                type: "exceeded",
                severity: "high",
                category: item.label,
                message: `${item.label} exceeded by RM ${overAmount.toFixed(2)}!`,
                spent,
                limit: item.amount,
                percentage: parseFloat(percentage.toFixed(1)),
              });
            } else if (percentage >= 90 && percentage < 100) {
              // Warning when approaching limit (90-99%), but not at limit yet
              const remaining = item.amount - spent;
              alerts.push({
                type: "warning",
                severity: "medium",
                category: item.label,
                message: `${item.label} at ${percentage.toFixed(0)}% (RM ${remaining.toFixed(2)} left)`,
                spent,
                limit: item.amount,
                percentage: parseFloat(percentage.toFixed(1)),
              });
            }
          });
        }
      });

      // Calculate total budget
      const totalBudget = budget.sections
        .filter((s) => s.kind === "expense" || s.type === "expense")
        .reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.amount, 0), 0);

      const totalSpent = expenses.reduce((sum, e) => sum + e.amount, 0);
      const totalPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

      // Only show total budget alert if exceeded or very close (>95%)
      if (totalPercentage > 100) {
        const overAmount = totalSpent - totalBudget;
        alerts.push({
          type: "overall",
          severity: "high",
          message: `Total budget exceeded by RM ${overAmount.toFixed(2)}!`,
          spent: totalSpent,
          limit: totalBudget,
          percentage: parseFloat(totalPercentage.toFixed(1)),
        });
      } else if (totalPercentage >= 95 && totalPercentage <= 100) {
        const remaining = totalBudget - totalSpent;
        alerts.push({
          type: "overall",
          severity: "medium",
          message: `Total budget at ${totalPercentage.toFixed(0)}% (RM ${remaining.toFixed(2)} left)`,
          spent: totalSpent,
          limit: totalBudget,
          percentage: parseFloat(totalPercentage.toFixed(1)),
        });
      }
    }

    // Check for unusual spending (>2x average of all transactions)
    const avgExpense =
      expenses.length > 0
        ? expenses.reduce((sum, e) => sum + e.amount, 0) / expenses.length
        : 0;

    const unusualExpenses = expenses.filter((e) => e.amount > avgExpense * 3).slice(0, 3);

    unusualExpenses.forEach((e) => {
      alerts.push({
        type: "unusual",
        severity: "low",
        message: `Unusual ${e.category} expense: RM ${e.amount.toFixed(2)}`,
        amount: e.amount,
        category: e.category,
        note: e.note,
        date: `${e.year}-${String(e.month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`,
      });
    });

    res.json({ alerts });
  } catch (error) {
    logger.error("Get quick alerts error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch alerts",
    });
  }
}

/**
 * Create expense
 */
export async function createExpense(req, res) {
  const userId = req.user._id;

  try {
    const { type, category, amount, note, paymentMethod, year, month, day } = req.body;

    const expense = new Expense({
      userId,
      type,
      category,
      amount,
      note: note || "",
      paymentMethod: paymentMethod || "Cash",
      year,
      month,
      day,
    });

    await expense.save();

    logger.info("Expense created", {
      userId,
      expenseId: expense._id,
      type,
      category,
      amount,
      paymentMethod,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json(expense);
  } catch (error) {
    logger.error("Create expense error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to create expense",
    });
  }
}

/**
 * Update expense
 */
export async function updateExpense(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const { type, category, amount, note, paymentMethod, year, month, day } = req.body;

    const expense = await Expense.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    // Update fields
    if (type) expense.type = type;
    if (category) expense.category = category;
    if (amount !== undefined) expense.amount = amount;
    if (note !== undefined) expense.note = note;
    if (paymentMethod) expense.paymentMethod = paymentMethod;
    if (year) expense.year = year;
    if (month) expense.month = month;
    if (day) expense.day = day;

    await expense.save();

    logger.info("Expense updated", {
      userId,
      expenseId: expense._id,
      ip: req.ip,
    });

    res.json(expense);
  } catch (error) {
    logger.error("Update expense error:", {
      userId,
      expenseId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to update expense",
    });
  }
}

/**
 * Delete expense (soft delete)
 */
export async function deleteExpense(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const expense = await Expense.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    expense.deletedAt = new Date();
    await expense.save();

    logger.info("Expense deleted", {
      userId,
      expenseId: expense._id,
      type: expense.type,
      amount: expense.amount,
      ip: req.ip,
    });

    res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    logger.error("Delete expense error:", {
      userId,
      expenseId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to delete expense",
    });
  }
}

/**
 * Export expenses to CSV
 */
export async function exportExpenses(req, res) {
  const userId = req.user._id;

  try {
    const { year, month, type, category } = req.query;

    const query = { userId, deletedAt: null };

    if (year) query.year = parseInt(year);
    if (month) query.month = parseInt(month);
    if (type && type !== "All") query.type = type;
    if (category && category !== "All") query.category = category;

    const expenses = await Expense.find(query).sort({ dateISO: -1 }).lean();

    if (expenses.length === 0) {
      return res.status(404).json({ message: "No expenses found" });
    }

    // CSV headers
    const headers = ["Date", "Type", "Category", "Amount", "Payment Method", "Note"];
    const rows = expenses.map((e) => [
      `${e.year}-${String(e.month).padStart(2, "0")}-${String(e.day).padStart(2, "0")}`,
      e.type,
      e.category,
      e.amount.toFixed(2),
      e.paymentMethod,
      (e.note || "").replace(/"/g, '""'), // Escape quotes
    ]);

    // Build CSV
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="expenses_${year || "all"}_${month || "all"}.csv"`
    );

    res.send(csv);

    logger.info("Expenses exported", {
      userId,
      count: expenses.length,
      year,
      month,
    });
  } catch (error) {
    logger.error("Export expenses error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to export expenses",
    });
  }
}