import Debt from "../models/Debt.js";
import logger from "../utils/logger.js";

/**
 * List all debts
 */
export async function listDebts(req, res) {
  const userId = req.user._id;

  try {
    const { category } = req.query;

    const query = { userId, deletedAt: null };

    if (category && category !== "All") {
      query.category = category;
    }

    const debts = await Debt.find(query).sort({ createdAt: -1 }).lean();

    res.json({ debts });
  } catch (error) {
    logger.error("List debts error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch debts",
    });
  }
}

/**
 * Get debt analytics
 */
export async function getDebtAnalytics(req, res) {
  const userId = req.user._id;

  try {
    const debts = await Debt.find({ userId, deletedAt: null }).lean();

    const totalOriginal = debts.reduce((sum, d) => sum + d.originalAmount, 0);
    const totalRemaining = debts.reduce((sum, d) => sum + d.currentBalance, 0);
    const totalMonthly = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const totalPaid = totalOriginal - totalRemaining;
    const overallProgress =
      totalOriginal > 0 ? ((totalPaid / totalOriginal) * 100).toFixed(2) : 0;

    // Distribution by category
    const categoryDistribution = debts.reduce((acc, debt) => {
      acc[debt.category] = (acc[debt.category] || 0) + debt.currentBalance;
      return acc;
    }, {});

    const pieData = Object.entries(categoryDistribution).map(([name, value]) => ({
      name,
      value,
    }));

    // Monthly breakdown
    const monthlyBreakdown = debts.map((d) => ({
      name: d.type,
      category: d.category,
      monthly: d.monthlyPayment,
    }));

    res.json({
      totals: {
        original: totalOriginal,
        remaining: totalRemaining,
        monthly: totalMonthly,
        paid: totalPaid,
        progress: overallProgress,
      },
      pieData,
      monthlyBreakdown,
    });
  } catch (error) {
    logger.error("Get debt analytics error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch analytics",
    });
  }
}

/**
 * Create debt
 */
export async function createDebt(req, res) {
  const userId = req.user._id;

  try {
    const {
      category,
      type,
      lender,
      originalAmount,
      currentBalance,
      monthlyPayment,
      interestRate,
      startDate,
      endDate,
      nextPaymentDate,
      notes,
    } = req.body;

    const debt = new Debt({
      userId,
      category,
      type,
      lender,
      originalAmount,
      currentBalance,
      monthlyPayment,
      interestRate,
      startDate,
      endDate,
      nextPaymentDate,
      notes: notes || "",
      paymentHistory: [],
    });

    await debt.save();

    logger.info("Debt created", {
      userId,
      debtId: debt._id,
      category,
      type,
      amount: originalAmount,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.status(201).json(debt);
  } catch (error) {
    logger.error("Create debt error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to create debt",
    });
  }
}

/**
 * Update debt
 */
export async function updateDebt(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const debt = await Debt.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }

    const {
      category,
      type,
      lender,
      originalAmount,
      currentBalance,
      monthlyPayment,
      interestRate,
      startDate,
      endDate,
      nextPaymentDate,
      notes,
    } = req.body;

    if (category) debt.category = category;
    if (type) debt.type = type;
    if (lender) debt.lender = lender;
    if (originalAmount !== undefined) debt.originalAmount = originalAmount;
    if (currentBalance !== undefined) debt.currentBalance = currentBalance;
    if (monthlyPayment !== undefined) debt.monthlyPayment = monthlyPayment;
    if (interestRate !== undefined) debt.interestRate = interestRate;
    if (startDate) debt.startDate = startDate;
    if (endDate) debt.endDate = endDate;
    if (nextPaymentDate) debt.nextPaymentDate = nextPaymentDate;
    if (notes !== undefined) debt.notes = notes;

    await debt.save();

    logger.info("Debt updated", {
      userId,
      debtId: debt._id,
      ip: req.ip,
    });

    res.json(debt);
  } catch (error) {
    logger.error("Update debt error:", {
      userId,
      debtId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to update debt",
    });
  }
}

/**
 * Add payment to debt
 */
