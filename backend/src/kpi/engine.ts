import { DailyInput } from "../db/fileDb";
import {
  addYears,
  inRange,
  startOfMonthIso,
  startOfWeekIso,
  startOfYearIso,
} from "../utils/date";

export type KpiResult = {
  date: string;

  revenue: {
    today: number;
    week: number;
    month: number;
    year: number;
    lastYearSameDay: number;
  };

  wolt: {
    today: number;
    byDay: Array<{ date: string; revenue: number }>;
  };

  labor: {
    todayCost: number;
    laborPctToday: number | null;
  };

  cogs: {
    todayCost: number;
    cogsPctToday: number | null;
  };
};

// ✅ SALES RULE:
// Total Sales = POS (totalRevenue) + Wolt (woltRevenue)
function sumRevenue(inputs: DailyInput[], start: string, end: string): number {
  return inputs
    .filter((x) => inRange(x.date, start, end))
    .reduce(
      (acc, x) =>
        acc + (Number(x.totalRevenue) || 0) + (Number(x.woltRevenue) || 0),
      0
    );
}

export function computeKpis(all: DailyInput[], dateIso: string): KpiResult {
  const today = all.find((x) => x.date === dateIso);

  const weekStart = startOfWeekIso(dateIso);
  const monthStart = startOfMonthIso(dateIso);
  const yearStart = startOfYearIso(dateIso);

  // ✅ POS + Wolt = Total Sales
  const todayPos = Number(today?.totalRevenue ?? 0);
  const todayWolt = Number(today?.woltRevenue ?? 0);
  const todayRevenue = todayPos + todayWolt;

  const todayLabor = Number(today?.laborCost ?? 0);
  const todayCogs = Number(today?.bcGroceryCost ?? 0);

  const lastYearSameDay = all.find((x) => x.date === addYears(dateIso, -1));
  const lastYearSameDayPos = Number(lastYearSameDay?.totalRevenue ?? 0);
  const lastYearSameDayWolt = Number(lastYearSameDay?.woltRevenue ?? 0);
  const lastYearSameDayRevenue = lastYearSameDayPos + lastYearSameDayWolt;

  const weekRevenue = sumRevenue(all, weekStart, dateIso);
  const monthRevenue = sumRevenue(all, monthStart, dateIso);
  const yearRevenue = sumRevenue(all, yearStart, dateIso);

  const laborPctToday = todayRevenue > 0 ? todayLabor / todayRevenue : null;
  const cogsPctToday = todayRevenue > 0 ? todayCogs / todayRevenue : null;

  // Wolt history (last 7 days)
  const last7 = all
    .filter((x) => x.date <= dateIso)
    .slice(-7)
    .map((x) => ({
      date: x.date,
      revenue: Number(x.woltRevenue ?? 0),
    }));

  return {
    date: dateIso,
    revenue: {
      today: todayRevenue,
      week: weekRevenue,
      month: monthRevenue,
      year: yearRevenue,
      lastYearSameDay: lastYearSameDayRevenue,
    },
    wolt: {
      today: todayWolt,
      byDay: last7,
    },
    labor: {
      todayCost: todayLabor,
      laborPctToday,
    },
    cogs: {
      todayCost: todayCogs,
      cogsPctToday,
    },
  };
}
