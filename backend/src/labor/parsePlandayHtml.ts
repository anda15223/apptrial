import * as cheerio from "cheerio";

export type LaborEntry = {
  employee: string;
  date: string; // YYYY-MM-DD
  amount: number;
};

function toIsoDate(input: string): string | null {
  const m = input.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseDkk(input: string): number | null {
  let s = input.trim();
  s = s.replace(/kr\.?/gi, "");
  s = s.replace(/\./g, "");
  s = s.replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? null : n;
}

export function parsePlandayHtml(html: string): LaborEntry[] {
  const $ = cheerio.load(html);
  const entries: LaborEntry[] = [];

  $("table.personInformation").each((_, personTable) => {
    const employee = $(personTable)
      .find("td.label:contains('Name')")
      .next("td.value")
      .text()
      .trim();

    if (!employee) return;

    const paySlip = $(personTable)
      .nextAll("table.paySlip")
      .first();

    paySlip.find("tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 5) return;

      const dateText = $(cells[1]).text().trim();
      const amountText = $(cells[cells.length - 1]).text().trim();

      const date = toIsoDate(dateText);
      const amount = parseDkk(amountText);

      if (!date || amount === null) return;

      entries.push({
        employee,
        date,
        amount,
      });
    });
  });

  return entries;
}
