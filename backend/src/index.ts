import "dotenv/config";
import express from "express";
import cors from "cors";

import { dashboardRouter } from "./routes/dashboard";
import { inputsRouter } from "./routes/inputs";
import { kpisRouter } from "./routes/kpis";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/dashboard", dashboardRouter);
app.use("/api/inputs", inputsRouter);
app.use("/api/kpis", kpisRouter);

// Simple health endpoint (so Render/Netlify can test it)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`✅ Backend listening on port ${PORT}`);
});
