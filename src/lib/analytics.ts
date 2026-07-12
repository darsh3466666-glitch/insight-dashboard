import type { Customer } from "./customer-model";
import { ARABIC_MONTHS } from "./format";

/** Sum monthly arrays element-wise. */
export function sumMonthly(arrays: number[][]): number[] {
  const out = Array<number>(12).fill(0);
  for (const a of arrays) for (let i = 0; i < 12; i++) out[i] += a[i] ?? 0;
  return out;
}

export type MonthPoint = { label: string; sales: number; collections: number; balance: number };

/** Monthly aggregate for a single year across all customers. */
export function monthlyAggregate(customers: Customer[], year: number): MonthPoint[] {
  const salesTotals = sumMonthly(customers.map((c) => c.sales[year] ?? Array(12).fill(0)));
  const colTotals = sumMonthly(customers.map((c) => c.collections[year] ?? Array(12).fill(0)));
  return ARABIC_MONTHS.map((label, i) => ({
    label,
    sales: salesTotals[i],
    collections: colTotals[i],
    balance: salesTotals[i] - colTotals[i],
  }));
}

/** Yearly totals across customers. */
export function yearlyTotals(customers: Customer[], years: number[]) {
  let cumulativeBalance = 0;
  return years.slice().sort().map((year) => {
    let sales = 0,
      collections = 0,
      activeCustomers = 0;
    for (const c of customers) {
      const s = c.salesByYear[year] ?? 0;
      const col = c.collectionsByYear[year] ?? 0;
      sales += s;
      collections += col;
      if (s > 0) activeCustomers++;
    }
    cumulativeBalance += sales - collections;
    return {
      year,
      sales,
      collections,
      balance: cumulativeBalance,
      collectionRate: sales > 0 ? (collections / sales) * 100 : 0,
      activeCustomers,
    };
  });
}

/** Compute Pareto (cumulative %) for the given metric selector. */
export function paretoData(
  customers: Customer[],
  metric: (c: Customer) => number,
  top = 20,
) {
  const filtered = customers.map((c) => ({ c, v: metric(c) })).filter((x) => x.v > 0);
  filtered.sort((a, b) => b.v - a.v);
  const total = filtered.reduce((a, b) => a + b.v, 0);
  let cum = 0;
  return filtered.slice(0, top).map((item, i) => {
    cum += item.v;
    return {
      rank: i + 1,
      name: item.c.name,
      code: item.c.code,
      value: item.v,
      cumulativePct: total > 0 ? (cum / total) * 100 : 0,
    };
  });
}

/** DSO (Days Sales Outstanding) — accounting-standard formula.
 *  DSO = (Outstanding Receivables / Sales in trailing period) × Days in period
 *  Uses CUMULATIVE open balance (Σ sales − Σ collections across all years ≤ selected year)
 *  divided by trailing-12-month sales, ×365. This correctly accounts for cross-year
 *  collections lag, unlike a same-year centroid comparison. */
export function estimateDSO(customers: Customer[], year: number, allYears?: number[]): number {
  const years = allYears ?? [year];
  // 1) cumulative open balance up to end of `year`
  let openBalance = 0;
  for (const c of customers) {
    for (const y of years) {
      if (y > year) continue;
      openBalance += (c.salesByYear[y] ?? 0) - (c.collectionsByYear[y] ?? 0);
    }
  }
  if (openBalance <= 0) return 0;

  // 2) trailing-12-month sales ending at last month with data in `year`
  const monthly = sumMonthly(customers.map((c) => c.sales[year] ?? Array(12).fill(0)));
  // last non-zero month of `year`, else 11
  let lastM = 11;
  for (let i = 11; i >= 0; i--) if (monthly[i] > 0) { lastM = i; break; }
  let trailingSales = 0;
  for (let i = 0; i <= lastM; i++) trailingSales += monthly[i];
  // fill remainder from previous year if less than 12 months of data used
  const need = 12 - (lastM + 1);
  if (need > 0 && years.includes(year - 1)) {
    const prev = sumMonthly(customers.map((c) => c.sales[year - 1] ?? Array(12).fill(0)));
    for (let i = 11; i >= 12 - need; i--) trailingSales += prev[i];
  }
  if (trailingSales <= 0) return 0;
  return Math.round((openBalance / trailingSales) * 365);
}

/** Aging buckets computed on CUMULATIVE open balance per customer.
 *  - Uses the customer's true open receivable (Σ sales − Σ collections across all years ≤ `year`).
 *  - Age = days between end of `year` (or today for current year) and customer's actual
 *    last invoice date, regardless of year. This avoids the previous double-counting bug
 *    where the same open balance was assigned to each year separately.
 *  - Customers with balance ≤ 0 (credit) are excluded from debt buckets. */
export function agingBuckets(
  customers: Customer[],
  year: number,
  currentMonthIdx: number,
  allYears?: number[],
) {
  const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  const years = allYears ?? [year];
  // reference date = end of currentMonthIdx of `year`
  const refDate = new Date(year, currentMonthIdx + 1, 0);
  for (const c of customers) {
    let bal = 0;
    for (const y of years) {
      if (y > year) continue;
      bal += (c.salesByYear[y] ?? 0) - (c.collectionsByYear[y] ?? 0);
    }
    if (bal <= 0) continue;
    let days: number;
    if (c.lastSale) {
      const lastDate = new Date(c.lastSale.year, c.lastSale.month + 1, 0);
      days = Math.max(0, Math.floor((refDate.getTime() - lastDate.getTime()) / 86400000));
    } else {
      days = 91; // no sale info → treat as very old
    }
    if (days <= 30) buckets["0-30"] += bal;
    else if (days <= 60) buckets["31-60"] += bal;
    else if (days <= 90) buckets["61-90"] += bal;
    else buckets["90+"] += bal;
  }
  return buckets;
}
