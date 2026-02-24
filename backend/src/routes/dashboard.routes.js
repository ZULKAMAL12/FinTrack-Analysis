import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getDashboard } from "../controllers/dashboard.controller.js";

const router = Router();

// All dashboard routes require authentication
router.use(requireAuth);

// GET /api/dashboard?year=2025&month=2
router.get("/", getDashboard);

export default router;