import "dotenv/config";
import express from "express";
import cors from "cors";

import { dashboardRouter } from "./routes/dashboard";
import { inputsRouter } from "./routes/inputs";
import { kpisRouter } from "./routes/kpis";
import { posRouter } from "./routes/pos";
import { importRouter } from "./routes/import";
import { plandayRouter } from "./routes/planday";

import laborRoutes from "./labor/laborRoutes";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use("/api/dashboard", dashboardRouter);
app.use("/api/inputs", inputsRouter);
app.use("/api/kpis", kpisRouter);
app.use("/api/pos", posRouter);
app.use("/api/import", importRouter);
app.use("/api/planday", plandayRouter);

// ✅ NEW – Labor (isolated, safe)
app.use("/api/labor", laborRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Version endpoint
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
