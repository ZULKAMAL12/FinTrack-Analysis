import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../controllers/account.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", listAccounts);
router.post("/", createAccount);
router.patch("/:id", updateAccount);
router.delete("/:id", deleteAccount);

export default router;
