import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";

// Account controllers
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../controllers/savingsAccountsController.js";

// Transaction controllers
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkConfirmTransactions,
} from "../controllers/savingsTransactionsController.js";

// Recurring rule controllers
import {
  listRules,
  createRule,
  updateRule,
  deleteRule,
  generateMissingTransactions, // ✅ Correct name
} from "../controllers/savingsRecurringController.js";

// Stats controllers
import {
  getAlerts,
  getDepositStats,
} from "../controllers/savingsStatsController.js";

// Export controllers
import {
  exportTransactions,
  exportAccounts,
  exportYearlySummary,
} from "../controllers/savingsExportController.js";

const router = Router();

// All routes require authentication
router.use(requireAuth);

// ========================
// ACCOUNT ROUTES
// ========================
router.get("/accounts", listAccounts);
router.post("/accounts", createAccount);
router.put("/accounts/:id", updateAccount);
router.delete("/accounts/:id", deleteAccount);

// ========================
// TRANSACTION ROUTES
// ========================
router.get("/transactions", listTransactions);
router.post("/transactions", createTransaction);
router.patch("/transactions/:id", updateTransaction);
router.delete("/transactions/:id", deleteTransaction);

// Bulk confirm
router.patch("/transactions/bulk-confirm", bulkConfirmTransactions);

// ========================
// RECURRING RULE ROUTES
// ========================
router.get("/recurring-rules", listRules);
router.post("/recurring-rules", createRule);
router.put("/recurring-rules/:id", updateRule);
router.delete("/recurring-rules/:id", deleteRule);

// Generate missing recurring transactions
router.post("/recurring-rules/generate-missing", generateMissingTransactions);

// ========================
// STATS ROUTES
// ========================
router.get("/alerts", getAlerts);
router.get("/stats/deposits", getDepositStats);

// ========================
// EXPORT ROUTES
// ========================
router.get("/export/transactions", exportTransactions);
router.get("/export/accounts", exportAccounts);
router.get("/export/yearly-summary", exportYearlySummary);

export default router;