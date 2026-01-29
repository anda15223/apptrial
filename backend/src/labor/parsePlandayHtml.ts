import { db } from "./db";
import * as cheerio from "cheerio";

type ParsedShift = {
  employee: string;
  date: string; // YYYY-MM-DD
  from: string; // HH:MM
  to: string;   // HH:MM
  amount: number;
};

function normalizeDate(dkDate: string): string {
  // dd.MM.yyyy → yyyy-MM-dd
  const [dd, mm, yyyy] = dkDate.split(".");
  return `${yyyy}-${mm}-${dd}`;
}

export function parsePlandayHtml(html: string) {
  const $ = cheerio.load(html);

  // Ensure schedule table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS labor_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee TEXT NOT NULL,
      date TEXT NOT NULL,
      time_from TEXT NOT NULL,
      time_to TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_labor_schedule_date
      ON labor_schedule(date);
  `);

  const shifts: ParsedShift[] = [];

  $(".timesheetMasterRow").each((_, row) => {
    const cells = $(row).find("td");

    const dutyDateRaw = $(cells[1]).text().trim();
    const dutyPeriod = $(cells[2]).text().trim();
    const amountRaw = $(cells[6]).text().replace(/[^\d,]/g, "").replace(",", ".");

    if (!dutyDateRaw || !dutyPeriod) return;

    const [from, to] = dutyPeriod.split(" - ").map((s) => s.trim());
    if (!from || !to) return;

    const date = normalizeDate(dutyDateRaw);
    const amount = Number(amountRaw);

    // Employee name is inferred later via amount matching
    shifts.push({
      employee: "__UNKNOWN__",
      date,
      from,
      to,
      amount,
    });
  });

  // Clear existing schedule (idempotent import)
  db.prepare(`DELETE FROM labor_schedule`).run();

  // Map shifts to employees via labor_entries (amount matching)
  const stmtFindEmployee = db.prepare(`
    SELECT employee
    FROM labor_entries
    WHERE date = ?
      AND ABS(amount - ?) < 0.01
    LIMIT 1
  `);

  const stmtInsert = db.prepare(`
    INSERT INTO labor_schedule (employee, date, time_from, time_to)
    VALUES (?, ?, ?, ?)
  `);

  for (const s of shifts) {
    const row = stmtFindEmployee.get(s.date, s.amount) as
      | { employee: string }
      | undefined;

    if (!row) continue;

    stmtInsert.run(row.employee, s.date, s.from, s.to);
  }

  return {
    shiftsImported: shifts.length,
  };
}
