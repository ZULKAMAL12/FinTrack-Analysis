import express from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/auth.js";
import {
  validateCreateAccount,
  validateUpdateAccount,
  validateCreateTransaction,
  validateCreateRule,
} from "../middleware/validateSavings.js";

import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../controllers/savingsAccountsController.js";

import {
  listTransactions,
  createTransaction,
  patchTransaction,
  deleteTransaction,
  bulkConfirmTransactions,
} from "../controllers/savingsTransactionsController.js";

import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  generateMissing,
} from "../controllers/savingsRecurringController.js";

import {
  exportTransactions,
  exportAccounts,
  exportYearlySummary,
} from "../controllers/savingsExportController.js";

import {
  getSmartAlerts,
  getDepositStats,
} from "../controllers/savingsStatsController.js";

const router = express.Router();

// ============================================================================
// Rate Limiters
// ============================================================================
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 creates per minute
  message: { message: "Too many create requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3, // 3 generates per minute
  message: { message: "Too many generation requests, please try again later." },
});

const exportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10, // 10 exports per minute
  message: { message: "Too many export requests, please try again later." },
});

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 stats/alerts requests per minute
  message: { message: "Too many stats requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================================
// Accounts
// ============================================================================
router.get("/accounts", requireAuth, listAccounts);
router.post(
  "/accounts",
  requireAuth,
  createLimiter,
  validateCreateAccount,
  createAccount,
);
router.put("/accounts/:id", requireAuth, validateUpdateAccount, updateAccount);
router.delete("/accounts/:id", requireAuth, deleteAccount);

// ============================================================================
// Transactions
// ============================================================================
router.get("/transactions", requireAuth, listTransactions);

// ⚠️ IMPORTANT: Bulk confirm MUST be before /:id routes
router.patch(
  "/transactions/bulk-confirm",
  requireAuth,
  bulkConfirmTransactions,
);

router.post(
  "/transactions",
  requireAuth,
  createLimiter,
  validateCreateTransaction,
  createTransaction,
);
router.patch("/transactions/:id", requireAuth, patchTransaction);
router.delete("/transactions/:id", requireAuth, deleteTransaction);

// ============================================================================
// Recurring Rules
// ============================================================================
router.get("/recurring-rules", requireAuth, listRules);
router.post(
  "/recurring-rules",
  requireAuth,
  createLimiter,
  validateCreateRule,
  createRule,
);
router.put("/recurring-rules/:id", requireAuth, validateCreateRule, updateRule);
router.delete("/recurring-rules/:id", requireAuth, deleteRule);
router.post(
  "/recurring-rules/generate-missing",
  requireAuth,
  generateLimiter,
  generateMissing,
);

// ============================================================================
// Stats & Alerts (Smart-Assist System) ⭐ NEW
// ============================================================================
router.get("/alerts", requireAuth, statsLimiter, getSmartAlerts);
router.get("/stats/deposits", requireAuth, statsLimiter, getDepositStats);

// ============================================================================
// Export
// ============================================================================
router.get(
  "/export/transactions",
  requireAuth,
  exportLimiter,
  exportTransactions,
);
router.get("/export/accounts", requireAuth, exportLimiter, exportAccounts);
router.get(
  "/export/yearly-summary",
  requireAuth,
  exportLimiter,
  exportYearlySummary,
);

export default router;