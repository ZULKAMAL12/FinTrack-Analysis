import express from "express";
import rateLimit from "express-rate-limit";

// Controllers
import {
  listAssets,
  getAsset,
  createAsset,
  updateAsset,
  deleteAsset,
} from "../controllers/investmentAssetsController.js";

import {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from "../controllers/investmentTransactionsController.js";

import {
  getPrices,
  refreshPrices,
} from "../controllers/investmentPricesController.js";

import {
  exportTransactions,
  exportAssets,
} from "../controllers/investmentExportController.js";

// Middleware
import { requireAuth } from "../middleware/auth.js"; // Assuming you have this
import {
  validateCreateAsset,
  validateUpdateAsset,
  validateCreateTransaction,
  validateUpdateTransaction,
  validateGetPrices,
} from "../middleware/validateInvestment.js";

const router = express.Router();

/* ----------------------------- Rate Limiters ----------------------------- */

// Standard rate limiter for creates
const createLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute
  message: { message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiter for price refreshes (API calls cost money)
const priceRefreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 refreshes per minute
  message: { message: "Too many price refresh requests. Please wait." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for exports
const exportLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 exports per minute
  message: { message: "Too many export requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ----------------------------- Asset Routes ------------------------------ */

// List all assets
router.get("/assets", requireAuth, listAssets);

// Get single asset
router.get("/assets/:id", requireAuth, getAsset);

// Create asset
router.post(
  "/assets",
  requireAuth,
  createLimiter,
  validateCreateAsset,
  createAsset,
);

// Update asset
router.put("/assets/:id", requireAuth, validateUpdateAsset, updateAsset);

// Delete asset (soft delete)
router.delete("/assets/:id", requireAuth, deleteAsset);

/* ------------------------- Transaction Routes ---------------------------- */

// List transactions
router.get("/transactions", requireAuth, listTransactions);

// Create transaction
router.post(
  "/transactions",
  requireAuth,
  createLimiter,
  validateCreateTransaction,
  createTransaction,
);

// Update transaction
router.patch(
  "/transactions/:id",
  requireAuth,
  validateUpdateTransaction,
  updateTransaction,
);

// Delete transaction
router.delete("/transactions/:id", requireAuth, deleteTransaction);

/* ----------------------------- Price Routes ------------------------------ */

// Get prices (cached)
router.post("/prices", requireAuth, validateGetPrices, getPrices);

// Refresh prices (force cache clear)
router.post(
  "/prices/refresh",
  requireAuth,
  priceRefreshLimiter,
  validateGetPrices,
  refreshPrices,
);

/* ----------------------------- Export Routes ----------------------------- */

// Export transactions as CSV
router.get(
  "/export/transactions",
  requireAuth,
  exportLimiter,
  exportTransactions,
);

// Export assets summary as CSV
router.get("/export/assets", requireAuth, exportLimiter, exportAssets);

export default router;
