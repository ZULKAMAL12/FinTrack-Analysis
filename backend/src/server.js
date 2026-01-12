import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "FinTrack-Analysis API (placeholder)" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`API placeholder running on :${PORT}`));
