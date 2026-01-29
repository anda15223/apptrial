import express from "express";
import { parsePlandayHtml } from "./parsePlandayHtml";
import { db } from "./db";

const router = express.Router();

// Calibrated payroll uplift (holiday + ATP + overhead)
const PAYROLL_UPLIFT = 1.1574;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

// --------------------------------------------------
// IMPORT PAYROLL HTML
// --------------------------------------------------
router.post("/import", express.text({ type: "*/*" }), (req, res) => {
  const html = req.body;
  if (!html) {
    return res.status(400).json({ error: "No HTML body" });
  }

  const entries = parsePlandayHtml(html);

  const insert = db.prepare(`
    INSERT INTO labor_entries (employee, date, amount)
    VALUES (?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const e of entries) {
      insert.run(e.employee, e.date, e.amount);
    }
  });

  tx();

  res.json({
    status: "ok",
    entriesImported: entries.length,
  });
});

// --------------------------------------------------
// HELPERS
// --------------------------------------------------
function getLaborBetween(from: string, to: string) {
  const rows = db
    .prepare(
      `
      SELECT
        date,
        SUM(amount) AS baseCost
      FROM labor_entries
      WHERE date >= ? AND date <= ?
      GROUP BY date
    `
    )
    .all(from, to);

  let baseCost = 0;
  let laborCost = 0;

  for (const r of rows) {
    baseCost += Number(r.baseCost);
    laborCost += round2(Number(r.baseCost) * PAYROLL_UPLIFT);
  }

  return {
    baseCost: round2(baseCost),
    laborCost: round2(laborCost),
  };
}

// --------------------------------------------------
// DAILY
// --------------------------------------------------
router.get("/day", (req, res) => {
  const date = String(req.query.date || "");
  if (!date) return res.status(400).json({ error: "date required" });

  const result = getLaborBetween(date, date);

  res.json({
    date,
    upliftPct: 15.74,
    ...result,
  });
});

// --------------------------------------------------
// WEEK (Mon → Sun)
// --------------------------------------------------
router.get("/week", (req, res) => {
  const date = new Date(String(req.query.date || ""));
  if (isNaN(date.getTime()))
    return res.status(400).json({ error: "invalid date" });

  const day = date.getDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const from = monday.toISOString().slice(0, 10);
  const to = sunday.toISOString().slice(0, 10);

  const result = getLaborBetween(from, to);

  res.json({
    from,
    to,
    upliftPct: 15.74,
    ...result,
  });
});

// --------------------------------------------------
// MONTH
// --------------------------------------------------
router.get("/month", (req, res) => {
  const date = new Date(String(req.query.date || ""));
  if (isNaN(date.getTime()))
    return res.status(400).json({ error: "invalid date" });

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");

  const from = `${yyyy}-${mm}-01`;
  const to = `${yyyy}-${mm}-31`;

  const result = getLaborBetween(from, to);

  res.json({
    month: `${yyyy}-${mm}`,
    upliftPct: 15.74,
    ...result,
  });
});

export default router;
