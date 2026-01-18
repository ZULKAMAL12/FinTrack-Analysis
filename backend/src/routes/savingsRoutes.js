import express from "express";
import * as authModule from "../middleware/auth.js";

import {
  listSavings,
  createSavingsAccount,
  updateSavingsAccount,
  addSavingsTransaction,
  deleteSavingsAccount,
} from "../controllers/savingsController.js";

const router = express.Router();

const auth =
  authModule.auth ||
  authModule.default ||
  authModule.protect ||
  authModule.requireAuth ||
  authModule.verifyToken;

if (!auth) {
  throw new Error(
    "Auth middleware not found. Export one of: default, auth, protect, requireAuth, verifyToken in middleware/auth.js"
  );
}

router.get("/", auth, listSavings);
router.post("/", auth, createSavingsAccount);
router.put("/:id", auth, updateSavingsAccount);
router.post("/:id/transactions", auth, addSavingsTransaction);
router.delete("/:id", auth, deleteSavingsAccount);

export default router;
