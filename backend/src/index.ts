import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { dashboardRouter } from "./routes/dashboard";
import { inputsRouter } from "./routes/inputs";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/dashboard", dashboardRouter);

// ✅ THIS is the missing part that causes: "Cannot POST /api/inputs"
app.use("/api/inputs", inputsRouter);

const PORT = Number(process.env.PORT || 3001);

app.listen(PORT, () => {
  console.log(`[backend] listening on http://localhost:${PORT}`);
});
