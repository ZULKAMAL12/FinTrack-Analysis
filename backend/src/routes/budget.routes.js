import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getBudget, upsertBudget } from "../controllers/budget.controller.js";

const router = Router();

router.use(requireAuth);
router.get("/", getBudget);
router.put("/", upsertBudget);

export default router;
