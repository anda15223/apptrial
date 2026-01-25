import "dotenv/config";
import express from "express";
import cors from "cors";

import { dashboardRouter } from "./routes/dashboard";
import { inputsRouter } from "./routes/inputs";
import { kpisRouter } from "./routes/kpis";
import { posRouter } from "./routes/pos";
import { importRouter } from "./routes/import";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/dashboard", dashboardRouter);
app.use("/api/inputs", inputsRouter);
app.use("/api/kpis", kpisRouter);
app.use("/api/pos", posRouter);
app.use("/api/import", importRouter);

// Simple health endpoint (so Render/Netlify can test it)
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Version endpoint (to verify production commit)
app.get("/api/version", (_req, res) => {
  res.json({
    ok: true,
    commitSha: process.env.RENDER_GIT_COMMIT || null,
    nodeEnv: process.env.NODE_ENV || null,
    serverTime: new Date().toISOString(),
  });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.listen(PORT, () => {
  console.log(`✅ Backend listening on port ${PORT}`);
});
