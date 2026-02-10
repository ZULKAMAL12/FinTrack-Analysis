import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes.js";
import accountRoutes from "./routes/account.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import budgetRoutes from "./routes/budget.routes.js";
import savingsRoutes from "./routes/savingsRoutes.js";
import investmentRoutes from "./routes/investmentRoutes.js";

import { notFound, errorHandler } from "./middleware/error.js";

function buildCorsOptions() {
  const raw = process.env.CORS_ORIGINS || "";
  const allowed = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    origin: (origin, cb) => {
      // allow tools like Postman / server-to-server
      if (!origin) return cb(null, true);

      if (allowed.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  };
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use(cors(buildCorsOptions()));

  app.use(rateLimit({ windowMs: 60 * 1000, limit: 200 }));

  app.get("/health", (_req, res) =>
    res.json({ ok: true, service: "FinTrack-Analysis API" }),
  );

  app.use("/api/auth", authRoutes);
  app.use("/api/accounts", accountRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/savings", savingsRoutes);
  app.use("/api/investments", investmentRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
