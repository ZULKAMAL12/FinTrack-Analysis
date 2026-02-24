import express from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  exportExpenses,
  getSpendingInsights,
  getCategoryTrends,
  getQuickAlerts,
} from "../controllers/expenseController.js";
import {
  validateCreateExpense,
  validateUpdateExpense,
} from "../middleware/validateExpense.js";
import rateLimit from "express-rate-limit";

const router = express.Router();

// Rate limiters
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many requests, please try again later",
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: "Too many export requests, please try again later",
});

// List expenses with filters
router.get("/", requireAuth, listExpenses);

// Get summary (totals, comparison, breakdown)
router.get("/summary", requireAuth, getExpenseSummary);

// Get spending insights with budget integration
router.get("/insights", requireAuth, getSpendingInsights);

// Get category trends (last 6 months)
router.get("/trends", requireAuth, getCategoryTrends);

// Get quick alerts for budget overspending
router.get("/alerts", requireAuth, getQuickAlerts);

// Create expense
router.post("/", requireAuth, createLimiter, validateCreateExpense, createExpense);

// Update expense
router.put("/:id", requireAuth, validateUpdateExpense, updateExpense);

// Delete expense
router.delete("/:id", requireAuth, deleteExpense);

// Export to CSV
router.get("/export/csv", requireAuth, exportLimiter, exportExpenses);

export default router;