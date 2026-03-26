import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Expense from "../models/Expense.js";
import Account from "../models/Account.js";
import Budget from "../models/Budget.js";
import SavingsAccount from "../models/SavingsAccount.js";
import SavingsTransaction from "../models/SavingsTransaction.js";
import Debt from "../models/Debt.js";
import InvestmentAsset from "../models/InvestmentAsset.js";
import InvestmentTransaction from "../models/InvestmentTransaction.js";
import priceService from "../services/priceService.js";

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  return parseFloat(n.toFixed(2));
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
  const userObjId = new mongoose.Types.ObjectId(userId);

  try {
    // ========================================================================
    // 1. TRANSACTIONS (Income/Expense) — from BOTH models
    // ========================================================================
    const txRaw = await Transaction.find({ userId, year, month });

    const expRaw = await Expense.find({
      userId,
      year,
      month,
      deletedAt: null,
    });

    const allTx = [];

    for (const t of txRaw) {
      allTx.push({
        type: t.type,
        category: t.category,
        amount: safeNumber(t.amount),
        paymentMethod: "Other",
        day: t.date ? new Date(t.date).getDate() : 1,
        source: "transaction",
      });
    }

    for (const e of expRaw) {
      allTx.push({
        type: e.type.toLowerCase(),
        category: e.category,
        amount: safeNumber(e.amount),
        paymentMethod: e.paymentMethod || "Other",
        day: e.day || 1,
        source: "expense",
      });
    }

    const income = allTx
      .filter((t) => t.type === "income")
      .reduce((a, b) => a + b.amount, 0);

    const expense = allTx
      .filter((t) => t.type === "expense")
      .reduce((a, b) => a + b.amount, 0);

    // Expense by category
    const byCategory = {};
    for (const t of allTx.filter((t) => t.type === "expense")) {
      byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
    }

    const expenseByCategory = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);

    // Income by category
    const incByCategory = {};
    for (const t of allTx.filter((t) => t.type === "income")) {
      incByCategory[t.category] =
        (incByCategory[t.category] || 0) + t.amount;
    }

    const incomeByCategory = Object.entries(incByCategory)
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);

    // Payment method breakdown
    const byPaymentMethod = {};
    for (const t of allTx.filter((t) => t.type === "expense")) {
      byPaymentMethod[t.paymentMethod] =
        (byPaymentMethod[t.paymentMethod] || 0) + t.amount;
    }

    const paymentMethodBreakdown = Object.entries(byPaymentMethod)
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);

    // Recent transactions (last 10)
    const recentTx = allTx
      .sort((a, b) => b.day - a.day)
      .slice(0, 10)
      .map((t) => ({
        type: t.type,
        category: t.category,
        amount: round2(t.amount),
        paymentMethod: t.paymentMethod,
        day: t.day,
      }));

    // Daily spending
    const dailySpending = {};
    for (const t of allTx.filter((t) => t.type === "expense")) {
      dailySpending[t.day] = (dailySpending[t.day] || 0) + t.amount;
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailySpendingArray = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: round2(dailySpending[i + 1] || 0),
    }));

    // ========================================================================
    // 2. HISTORICAL TREND (Last 6 months)
    // ========================================================================
    const historicalMonths = [];
    for (let i = 5; i >= 0; i--) {
      let m = month - i;
      let y = year;
      while (m <= 0) {
        m += 12;
        y -= 1;
      }
      historicalMonths.push({ year: y, month: m });
    }

    const historicalData = [];
    let totalHistoricalExpense = 0;
    let monthsWithExpenses = 0;

    for (const hm of historicalMonths) {
      const htx = await Transaction.find({
        userId,
        year: hm.year,
        month: hm.month,
      });
      const hexp = await Expense.find({
        userId,
        year: hm.year,
        month: hm.month,
        deletedAt: null,
      });

      let hIncome = 0;
      let hExpense = 0;

      for (const t of htx) {
        if (t.type === "income") hIncome += safeNumber(t.amount);
        else hExpense += safeNumber(t.amount);
      }
      for (const e of hexp) {
        if (e.type.toLowerCase() === "income") hIncome += safeNumber(e.amount);
        else hExpense += safeNumber(e.amount);
      }

      if (hExpense > 0) {
        totalHistoricalExpense += hExpense;
        monthsWithExpenses++;
      }

      const label = new Date(hm.year, hm.month - 1).toLocaleString("en", {
        month: "short",
      });

      historicalData.push({
        label,
        year: hm.year,
        month: hm.month,
        income: round2(hIncome),
        expenses: round2(hExpense),
        cashflow: round2(hIncome - hExpense),
      });
    }

    const avgMonthlyExpense =
      monthsWithExpenses > 0
        ? totalHistoricalExpense / monthsWithExpenses
        : expense;

    // ========================================================================
    // 3. ACCOUNTS (Cash/Bank)
    // ========================================================================
    const accounts = await Account.find({ userId });

    const cashBalance = accounts
      .filter((a) => ["cash", "bank", "ewallet"].includes(a.type))
      .reduce((sum, a) => sum + safeNumber(a.openingBalance), 0);

    // ========================================================================
    // 4. BUDGETS
    // ========================================================================
    const budgetDocs = await Budget.find({ userId, year, month });

    let totalBudgetIncome = 0;
    let totalBudgetExpense = 0;
    let totalBudgetSpent = 0;
    const budgetHealth = [];
    const budgetSections = [];

    for (const doc of budgetDocs) {
      for (const section of doc.sections || []) {
        const sectionKind = section.kind || section.type || "expense";
        const sectionTotal = (section.items || []).reduce(
          (sum, item) => sum + safeNumber(item.amount),
          0
        );

        if (sectionKind === "income") {
          totalBudgetIncome += sectionTotal;
        } else {
          totalBudgetExpense += sectionTotal;
        }

        const itemsSummary = (section.items || []).map((item) => {
          const budgetAmount = safeNumber(item.amount);
          const spent = byCategory[item.label] || 0;
          const remaining = budgetAmount - spent;
          const percentage =
            budgetAmount > 0 ? (spent / budgetAmount) * 100 : 0;

          if (
            sectionKind === "expense" ||
            sectionKind === "saving" ||
            sectionKind === "debt"
          ) {
            totalBudgetSpent += spent;

            budgetHealth.push({
              category: item.label,
              section: section.name,
              budget: round2(budgetAmount),
              spent: round2(spent),
              remaining: round2(remaining),
              percentage: parseFloat(percentage.toFixed(1)),
              status:
                percentage >= 100
                  ? "over"
                  : percentage >= 80
                    ? "warning"
                    : "healthy",
            });
          }

          return {
            label: item.label,
            budget: round2(budgetAmount),
            spent: round2(spent),
            percentage: parseFloat(percentage.toFixed(1)),
          };
        });

        budgetSections.push({
          name: section.name,
          kind: sectionKind,
          total: round2(sectionTotal),
          items: itemsSummary,
        });
      }
    }

    budgetHealth.sort((a, b) => b.percentage - a.percentage);

    const overBudgetCount = budgetHealth.filter(
      (b) => b.status === "over"
    ).length;
    const warningCount = budgetHealth.filter(
      (b) => b.status === "warning"
    ).length;

    // ========================================================================
    // 5. SAVINGS
    // ========================================================================
    const savingsAccounts = await SavingsAccount.find({ userId });

    const savingsAgg = await SavingsTransaction.aggregate([
      { $match: { userId: userObjId, status: "completed" } },
      {
        $group: {
          _id: "$accountId",
          totalContributed: {
            $sum: {
              $cond: [{ $eq: ["$type", "capital_add"] }, "$amount", 0],
            },
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
    let totalSavingsWithdrawn = 0;

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
      totalSavingsWithdrawn += data.withdrawn;

      return {
        name: acc.name,
        balance: round2(balance),
        goal: safeNumber(acc.goal),
        progress:
          acc.goal > 0
            ? parseFloat(((balance / acc.goal) * 100).toFixed(1))
            : 0,
        ratePercent: safeNumber(acc.ratePercent),
        color: acc.color || "#0ea5e9",
        monthlyContribution: safeNumber(acc.monthlyContribution),
      };
    });

    const savingsROI =
      totalSavingsContributed > 0
        ? (totalSavingsDividends / totalSavingsContributed) * 100
        : 0;

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

    const dividendsThisMonth = await SavingsTransaction.find({
      userId,
      year,
      month,
      type: "dividend",
      status: "completed",
    });

    const monthlyDividends = dividendsThisMonth.reduce(
      (sum, t) => sum + safeNumber(t.amount),
      0
    );

    // ========================================================================
    // 6. DEBTS
    // ========================================================================
    const debts = await Debt.find({ userId, deletedAt: null });

    let totalDebtBalance = 0;
    let totalDebtOriginal = 0;
    let totalMonthlyPayment = 0;
    let totalInterestPaid = 0;
    let upcomingPayments = [];

    const debtSummary = [];

    for (const d of debts) {
      const remaining = safeNumber(d.currentBalance);
      const original = safeNumber(d.originalAmount);
      const paid = original - remaining;

      totalDebtBalance += remaining;
      totalDebtOriginal += original;
      totalMonthlyPayment += safeNumber(d.monthlyPayment);

      const totalPayments = (d.paymentHistory || []).reduce(
        (sum, p) => sum + safeNumber(p.amount),
        0
      );
      const principalPaid = original - remaining;
      const interestPaid = Math.max(totalPayments - principalPaid, 0);
      totalInterestPaid += interestPaid;

      if (d.nextPaymentDate) {
        const nextDate = new Date(d.nextPaymentDate);
        if (
          nextDate.getFullYear() === year &&
          nextDate.getMonth() + 1 === month
        ) {
          upcomingPayments.push({
            type: d.type || d.category,
            lender: d.lender,
            amount: safeNumber(d.monthlyPayment),
            dueDate: d.nextPaymentDate,
          });
        }
      }

      debtSummary.push({
        category: d.category || "Other",
        type: d.type || "Unknown",
        lender: d.lender || "N/A",
        originalAmount: round2(original),
        balance: round2(remaining),
        paid: round2(paid),
        monthlyPayment: safeNumber(d.monthlyPayment),
        interestRate: safeNumber(d.interestRate),
        progressPercent:
          original > 0
            ? parseFloat(((paid / original) * 100).toFixed(1))
            : 0,
        startDate: d.startDate,
        endDate: d.endDate,
        nextPaymentDate: d.nextPaymentDate,
      });
    }

    debtSummary.sort((a, b) => b.balance - a.balance);

    const debtByCategory = {};
    for (const d of debtSummary) {
      debtByCategory[d.category] =
        (debtByCategory[d.category] || 0) + d.balance;
    }

    const debtCategoryBreakdown = Object.entries(debtByCategory)
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);

    const monthsToDebtFree =
      totalMonthlyPayment > 0
        ? Math.ceil(totalDebtBalance / totalMonthlyPayment)
        : 0;

    const debtProgress =
      totalDebtOriginal > 0
        ? parseFloat(
            (
              ((totalDebtOriginal - totalDebtBalance) / totalDebtOriginal) *
              100
            ).toFixed(1)
          )
        : 0;

    // ========================================================================
    // 7. INVESTMENTS — LIVE PRICES + MYR CONVERSION
    // ========================================================================
    const investmentAssets = await InvestmentAsset.find({
      userId,
      deletedAt: null,
    });

    // ✅ Fetch LIVE prices from priceService
    const priceSymbols = investmentAssets.map((a) => ({
      symbol: a.symbol,
      type: a.type,
      exchange: a.exchange,
    }));

    let livePrices = {};
    if (priceSymbols.length > 0) {
      try {
        livePrices = await priceService.getBatchPrices(priceSymbols);
      } catch (priceErr) {
        console.error(
          "Dashboard: Failed to fetch live prices:",
          priceErr.message
        );
        // Continue with DB prices as fallback
      }
    }

    // Aggregate transactions per asset
    const investAgg = await InvestmentTransaction.aggregate([
      { $match: { userId: userObjId } },
      {
        $group: {
          _id: "$assetId",
          totalBought: {
            $sum: {
              $cond: [{ $eq: ["$type", "buy"] }, "$totalAmount", 0],
            },
          },
          totalSold: {
            $sum: {
              $cond: [{ $eq: ["$type", "sell"] }, "$totalAmount", 0],
            },
          },
          totalDividends: {
            $sum: {
              $cond: [{ $eq: ["$type", "dividend"] }, "$totalAmount", 0],
            },
          },
          totalUnitsBought: {
            $sum: {
              $cond: [{ $eq: ["$type", "buy"] }, "$units", 0],
            },
          },
          totalUnitsSold: {
            $sum: {
              $cond: [{ $eq: ["$type", "sell"] }, "$units", 0],
            },
          },
        },
      },
    ]);

    const investMap = {};
    for (const a of investAgg) {
      investMap[String(a._id)] = {
        totalBought: safeNumber(a.totalBought),
        totalSold: safeNumber(a.totalSold),
        totalDividends: safeNumber(a.totalDividends),
        totalUnitsBought: safeNumber(a.totalUnitsBought),
        totalUnitsSold: safeNumber(a.totalUnitsSold),
      };
    }

    let totalInvestedMYR = 0;
    let totalCurrentValueMYR = 0;
    let totalInvestDividends = 0;

    const investmentPortfolio = investmentAssets.map((asset) => {
      const data = investMap[String(asset._id)] || {
        totalBought: 0,
        totalSold: 0,
        totalDividends: 0,
        totalUnitsBought: 0,
        totalUnitsSold: 0,
      };

      const holdingUnits = data.totalUnitsBought - data.totalUnitsSold;
      const netInvested = data.totalBought - data.totalSold;

      // ✅ Live price from priceService, fallback to DB
      const priceData = livePrices[asset.symbol] || {};
      let currentPrice = priceData.price || safeNumber(asset.lastKnownPrice);
      const change24h = priceData.change24h || 0;

      // ✅ FX rate for MYR conversion (1 if already MYR)
      const fxRate =
        priceData.myrRate || (asset.currency === "MYR" ? 1 : 1);

      // Fallback: if no live price and no DB price, use avg buy price
      if (currentPrice === 0 && data.totalUnitsBought > 0) {
        currentPrice = data.totalBought / data.totalUnitsBought;
      }

      // ✅ Convert to MYR
      const marketValue = holdingUnits * currentPrice;
      const marketValueMYR = marketValue * fxRate;
      const investedMYR = netInvested * fxRate;
      const unrealizedPL_MYR = marketValueMYR - investedMYR;
      const plPercent =
        investedMYR > 0 ? (unrealizedPL_MYR / investedMYR) * 100 : 0;

      totalInvestedMYR += investedMYR;
      totalCurrentValueMYR += marketValueMYR;
      totalInvestDividends += data.totalDividends * fxRate;

      return {
        name: asset.name,
        symbol: asset.symbol,
        type: asset.type,
        currency: asset.currency,
        holdingUnits: parseFloat(holdingUnits.toFixed(6)),
        currentPrice: round2(currentPrice),
        fxRate: round2(fxRate),
        change24h: round2(change24h),
        totalInvestedMYR: round2(investedMYR),
        currentValueMYR: round2(marketValueMYR),
        unrealizedPL_MYR: round2(unrealizedPL_MYR),
        plPercent: parseFloat(plPercent.toFixed(2)),
        color: asset.color,
      };
    });

    const activePortfolio = investmentPortfolio.filter(
      (a) => a.holdingUnits > 0
    );

    // ✅ Top performers (sorted by P/L %)
    const topPerformers = [...activePortfolio]
      .sort((a, b) => b.plPercent - a.plPercent)
      .slice(0, 5);

    const investByType = {};
    for (const a of activePortfolio) {
      investByType[a.type] =
        (investByType[a.type] || 0) + a.currentValueMYR;
    }

    const investmentTypeBreakdown = Object.entries(investByType)
      .map(([name, value]) => ({ name, value: round2(value) }))
      .sort((a, b) => b.value - a.value);

    // Monthly investment activity
    const investTxThisMonth = await InvestmentTransaction.find({
      userId,
      year,
      month,
    });

    const monthlyInvestBuys = investTxThisMonth
      .filter((t) => t.type === "buy")
      .reduce((sum, t) => sum + safeNumber(t.totalAmount), 0);

    const monthlyInvestSells = investTxThisMonth
      .filter((t) => t.type === "sell")
      .reduce((sum, t) => sum + safeNumber(t.totalAmount), 0);

    const monthlyInvestDividends = investTxThisMonth
      .filter((t) => t.type === "dividend")
      .reduce((sum, t) => sum + safeNumber(t.totalAmount), 0);

    // ✅ Use MYR values for all investment metrics
    const totalPL_MYR = totalCurrentValueMYR - totalInvestedMYR;
    const investmentROI =
      totalInvestedMYR > 0 ? (totalPL_MYR / totalInvestedMYR) * 100 : 0;

    // ========================================================================
    // 8. NET WORTH & FINANCIAL HEALTH — all in MYR
    // ========================================================================

    // ✅ Investment value for net worth uses LIVE MYR value
    const investmentBalance = totalCurrentValueMYR;

    const totalAssets = cashBalance + totalSavingsBalance + investmentBalance;
    const netWorth = totalAssets - totalDebtBalance;

    const monthlySavings = income - expense;
    const savingsRate = income > 0 ? (monthlySavings / income) * 100 : 0;
    const debtToIncome =
      income > 0 ? (totalMonthlyPayment / income) * 100 : 0;
    const expenseToIncome = income > 0 ? (expense / income) * 100 : 0;

    // ========================================================================
    // EMERGENCY FUND — use avg monthly expense
    // ========================================================================
    const emergencyFund = cashBalance + totalSavingsBalance;

    const expenseForEmergency =
      expense > 0 ? expense : avgMonthlyExpense > 0 ? avgMonthlyExpense : 0;

    const monthsCovered =
      expenseForEmergency > 0 ? emergencyFund / expenseForEmergency : 0;

    const emergencyTarget =
      expenseForEmergency > 0 ? expenseForEmergency * 6 : 0;

    const emergencyProgress =
      emergencyTarget > 0
        ? parseFloat(
            Math.min((emergencyFund / emergencyTarget) * 100, 100).toFixed(1)
          )
        : emergencyFund > 0
          ? 100
          : 0;

    // ========================================================================
    // 9. FINANCIAL SCORE
    // ========================================================================
    let financialScore = 50;

    if (savingsRate >= 30) financialScore += 15;
    else if (savingsRate >= 20) financialScore += 12;
    else if (savingsRate >= 10) financialScore += 8;
    else if (savingsRate > 0) financialScore += 3;

    if (monthsCovered >= 6) financialScore += 15;
    else if (monthsCovered >= 3) financialScore += 10;
    else if (monthsCovered >= 1) financialScore += 5;

    if (totalDebtBalance === 0) financialScore += 10;
    else if (debtToIncome < 20) financialScore += 8;
    else if (debtToIncome < 35) financialScore += 4;

    if (budgetHealth.length > 0) {
      const healthyPercent =
        budgetHealth.filter((b) => b.status === "healthy").length /
        budgetHealth.length;
      financialScore += Math.round(healthyPercent * 10);
    }

    financialScore = Math.min(financialScore, 100);

    // ========================================================================
    // 10. INSIGHTS & ALERTS
    // ========================================================================
    const insights = [];

    if (overBudgetCount > 0) {
      insights.push({
        type: "warning",
        category: "budget",
        title: `${overBudgetCount} budget${overBudgetCount > 1 ? "s" : ""} exceeded`,
        message: `You're over budget in ${overBudgetCount} categor${overBudgetCount > 1 ? "ies" : "y"}. Review your spending.`,
      });
    }

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
          message: `You're saving ${savingsRate.toFixed(1)}% of your income. Keep it up!`,
        });
      }
    }

    if (monthsCovered < 3 && expenseForEmergency > 0) {
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
        message: `You have ${monthsCovered.toFixed(1)} months covered. Well done!`,
      });
    }

    if (totalDebtBalance > 0 && debtToIncome > 40) {
      insights.push({
        type: "alert",
        category: "debt",
        title: "High debt burden",
        message: `${debtToIncome.toFixed(1)}% of income goes to debt. Consider debt consolidation.`,
      });
    }

    if (income > 0 && expense < income) {
      insights.push({
        type: "info",
        category: "cashflow",
        title: "Positive cashflow",
        message: `You earned RM ${(income - expense).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more than you spent this month.`,
      });
    } else if (expense > income && income > 0) {
      insights.push({
        type: "warning",
        category: "cashflow",
        title: "Negative cashflow",
        message: `You spent RM ${(expense - income).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} more than you earned. Review expenses.`,
      });
    }

    if (debts.length > 0 && totalDebtBalance === 0) {
      insights.push({
        type: "success",
        category: "debt",
        title: "Debt-free!",
        message:
          "Congratulations! You've paid off all your debts. Stay debt-free!",
      });
    }

    if (activePortfolio.length > 0 && totalPL_MYR > 0) {
      insights.push({
        type: "success",
        category: "investment",
        title: "Portfolio in profit",
        message: `Your investments are up RM ${totalPL_MYR.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${investmentROI.toFixed(1)}% ROI).`,
      });
    } else if (activePortfolio.length > 0 && totalPL_MYR < 0) {
      insights.push({
        type: "info",
        category: "investment",
        title: "Portfolio unrealized loss",
        message: `Your investments are down RM ${Math.abs(totalPL_MYR).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Stay the course if long-term.`,
      });
    }

    if (upcomingPayments.length > 0) {
      insights.push({
        type: "info",
        category: "debt",
        title: `${upcomingPayments.length} payment${upcomingPayments.length > 1 ? "s" : ""} due this month`,
        message: `Total RM ${upcomingPayments.reduce((s, p) => s + p.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} in upcoming debt payments.`,
      });
    }

    // ========================================================================
    // 11. RESPONSE
    // ========================================================================
    res.json({
      month: { year, month },

      totals: {
        income: round2(income),
        expense: round2(expense),
        cashflow: round2(income - expense),
      },

      netWorth: {
        total: round2(netWorth),
        assets: round2(totalAssets),
        debts: round2(totalDebtBalance),
        breakdown: {
          cash: round2(cashBalance),
          savings: round2(totalSavingsBalance),
          investments: round2(investmentBalance),
        },
      },

      budget: {
        totalIncome: round2(totalBudgetIncome),
        totalExpense: round2(totalBudgetExpense),
        total: round2(totalBudgetExpense),
        spent: round2(totalBudgetSpent),
        remaining: round2(totalBudgetExpense - totalBudgetSpent),
        health: budgetHealth,
        sections: budgetSections,
        alerts: {
          overBudget: overBudgetCount,
          warning: warningCount,
        },
      },

      savings: {
        totalBalance: round2(totalSavingsBalance),
        totalContributed: round2(totalSavingsContributed),
        totalWithdrawn: round2(totalSavingsWithdrawn),
        monthlyDeposits: round2(monthlyDeposits),
        monthlyDividends: round2(monthlyDividends),
        totalDividends: round2(totalSavingsDividends),
        roi: round2(savingsROI),
        accounts: savingsSummary,
      },

      debts: {
        totalBalance: round2(totalDebtBalance),
        totalOriginal: round2(totalDebtOriginal),
        monthlyPayment: round2(totalMonthlyPayment),
        interestPaid: round2(totalInterestPaid),
        monthsToDebtFree,
        debtProgress,
        accounts: debtSummary,
        byCategory: debtCategoryBreakdown,
        upcomingPayments,
      },

      investments: {
        totalInvestedMYR: round2(totalInvestedMYR),
        currentValueMYR: round2(totalCurrentValueMYR),
        totalPL_MYR: round2(totalPL_MYR),
        roi: round2(investmentROI),
        totalDividendsMYR: round2(totalInvestDividends),
        monthlyBuys: round2(monthlyInvestBuys),
        monthlySells: round2(monthlyInvestSells),
        monthlyDividends: round2(monthlyInvestDividends),
        portfolio: activePortfolio,
        topPerformers,
        byType: investmentTypeBreakdown,
        assetCount: activePortfolio.length,
      },

      ratios: {
        savingsRate: round2(savingsRate),
        debtToIncome: round2(debtToIncome),
        expenseToIncome: round2(expenseToIncome),
      },

      emergencyFund: {
        amount: round2(emergencyFund),
        monthsCovered: parseFloat(monthsCovered.toFixed(1)),
        target: round2(emergencyTarget),
        progress: emergencyProgress,
        avgMonthlyExpense: round2(expenseForEmergency),
      },

      expenseByCategory: expenseByCategory.slice(0, 10),
      incomeByCategory: incomeByCategory.slice(0, 8),
      paymentMethodBreakdown,

      historicalData,
      dailySpending: dailySpendingArray,

      recentTransactions: recentTx,

      financialScore,

      insights,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    res.status(500).json({ message: "Failed to load dashboard data" });
  }
}