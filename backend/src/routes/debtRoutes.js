import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listDebts,
  getDebtAnalytics,
  createDebt,
  updateDebt,
  addPayment,
  deleteDebt,
  exportDebts,
  getUpcomingPayments,
  calculatePayoffScenarios,
  getDebtStrategy,
  getDebtFreeCountdown,
  getTotalInterest,
  getPaymentCalendar,
  calculateQuickImpact,
} from "../controllers/debtController.js";
import {
  validateCreateDebt,
  validateUpdateDebt,
  validateAddPayment,
} from "../middleware/validateDebt.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiters
const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: "Too many requests, please try again later",
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many export requests, please try again later",
});

// List debts
router.get("/", requireAuth, listDebts);

// Get analytics
router.get("/analytics", requireAuth, getDebtAnalytics);

// Get upcoming payments (next 30 days)
router.get("/upcoming", requireAuth, getUpcomingPayments);

// Get debt strategy recommendation
router.get("/strategy/recommendation", requireAuth, getDebtStrategy);

// NEW ENDPOINTS
// Get debt-free countdown
router.get("/countdown", requireAuth, getDebtFreeCountdown);

// Get total interest tracker
router.get("/total-interest", requireAuth, getTotalInterest);

// Get payment calendar (next 90 days)
router.get("/calendar", requireAuth, getPaymentCalendar);

// Calculate quick impact of extra payment
router.get("/quick-impact", requireAuth, calculateQuickImpact);

// Get payoff calculator for specific debt
router.get("/:id/payoff-calculator", requireAuth, calculatePayoffScenarios);

// Create debt
router.post("/", requireAuth, createLimiter, validateCreateDebt, createDebt);

// Update debt
router.put("/:id", requireAuth, validateUpdateDebt, updateDebt);

// Add payment
router.post("/:id/payment", requireAuth, validateAddPayment, addPayment);

// Delete debt
router.delete("/:id", requireAuth, deleteDebt);

// Export to CSV
router.get("/export/csv", requireAuth, exportLimiter, exportDebts);

export default router;