import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import Budget from "../models/Budget.js";
import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import Debt from "../models/Debt.js"; // ✅ Only import Debt, not DebtPayment

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Comprehensive Dashboard Data
 */
export async function getDashboard(req, res) {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  
  if (!year || !month) {
    return res.status(400).json({ message: "year and month are required" });
  }

  const userId = req.user.id || req.user._id;

  try {
    // ========================================================================
    // 1. TRANSACTIONS (Income/Expense)
    // ========================================================================
    const tx = await Transaction.find({ userId, year, month });

    const income = tx
      .filter((t) => t.type === "income")
      .reduce((a, b) => a + safeNumber(b.amount), 0);
    
    const expense = tx
      .filter((t) => t.type === "expense")
      .reduce((a, b) => a + safeNumber(b.amount), 0);

    const byCategory = {};
    for (const t of tx.filter((t) => t.type === "expense")) {
      byCategory[t.category] = (byCategory[t.category] || 0) + safeNumber(t.amount);
    }

    const expenseByCategory = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // ========================================================================
    // 2. ACCOUNTS (Cash/Bank)
    // ========================================================================
    const accounts = await Account.find({ userId });
    
    const cashBalance = accounts
      .filter((a) => ["cash", "bank", "ewallet"].includes(a.type))
      .reduce((sum, a) => sum + safeNumber(a.openingBalance), 0);

    // ========================================================================
    // 3. BUDGETS
    // ========================================================================
    const budgets = await Budget.find({ userId, year, month });
    
    let totalBudget = 0;
    let totalSpent = 0;
    const budgetHealth = [];

    for (const b of budgets) {
      const budgetAmount = safeNumber(b.amount);
      const spent = byCategory[b.category] || 0;
      const remaining = budgetAmount - spent;
      const percentage = budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

      totalBudget += budgetAmount;
      totalSpent += spent;

      budgetHealth.push({
        category: b.category,
        budget: budgetAmount,
        spent,
        remaining,
        percentage: parseFloat(percentage.toFixed(1)),
        status: percentage >= 100 ? "over" : percentage >= 80 ? "warning" : "healthy",
      });
    }

    budgetHealth.sort((a, b) => b.percentage - a.percentage);

    const overBudgetCount = budgetHealth.filter((b) => b.status === "over").length;
    const warningCount = budgetHealth.filter((b) => b.status === "warning").length;

    // ========================================================================
    // 4. SAVINGS
    // ========================================================================
    const savingsAccounts = await SavingsAccount.find({ userId });

    // Compute savings balances
    const savingsAgg = await SavingsTransaction.aggregate([
      { $match: { userId, status: "completed" } },
      {
        $group: {
          _id: "$accountId",
          totalContributed: {
            $sum: { $cond: [{ $eq: ["$type", "capital_add"] }, "$amount", 0] },
          },
          totalDividends: {
            $sum: { $cond: [{ $eq: ["$type", "dividend"] }, "$amount", 0] },
          },
          totalWithdrawn: {
            $sum: { $cond: [{ $eq: ["$type", "withdrawal"] }, "$amount", 0] },
          },
        },
      },
    ]);

    const savingsMap = {};
    for (const s of savingsAgg) {
      savingsMap[String(s._id)] = {
        contributed: safeNumber(s.totalContributed),
        dividends: safeNumber(s.totalDividends),
        withdrawn: safeNumber(s.totalWithdrawn),
      };
    }

    let totalSavingsBalance = 0;
    let totalSavingsContributed = 0;
    let totalSavingsDividends = 0;

    const savingsSummary = savingsAccounts.map((acc) => {
      const data = savingsMap[String(acc._id)] || {
        contributed: 0,
        dividends: 0,
        withdrawn: 0,
      };
      const balance =
        safeNumber(acc.startingBalance) +
        data.contributed +
        data.dividends -
        data.withdrawn;

      totalSavingsBalance += balance;
      totalSavingsContributed += data.contributed;
      totalSavingsDividends += data.dividends;

      return {
        name: acc.name,
        balance: parseFloat(balance.toFixed(2)),
        goal: safeNumber(acc.goal),
        progress: acc.goal > 0 ? (balance / acc.goal) * 100 : 0,
      };
    });

    const savingsROI =
      totalSavingsContributed > 0
        ? (totalSavingsDividends / totalSavingsContributed) * 100
        : 0;

    // This month's savings deposits
    const savingsThisMonth = await SavingsTransaction.find({
      userId,
      year,
      month,
      type: "capital_add",
      status: "completed",
    });

    const monthlyDeposits = savingsThisMonth.reduce(
      (sum, t) => sum + safeNumber(t.amount),
      0
    );

    // ========================================================================
    // 5. DEBTS (✅ FIXED - Works with Debt model only)
    // ========================================================================
    const debts = await Debt.find({ userId });

    let totalDebtBalance = 0;
    let totalMonthlyPayment = 0;
    let totalInterestPaid = 0;

    const debtSummary = [];

    for (const d of debts) {
      // Get remaining balance from debt model
      // Assuming Debt model has: amount (original), amountPaid (total paid so far)
      const originalAmount = safeNumber(d.amount);
      const paid = safeNumber(d.amountPaid || 0);
      const remaining = Math.max(originalAmount - paid, 0);

      totalDebtBalance += remaining;
      totalMonthlyPayment += safeNumber(d.monthlyPayment);
      
      // If your Debt model tracks total interest paid
      totalInterestPaid += safeNumber(d.totalInterestPaid || 0);

      debtSummary.push({
        type: d.type || "Unknown",
        lender: d.lender || "N/A",
        balance: remaining,
        monthlyPayment: safeNumber(d.monthlyPayment),
        interestRate: safeNumber(d.interestRate),
      });
    }

    // Debt-free countdown (months to pay off all debts)
    const monthsToDebtFree =
      totalMonthlyPayment > 0
        ? Math.ceil(totalDebtBalance / totalMonthlyPayment)
        : 0;

    // ========================================================================
    // 6. INVESTMENTS
    // ========================================================================
    const investmentBalance = accounts
      .filter((a) => a.type === "investment")
      .reduce((sum, a) => sum + safeNumber(a.openingBalance), 0);

    // ========================================================================
    // 7. NET WORTH & FINANCIAL HEALTH
    // ========================================================================
    const totalAssets = cashBalance + totalSavingsBalance + investmentBalance;
    const netWorth = totalAssets - totalDebtBalance;

    // Savings rate
    const monthlySavings = income - expense;
    const savingsRate = income > 0 ? (monthlySavings / income) * 100 : 0;

    // Debt-to-income ratio
    const debtToIncome = income > 0 ? (totalMonthlyPayment / income) * 100 : 0;

    // Emergency fund (cash + savings)
    const emergencyFund = cashBalance + totalSavingsBalance;
    const monthsCovered = expense > 0 ? emergencyFund / expense : 0;

    // ========================================================================
    // 8. INSIGHTS & ALERTS
    // ========================================================================
    const insights = [];

    // Budget alerts
    if (overBudgetCount > 0) {
      insights.push({
        type: "warning",
        category: "budget",
        title: `${overBudgetCount} budget${overBudgetCount > 1 ? "s" : ""} exceeded`,
        message: `You're over budget in ${overBudgetCount} categor${overBudgetCount > 1 ? "ies" : "y"}. Review your spending.`,
      });
    }

    // Savings rate check
    if (income > 0) {
      if (savingsRate < 10) {
        insights.push({
          type: "warning",
          category: "savings",
          title: "Low savings rate",
          message: `Your savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20% of income.`,
        });
      } else if (savingsRate >= 30) {
        insights.push({
          type: "success",
          category: "savings",
          title: "Excellent savings rate!",
          message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep it up! 🎉`,
        });
      }
    }

    // Emergency fund check
    if (monthsCovered < 3) {
      insights.push({
        type: "alert",
        category: "emergency",
        title: "Build emergency fund",
        message: `Your emergency fund covers ${monthsCovered.toFixed(1)} months. Aim for 3-6 months of expenses.`,
      });
    } else if (monthsCovered >= 6) {
      insights.push({
        type: "success",
        category: "emergency",
        title: "Emergency fund solid!",
        message: `You have ${monthsCovered.toFixed(1)} months covered. Well done! 💪`,
      });
    }

    // Debt check
    if (totalDebtBalance > 0 && debtToIncome > 40) {
      insights.push({
        type: "alert",
        category: "debt",
        title: "High debt burden",
        message: `${debtToIncome.toFixed(1)}% of income goes to debt. Consider debt consolidation.`,
      });
    }

    // Positive cashflow
    if (income > 0 && expense < income) {
      insights.push({
        type: "info",
        category: "cashflow",
        title: "Positive cashflow",
        message: `You earned RM ${(income - expense).toLocaleString()} more than you spent this month.`,
      });
    } else if (expense > income) {
      insights.push({
        type: "warning",
        category: "cashflow",
        title: "Negative cashflow",
        message: `You spent RM ${(expense - income).toLocaleString()} more than you earned. Review expenses.`,
      });
    }

    // Debt-free celebration
    if (debts.length > 0 && totalDebtBalance === 0) {
      insights.push({
        type: "success",
        category: "debt",
        title: "🎉 Debt-free!",
        message: "Congratulations! You've paid off all your debts. Stay debt-free!",
      });
    }

    // ========================================================================
    // 9. RESPONSE
    // ========================================================================
    res.json({
      month: { year, month },
      
      // Core metrics
      totals: {
        income: parseFloat(income.toFixed(2)),
        expense: parseFloat(expense.toFixed(2)),
        cashflow: parseFloat((income - expense).toFixed(2)),
      },

      // Net worth
      netWorth: {
        total: parseFloat(netWorth.toFixed(2)),
        assets: parseFloat(totalAssets.toFixed(2)),
        debts: parseFloat(totalDebtBalance.toFixed(2)),
        breakdown: {
          cash: parseFloat(cashBalance.toFixed(2)),
          savings: parseFloat(totalSavingsBalance.toFixed(2)),
          investments: parseFloat(investmentBalance.toFixed(2)),
        },
      },

      // Budget
      budget: {
        total: parseFloat(totalBudget.toFixed(2)),
        spent: parseFloat(totalSpent.toFixed(2)),
        remaining: parseFloat((totalBudget - totalSpent).toFixed(2)),
        health: budgetHealth,
        alerts: {
          overBudget: overBudgetCount,
          warning: warningCount,
        },
      },

      // Savings
      savings: {
        totalBalance: parseFloat(totalSavingsBalance.toFixed(2)),
        monthlyDeposits: parseFloat(monthlyDeposits.toFixed(2)),
        totalDividends: parseFloat(totalSavingsDividends.toFixed(2)),
        roi: parseFloat(savingsROI.toFixed(2)),
        accounts: savingsSummary.slice(0, 5), // Top 5
      },

      // Debts
      debts: {
        totalBalance: parseFloat(totalDebtBalance.toFixed(2)),
        monthlyPayment: parseFloat(totalMonthlyPayment.toFixed(2)),
        interestPaid: parseFloat(totalInterestPaid.toFixed(2)),
        monthsToDebtFree,
        accounts: debtSummary.slice(0, 5), // Top 5
      },

      // Ratios
      ratios: {
        savingsRate: parseFloat(savingsRate.toFixed(1)),
        debtToIncome: parseFloat(debtToIncome.toFixed(1)),
        expenseToIncome: income > 0 ? parseFloat(((expense / income) * 100).toFixed(1)) : 0,
      },

      // Emergency fund
      emergencyFund: {
        amount: parseFloat(emergencyFund.toFixed(2)),
        monthsCovered: parseFloat(monthsCovered.toFixed(1)),
        target: parseFloat((expense * 6).toFixed(2)),
        progress: Math.min((monthsCovered / 6) * 100, 100),
      },

      // Expense breakdown
      expenseByCategory: expenseByCategory.slice(0, 8), // Top 8

      // Insights & alerts
      insights,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Failed to load dashboard data" });
  }
}