export async function addPayment(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const { amount, date, note } = req.body;

    const debt = await Debt.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }

    // Add payment to history
    debt.paymentHistory.push({
      date: date || new Date(),
      amount,
      note: note || "",
    });

    // Reduce balance
    debt.currentBalance = Math.max(0, debt.currentBalance - amount);

    await debt.save();

    logger.info("Payment added to debt", {
      userId,
      debtId: debt._id,
      amount,
      newBalance: debt.currentBalance,
      ip: req.ip,
    });

    res.json(debt);
  } catch (error) {
    logger.error("Add payment error:", {
      userId,
      debtId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to add payment",
    });
  }
}

/**
 * Delete debt (soft delete)
 */
export async function deleteDebt(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const debt = await Debt.findOne({
      _id: id,
      userId,
      deletedAt: null,
    });

    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }

    debt.deletedAt = new Date();
    await debt.save();

    logger.info("Debt deleted", {
      userId,
      debtId: debt._id,
      category: debt.category,
      type: debt.type,
      ip: req.ip,
    });

    res.json({ message: "Debt deleted successfully" });
  } catch (error) {
    logger.error("Delete debt error:", {
      userId,
      debtId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to delete debt",
    });
  }
}

/**
 * Export debts to CSV
 */
export async function exportDebts(req, res) {
  const userId = req.user._id;

  try {
    const { category } = req.query;

    const query = { userId, deletedAt: null };

    if (category && category !== "All") {
      query.category = category;
    }

    const debts = await Debt.find(query).sort({ createdAt: -1 }).lean();

    if (debts.length === 0) {
      return res.status(404).json({ message: "No debts found" });
    }

    // CSV headers
    const headers = [
      "Category",
      "Type",
      "Lender",
      "Original Amount",
      "Current Balance",
      "Monthly Payment",
      "Interest Rate",
      "Start Date",
      "End Date",
      "Next Payment",
      "Progress %",
    ];

    const rows = debts.map((d) => {
      const progress =
        d.originalAmount > 0
          ? (((d.originalAmount - d.currentBalance) / d.originalAmount) * 100).toFixed(2)
          : 0;

      return [
        d.category,
        d.type,
        d.lender,
        d.originalAmount.toFixed(2),
        d.currentBalance.toFixed(2),
        d.monthlyPayment.toFixed(2),
        d.interestRate.toFixed(2),
        new Date(d.startDate).toISOString().split("T")[0],
        new Date(d.endDate).toISOString().split("T")[0],
        new Date(d.nextPaymentDate).toISOString().split("T")[0],
        progress,
      ];
    });

    // Build CSV
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${c}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="debts_${category || "all"}.csv"`
    );

    res.send(csv);

    logger.info("Debts exported", {
      userId,
      count: debts.length,
      category,
    });
  } catch (error) {
    logger.error("Export debts error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to export debts",
    });
  }
}

/**
 * Get upcoming payments (next 30 days)
 */
export async function getUpcomingPayments(req, res) {
  const userId = req.user._id;

  try {
    const today = new Date();
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(today.getDate() + 30);

    const debts = await Debt.find({
      userId,
      deletedAt: null,
      nextPaymentDate: {
        $gte: today,
        $lte: thirtyDaysLater,
      },
    })
      .sort({ nextPaymentDate: 1 })
      .lean();

    const upcomingPayments = debts.map((debt) => ({
      debtId: debt._id,
      type: debt.type,
      category: debt.category,
      lender: debt.lender,
      amount: debt.monthlyPayment,
      dueDate: debt.nextPaymentDate,
      daysUntil: Math.ceil(
        (new Date(debt.nextPaymentDate) - today) / (1000 * 60 * 60 * 24)
      ),
    }));

    res.json({ upcomingPayments });
  } catch (error) {
    logger.error("Get upcoming payments error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch upcoming payments",
    });
  }
}

/**
 * Calculate debt payoff scenarios
 */
export async function calculatePayoffScenarios(req, res) {
  const userId = req.user._id;
  const { id } = req.params;

  try {
    const debt = await Debt.findOne({
      _id: id,
      userId,
      deletedAt: null,
    }).lean();

    if (!debt) {
      return res.status(404).json({ message: "Debt not found" });
    }

    const balance = debt.currentBalance;
    const monthlyPayment = debt.monthlyPayment;
    const interestRate = debt.interestRate / 100 / 12; // Monthly interest rate

    // Scenario 1: Current payment
    const currentScenario = calculatePayoff(balance, monthlyPayment, interestRate);

    // Scenario 2: +RM100 extra
    const extra100Scenario = calculatePayoff(
      balance,
      monthlyPayment + 100,
      interestRate
    );

    // Scenario 3: +RM250 extra
    const extra250Scenario = calculatePayoff(
      balance,
      monthlyPayment + 250,
      interestRate
    );

    // Scenario 4: +RM500 extra
    const extra500Scenario = calculatePayoff(
      balance,
      monthlyPayment + 500,
      interestRate
    );

    res.json({
      debtId: debt._id,
      type: debt.type,
      currentBalance: balance,
      scenarios: [
        {
          label: "Current Payment",
          monthlyPayment,
          monthsToPayoff: currentScenario.months,
          totalInterest: currentScenario.totalInterest,
          totalPaid: currentScenario.totalPaid,
          debtFreeDate: currentScenario.debtFreeDate,
        },
        {
          label: "+RM100 Extra",
          monthlyPayment: monthlyPayment + 100,
          monthsToPayoff: extra100Scenario.months,
          totalInterest: extra100Scenario.totalInterest,
          totalPaid: extra100Scenario.totalPaid,
          debtFreeDate: extra100Scenario.debtFreeDate,
          savings: currentScenario.totalInterest - extra100Scenario.totalInterest,
          monthsSaved: currentScenario.months - extra100Scenario.months,
        },
        {
          label: "+RM250 Extra",
          monthlyPayment: monthlyPayment + 250,
          monthsToPayoff: extra250Scenario.months,
          totalInterest: extra250Scenario.totalInterest,
          totalPaid: extra250Scenario.totalPaid,
          debtFreeDate: extra250Scenario.debtFreeDate,
          savings: currentScenario.totalInterest - extra250Scenario.totalInterest,
          monthsSaved: currentScenario.months - extra250Scenario.months,
        },
        {
          label: "+RM500 Extra",
          monthlyPayment: monthlyPayment + 500,
          monthsToPayoff: extra500Scenario.months,
          totalInterest: extra500Scenario.totalInterest,
          totalPaid: extra500Scenario.totalPaid,
          debtFreeDate: extra500Scenario.debtFreeDate,
          savings: currentScenario.totalInterest - extra500Scenario.totalInterest,
          monthsSaved: currentScenario.months - extra500Scenario.months,
        },
      ],
    });
  } catch (error) {
    logger.error("Calculate payoff scenarios error:", {
      userId,
      debtId: id,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to calculate scenarios",
    });
  }
}

/**
 * Helper: Calculate payoff details
 */
function calculatePayoff(balance, monthlyPayment, monthlyInterestRate) {
  let remainingBalance = balance;
  let months = 0;
  let totalInterest = 0;
  const maxMonths = 600; // 50 years max

  while (remainingBalance > 0 && months < maxMonths) {
    const interestCharge = remainingBalance * monthlyInterestRate;
    const principalPayment = monthlyPayment - interestCharge;

    if (principalPayment <= 0) {
      // Payment doesn't cover interest
      return {
        months: maxMonths,
        totalInterest: balance * 2,
        totalPaid: balance * 3,
        debtFreeDate: "Never (payment too low)",
      };
    }

    totalInterest += interestCharge;
    remainingBalance -= principalPayment;
    months++;

    if (remainingBalance < 0) remainingBalance = 0;
  }

  const debtFreeDate = new Date();
  debtFreeDate.setMonth(debtFreeDate.getMonth() + months);

  return {
    months,
    totalInterest: parseFloat(totalInterest.toFixed(2)),
    totalPaid: parseFloat((balance + totalInterest).toFixed(2)),
    debtFreeDate: debtFreeDate.toLocaleDateString("en-MY", {
      year: "numeric",
      month: "short",
    }),
  };
}

/**
 * Get debt strategy recommendations
 */
export async function getDebtStrategy(req, res) {
  const userId = req.user._id;

  try {
    const debts = await Debt.find({ userId, deletedAt: null }).lean();

    if (debts.length === 0) {
      return res.json({ strategy: null });
    }

    // Snowball: Sort by balance (smallest first)
    const snowball = [...debts].sort(
      (a, b) => a.currentBalance - b.currentBalance
    );

    // Avalanche: Sort by interest rate (highest first)
    const avalanche = [...debts].sort(
      (a, b) => b.interestRate - a.interestRate
    );

    // Calculate total interest for each strategy
    let snowballInterest = 0;
    let avalancheInterest = 0;

    debts.forEach((debt) => {
      const monthlyRate = debt.interestRate / 100 / 12;
      const months = Math.ceil(
        debt.currentBalance / (debt.monthlyPayment || 100)
      );
      const interest = debt.currentBalance * monthlyRate * months;

      snowballInterest += interest;
      avalancheInterest += interest;
    });

    // Simplified recommendation
    const recommendedMethod =
      avalancheInterest < snowballInterest ? "avalanche" : "snowball";

    res.json({
      totalDebts: debts.length,
      snowball: {
        method: "Snowball (Smallest Balance First)",
        order: snowball.map((d) => ({
          type: d.type,
          balance: d.currentBalance,
          monthly: d.monthlyPayment,
          interest: d.interestRate,
        })),
        description:
          "Pay off smallest debt first for quick wins and motivation",
      },
      avalanche: {
        method: "Avalanche (Highest Interest First)",
        order: avalanche.map((d) => ({
          type: d.type,
          balance: d.currentBalance,
          monthly: d.monthlyPayment,
          interest: d.interestRate,
        })),
        description: "Pay off highest interest debt first to save the most money",
      },
      recommended: recommendedMethod,
    });
  } catch (error) {
    logger.error("Get debt strategy error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to calculate strategy",
    });
  }
}

/**
 * Get debt-free countdown
 */
export async function getDebtFreeCountdown(req, res) {
  const userId = req.user._id;

  try {
    const debts = await Debt.find({ userId, deletedAt: null }).lean();

    if (debts.length === 0) {
      return res.json({ debtFree: true, message: "You're debt-free! 🎉" });
    }

    // Calculate debt-free date for each debt
    const debtFreeDates = debts.map((debt) => {
      const balance = debt.currentBalance;
      const monthlyPayment = debt.monthlyPayment;
      const monthlyRate = debt.interestRate / 100 / 12;

      let remainingBalance = balance;
      let months = 0;
      const maxMonths = 600; // 50 years max

      while (remainingBalance > 0 && months < maxMonths) {
        const interestCharge = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestCharge;

        if (principalPayment <= 0) {
          return { debt: debt.type, date: null, neverPayoff: true };
        }

        remainingBalance -= principalPayment;
        months++;

        if (remainingBalance < 0) remainingBalance = 0;
      }

      const debtFreeDate = new Date();
      debtFreeDate.setMonth(debtFreeDate.getMonth() + months);

      return {
        debt: debt.type,
        date: debtFreeDate,
        months,
        neverPayoff: false,
      };
    });

    // Find the latest debt-free date (when ALL debts are paid)
    const validDates = debtFreeDates.filter((d) => !d.neverPayoff && d.date);

    if (validDates.length === 0) {
      return res.json({
        debtFree: false,
        message: "Some debts have payments too low to ever pay off",
      });
    }

    const latestDate = validDates.reduce((latest, current) => {
      return current.date > latest.date ? current : latest;
    });

    // Calculate countdown
    const now = new Date();
    const diffTime = latestDate.date - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    const days = diffDays % 30;

    res.json({
      debtFree: false,
      targetDate: latestDate.date,
      countdown: {
        years,
        months,
        days,
        totalDays: diffDays,
      },
      lastDebtCleared: latestDate.debt,
    });
  } catch (error) {
    logger.error("Get debt-free countdown error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to calculate countdown",
    });
  }
}

/**
 * Get total interest tracker (ACCURATE CALCULATION)
 * 
 * Calculates:
 * 1. Interest already paid (using payment history OR amortization reconstruction)
 * 2. Interest remaining (using loan amortization formula)
 * 3. Progress percentage
 * 4. Per-debt breakdown
 */
export async function getTotalInterest(req, res) {
  const userId = req.user._id;

  try {
    const debts = await Debt.find({ userId, deletedAt: null }).lean();

    if (debts.length === 0) {
      return res.json({
        totalPaid: 0,
        totalWillPay: 0,
        totalCost: 0,
        progress: 100,
        breakdown: [],
      });
    }

    let totalInterestPaid = 0;
    let totalInterestRemaining = 0;
    const breakdown = [];

    debts.forEach((debt) => {
      const originalAmount = debt.originalAmount;
      const currentBalance = debt.currentBalance;
      const monthlyPayment = debt.monthlyPayment;
      const monthlyRate = debt.interestRate / 100 / 12;
      const principalPaid = originalAmount - currentBalance;

      // ============================================================
      // STEP 1: Calculate Interest Already Paid
      // ============================================================
      let interestPaid = 0;

      if (debt.paymentHistory && debt.paymentHistory.length > 0) {
        // Method A: If we have payment history, use actual payments
        // Formula: Total Payments - Principal Paid = Interest Paid
        const totalPaymentsMade = debt.paymentHistory.reduce(
          (sum, p) => sum + p.amount,
          0
        );
        interestPaid = totalPaymentsMade - principalPaid;

        // Safety check: Interest can't be negative
        if (interestPaid < 0) interestPaid = 0;
      } else {
        // Method B: Reconstruct amortization schedule
        // Simulate payment-by-payment to calculate accurate interest
        let balance = originalAmount;
        let accumulatedInterest = 0;
        let months = 0;
        const maxMonths = 600;

        // Simulate payments until we reach current balance
        while (balance > currentBalance && months < maxMonths) {
          // Calculate this month's interest charge
          const interestCharge = balance * monthlyRate;
          
          // Calculate principal payment this month
          const principalPayment = Math.min(
            monthlyPayment - interestCharge,
            balance
          );

          // If payment doesn't cover interest, stop
          if (principalPayment <= 0) break;

          // Accumulate interest
          accumulatedInterest += interestCharge;
          
          // Reduce balance
          balance -= principalPayment;
          months++;

          // Stop when we reach current balance
          if (balance <= currentBalance) break;
        }

        interestPaid = accumulatedInterest;
      }

      // ============================================================
      // STEP 2: Calculate Remaining Interest (Future)
      // ============================================================
      let remainingBalance = currentBalance;
      let remainingInterest = 0;
      let months = 0;
      const maxMonths = 600;

      while (remainingBalance > 0.01 && months < maxMonths) {
        const interestCharge = remainingBalance * monthlyRate;
        const principalPayment = monthlyPayment - interestCharge;

        if (principalPayment <= 0) {
          // Payment doesn't cover interest - debt will never be paid off
          remainingInterest = currentBalance * 2; // Fallback estimate
          break;
        }

        remainingInterest += interestCharge;
        remainingBalance -= principalPayment;
        months++;

        if (remainingBalance < 0) remainingBalance = 0;
      }

      // ============================================================
      // STEP 3: Add to Totals and Breakdown
      // ============================================================
      totalInterestPaid += interestPaid;
      totalInterestRemaining += remainingInterest;

      breakdown.push({
        debtId: debt._id,
        type: debt.type,
        category: debt.category,
        interestPaid: parseFloat(interestPaid.toFixed(2)),
        interestRemaining: parseFloat(remainingInterest.toFixed(2)),
        totalInterest: parseFloat((interestPaid + remainingInterest).toFixed(2)),
        principalPaid,
        currentBalance,
        interestRate: debt.interestRate,
      });
    });

    // ============================================================
    // STEP 4: Calculate Overall Progress
    // ============================================================
    const totalCost = totalInterestPaid + totalInterestRemaining;
    const progress = totalCost > 0 ? (totalInterestPaid / totalCost) * 100 : 0;

    res.json({
      totalPaid: parseFloat(totalInterestPaid.toFixed(2)),
      totalWillPay: parseFloat(totalInterestRemaining.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      progress: parseFloat(progress.toFixed(1)),
      breakdown,
    });
  } catch (error) {
    logger.error("Get total interest error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to calculate interest",
    });
  }
}

/**
 * Get payment calendar (next 90 days)
 */
export async function getPaymentCalendar(req, res) {
  const userId = req.user._id;

  try {
    const debts = await Debt.find({ userId, deletedAt: null }).lean();

    if (debts.length === 0) {
      return res.json({ payments: [] });
    }

    const today = new Date();
    const ninetyDaysLater = new Date(today);
    ninetyDaysLater.setDate(today.getDate() + 90);

    const payments = [];

    debts.forEach((debt) => {
      let currentPaymentDate = new Date(debt.nextPaymentDate);

      // Generate up to 3 upcoming payments per debt
      for (let i = 0; i < 3; i++) {
        if (currentPaymentDate <= ninetyDaysLater) {
          const isOverdue = currentPaymentDate < today;
          const daysUntil = Math.ceil(
            (currentPaymentDate - today) / (1000 * 60 * 60 * 24)
          );

          payments.push({
            debtId: debt._id,
            debtType: debt.type,
            category: debt.category,
            lender: debt.lender,
            amount: debt.monthlyPayment,
            dueDate: currentPaymentDate,
            isOverdue,
            daysUntil,
            year: currentPaymentDate.getFullYear(),
            month: currentPaymentDate.getMonth() + 1,
            day: currentPaymentDate.getDate(),
          });

          // Move to next month
          currentPaymentDate = new Date(currentPaymentDate);
          currentPaymentDate.setMonth(currentPaymentDate.getMonth() + 1);
        } else {
          break;
        }
      }
    });

    // Sort by date
    payments.sort((a, b) => a.dueDate - b.dueDate);

    res.json({ payments });
  } catch (error) {
    logger.error("Get payment calendar error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to fetch calendar",
    });
  }
}

/**
 * Calculate quick impact of extra payment this month
 */
export async function calculateQuickImpact(req, res) {
  const userId = req.user._id;

  try {
    const { extraAmount } = req.query;
    const extra = parseFloat(extraAmount) || 0;

    if (extra <= 0) {
      return res.status(400).json({ message: "Extra amount must be positive" });
    }

    const debts = await Debt.find({ userId, deletedAt: null }).lean();

    if (debts.length === 0) {
      return res.json({ message: "No debts to calculate impact" });
    }

    // Calculate current scenario (no extra payment)
    let totalCurrentInterest = 0;
    let totalCurrentMonths = 0;

    debts.forEach((debt) => {
      const result = calculatePayoff(
        debt.currentBalance,
        debt.monthlyPayment,
        debt.interestRate / 100 / 12
      );
      totalCurrentInterest += result.totalInterest;
      totalCurrentMonths = Math.max(totalCurrentMonths, result.months);
    });

    // Strategy: Apply extra to highest interest debt first (Avalanche)
    const sortedDebts = [...debts].sort((a, b) => b.interestRate - a.interestRate);

    let totalWithExtraInterest = 0;
    let totalWithExtraMonths = 0;

    sortedDebts.forEach((debt, index) => {
      // Apply extra payment to highest interest debt
      const extraForThisDebt = index === 0 ? extra : 0;
      const newMonthly = debt.monthlyPayment + extraForThisDebt;

      const result = calculatePayoff(
        debt.currentBalance,
        newMonthly,
        debt.interestRate / 100 / 12
      );
      totalWithExtraInterest += result.totalInterest;
      totalWithExtraMonths = Math.max(totalWithExtraMonths, result.months);
    });

    const interestSaved = totalCurrentInterest - totalWithExtraInterest;
    const monthsSaved = totalCurrentMonths - totalWithExtraMonths;

    res.json({
      extraAmount: extra,
      appliedTo: sortedDebts[0].type,
      interestSaved: parseFloat(interestSaved.toFixed(2)),
      monthsSaved,
      yearsSaved: parseFloat((monthsSaved / 12).toFixed(1)),
      currentTotalInterest: parseFloat(totalCurrentInterest.toFixed(2)),
      newTotalInterest: parseFloat(totalWithExtraInterest.toFixed(2)),
    });
  } catch (error) {
    logger.error("Calculate quick impact error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to calculate impact",
    });
  }
}