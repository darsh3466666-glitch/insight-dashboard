import type { Customer } from "./customer-model";
import type { Meta } from "./customer-model";

export type Priority = "high" | "med" | "low";

export type StagnantRow = {
  c: Customer;
  lastSaleDate: Date;
  days: number;
  priority: Priority;
  historicalSales: number; // total sales up to reference
  balance: number; // outstanding balance up to reference (can be negative)
  collectionRate: number;
};

export type Scope =
  | { kind: "all" } // reference = today
  | { kind: "year"; year: number }; // reference = end of that year (based on meta partial months)

const MS_DAY = 1000 * 60 * 60 * 24;

export function getReferenceDate(scope: Scope, meta: Meta): Date {
  if (scope.kind === "all") return new Date();
  const y = scope.year;
  const pm = meta.partialMonths[y] ?? 12;
  // last day of last month with data — use end of month
  const monthIdx = Math.max(0, pm - 1);
  // end of that month
  return new Date(y, monthIdx + 1, 0, 23, 59, 59);
}

/** Approximate last-sale date as the LAST day of the month with last non-zero invoice.
 *  Conservative choice: any invoice within that month is treated as having occurred at
 *  month-end. This produces a lower-bound estimate of days-since-last-sale (avoids
 *  wrongly flagging a customer as stagnant when the actual invoice may have been late
 *  in that month). Source data is monthly-only so day-of-month is unknown. */
export function lastSaleDateOf(c: Customer): Date | null {
  if (!c.lastSale) return null;
  // Day 0 of next month = last day of current month
  return new Date(c.lastSale.year, c.lastSale.month + 1, 0, 23, 59, 59);
}

/** Sales/collections sums cumulative up to (and including) the reference year. */
export function cumulativeTotals(
  c: Customer,
  scope: Scope,
  meta: Meta,
): { sales: number; collections: number; balance: number; rate: number } {
  const upTo = scope.kind === "all" ? Math.max(...meta.years) : scope.year;
  let sales = 0;
  let collections = 0;
  for (const y of meta.years) {
    if (y > upTo) continue;
    sales += c.salesByYear[y] ?? 0;
    collections += c.collectionsByYear[y] ?? 0;
  }
  const balance = sales - collections;
  const rate = sales > 0 ? (collections / sales) * 100 : 0;
  return { sales, collections, balance, rate };
}

export function priorityOf(days: number): Priority {
  if (days <= 180) return "high";
  if (days <= 540) return "med";
  return "low";
}

/**
 * Build the stagnant customer list per project rules:
 *  - customer must have sales at all
 *  - days since last invoice must be >= 60
 *  - if lastSale is within 60 days of ref → excluded
 *  - priorities: high 60-180, med 181-540, low >540
 */
export function buildStagnantList(
  customers: Customer[],
  scope: Scope,
  meta: Meta,
): { rows: StagnantRow[]; refDate: Date } {
  const refDate = getReferenceDate(scope, meta);
  const rows: StagnantRow[] = [];
  for (const c of customers) {
    const totals = cumulativeTotals(c, scope, meta);
    if (totals.sales <= 0) continue;
    const last = lastSaleDateOf(c);
    if (!last) continue;
    // if last sale is after reference (future relative to scope), skip
    if (last.getTime() > refDate.getTime()) continue;
    const days = Math.floor((refDate.getTime() - last.getTime()) / MS_DAY);
    if (days < 60) continue; // must be >= 60
    rows.push({
      c,
      lastSaleDate: last,
      days,
      priority: priorityOf(days),
      historicalSales: totals.sales,
      balance: totals.balance,
      collectionRate: totals.rate,
    });
  }
  // sort by "value & urgency": higher historical sales first within priority, then fewer days
  const rank: Record<Priority, number> = { high: 0, med: 1, low: 2 };
  rows.sort((a, b) => {
    const p = rank[a.priority] - rank[b.priority];
    if (p !== 0) return p;
    return b.historicalSales - a.historicalSales;
  });
  return { rows, refDate };
}

export function priorityLabel(p: Priority): string {
  return p === "high" ? "أولوية عالية" : p === "med" ? "أولوية متوسطة" : "أولوية منخفضة";
}

export function priorityEmoji(p: Priority): string {
  return p === "high" ? "🔴" : p === "med" ? "🟡" : "⚪";
}

export function formatDays(days: number): string {
  if (days < 30) return `${days} يوم`;
  if (days < 365) {
    const months = Math.round(days / 30);
    return `${months} شهر (${days} يوم)`;
  }
  const years = Math.floor(days / 365);
  const remDays = days - years * 365;
  const months = Math.round(remDays / 30);
  return months > 0 ? `${years} سنة و${months} شهر` : `${years} سنة`;
}
