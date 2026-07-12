import type { SalesRow, CollectionRow } from "./parser";
import { nameKey as normalizeName, baseNameKey } from "./name-key";

export type StatusKey = "active" | "atrisk" | "stagnant" | "inactive";

export const STATUS_LABEL: Record<StatusKey, string> = {
  active: "نشط",
  atrisk: "متعثر",
  stagnant: "راكد",
  inactive: "لا يوجد نشاط",
};

export type Customer = {
  code: string;
  name: string;
  nameKey: string;
  sales: Record<number, number[]>;       // year -> 12 months
  collections: Record<number, number[]>; // year -> 12 months
  salesByYear: Record<number, number>;
  collectionsByYear: Record<number, number>;
  balanceByYear: Record<number, number>; // cumulative sales - collections through year
  salesAll: number;
  collectionsAll: number;
  balanceAll: number;
  collectionRateByYear: Record<number, number>; // % 0-100
  collectionRateAll: number;
  statusByYear: Record<number, StatusKey>;
  statusOverall: StatusKey;
  abc: "A" | "B" | "C"; // Pareto on latest available year
  lastSale: { year: number; month: number } | null;
  lastCollection: { year: number; month: number } | null;
  trendScore: number; // -100..+100
  years: number[];
};

export type Meta = {
  years: number[];
  currentYear: number;
  partialMonths: Record<number, number>; // year -> months with actual data (12 for closed)
};

const EMPTY = () => Array<number>(12).fill(0);

function findLastNonZero(monthly: number[]): number {
  for (let i = 11; i >= 0; i--) if (monthly[i] > 0) return i;
  return -1;
}

function actualMonthsFor(year: number, monthly: number[], meta: Meta): number {
  const partial = meta.partialMonths[year];
  if (partial && partial < 12) return partial;
  // find last non-zero as actual months lower bound; else 12 for closed year
  const last = findLastNonZero(monthly);
  return year === meta.currentYear ? Math.max(last + 1, partial ?? 0) : 12;
}

/**
 * 3-tier stagnation classification per year.
 * - inactive: zero across the year (or across all recorded activity range).
 * - stagnant: >=3 consecutive zero months at end, OR last-3-month avg < 30% of historical avg.
 * - atrisk:   last-3-month avg in [30%, 60%) of historical average.
 * - active:   otherwise (default).
 */
export function classifyYear(
  monthly: number[],
  historicalMonthlyAvg: number | null,
  actualMonths: number,
): StatusKey {
  const activeSlice = monthly.slice(0, Math.max(1, actualMonths));
  const sum = activeSlice.reduce((a, b) => a + b, 0);
  if (sum === 0) return "inactive";

  // consecutive zeros ending at actualMonths-1
  let zeros = 0;
  for (let i = actualMonths - 1; i >= 0; i--) {
    if (monthly[i] === 0) zeros++;
    else break;
  }
  if (zeros >= 3) return "stagnant";

  const lastN = Math.min(3, actualMonths);
  const last3 = activeSlice.slice(Math.max(0, actualMonths - 3));
  const last3Avg = last3.reduce((a, b) => a + b, 0) / lastN;

  if (historicalMonthlyAvg && historicalMonthlyAvg > 0) {
    const ratio = last3Avg / historicalMonthlyAvg;
    if (ratio < 0.3) return "stagnant";
    if (ratio < 0.7) return "atrisk";
  }

  return "active";
}

function historicalAvg(prevYearsMonthly: number[][], prevActualMonths: number[]): number | null {
  const totalMonths = prevActualMonths.reduce((a, b) => a + b, 0);
  if (totalMonths === 0) return null;
  const totalSum = prevYearsMonthly.reduce(
    (s, arr, i) => s + arr.slice(0, prevActualMonths[i]).reduce((a, b) => a + b, 0),
    0,
  );
  return totalSum / totalMonths;
}

function computeTrend(monthlyByYear: Record<number, number[]>, years: number[], meta: Meta): number {
  // compare last-6-months average vs preceding 6 months average (rolling across years)
  const flat: number[] = [];
  for (const y of years) {
    const arr = monthlyByYear[y] ?? EMPTY();
    const am = actualMonthsFor(y, arr, meta);
    for (let i = 0; i < am; i++) flat.push(arr[i]);
  }
  if (flat.length < 6) return 0;
  const last = flat.slice(-6);
  const prev = flat.slice(-12, -6);
  const la = last.reduce((a, b) => a + b, 0) / Math.max(1, last.length);
  const pa = prev.reduce((a, b) => a + b, 0) / Math.max(1, prev.length);
  if (pa === 0) return la > 0 ? 100 : 0;
  const pct = ((la - pa) / pa) * 100;
  return Math.max(-100, Math.min(100, Math.round(pct)));
}

/** Build unified customer map from sales + collections rows. */
export function buildCustomers(
  sales: SalesRow[],
  collections: CollectionRow[],
  meta: Meta,
  manualLinks?: Record<string, string>, // nameKey(collection) -> customer code
): Customer[] {
  // 1) group sales by code (source of truth for identity)
  const byCode = new Map<string, Customer>();
  for (const s of sales) {
    let c = byCode.get(s.code);
    if (!c) {
      const canonicalNameKey = normalizeName(s.name);
      c = {
        code: s.code,
        name: s.name,
        // Always rebuild the key from the raw name. Persisted/imported rows may
        // contain keys produced by an older normalization version.
        nameKey: canonicalNameKey,
        sales: {},
        collections: {},
        salesByYear: {},
        collectionsByYear: {},
        balanceByYear: {},
        salesAll: 0,
        collectionsAll: 0,
        balanceAll: 0,
        collectionRateByYear: {},
        collectionRateAll: 0,
        statusByYear: {},
        statusOverall: "inactive",
        abc: "C",
        lastSale: null,
        lastCollection: null,
        trendScore: 0,
        years: [],
      };
      byCode.set(s.code, c);
    }
    c.sales[s.year] = s.monthly.slice();
    c.salesByYear[s.year] = s.total;
    c.salesAll += s.total;
    const lastM = findLastNonZero(s.monthly);
    if (lastM >= 0) {
      if (!c.lastSale || s.year > c.lastSale.year || (s.year === c.lastSale.year && lastM > c.lastSale.month)) {
        c.lastSale = { year: s.year, month: lastM };
      }
    }
  }

  // 2) build lookups on customers (exact + base + tokens)
  const STOP = new Set([
    "شركه","شركة","مؤسسه","مؤسسة","مصنع","ورشه","ورشة","محل","معرض","مكتب","مركز",
    "الحاج","السيد","السيده","الست","الاستاذ","الأستاذ","المهندس","الدكتور","الشيخ",
    "و","او","the","and","co","company","for","of","al","el",
    "اولاد","أولاد","ابناء","أبناء","والاولاد","واولاده","واخوانه","واخوته",
  ]);
  const tokensOf = (name: string): string[] => {
    const bk = baseNameKey(name);
    return bk
      .split(/[\s\-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP.has(t));
  };

  const byNameKey = new Map<string, Customer>();
  const byBaseKey = new Map<string, Customer[]>();
  const custTokens = new Map<Customer, string[]>();
  for (const c of byCode.values()) {
    const key = normalizeName(c.name);
    c.nameKey = key;
    if (!byNameKey.has(key)) byNameKey.set(key, c);
    const bk = baseNameKey(c.name);
    if (bk && bk.length >= 3) {
      const arr = byBaseKey.get(bk) ?? [];
      arr.push(c);
      byBaseKey.set(bk, arr);
    }
    custTokens.set(c, tokensOf(c.name));
  }

  // scoring: max of Jaccard and containment(short-side); bonus for first-token equality
  const scoreTokens = (a: string[], b: string[]): number => {
    if (!a.length || !b.length) return 0;
    const sa = new Set(a);
    const sb = new Set(b);
    let inter = 0;
    for (const t of sa) if (sb.has(t)) inter++;
    if (inter === 0) return 0;
    const union = sa.size + sb.size - inter;
    const jaccard = inter / union;
    const shorter = Math.min(sa.size, sb.size);
    const containment = inter / shorter;
    const firstBonus = a[0] && b[0] && a[0] === b[0] ? 0.08 : 0;
    return Math.max(jaccard, containment * 0.92) + firstBonus;
  };

  // 3) attach collections
  const unmatched: CollectionRow[] = [];
  for (const col of collections) {
    const key = normalizeName(col.name);
    const bkCol = baseNameKey(col.name);
    let cust: Customer | undefined;

    // (a) manual link (indexed by exact or base key)
    if (manualLinks) {
      const linkedCode = manualLinks[key] ?? manualLinks[bkCol];
      if (linkedCode) cust = byCode.get(linkedCode);
    }
    // (b) exact nameKey match
    if (!cust) cust = byNameKey.get(key);
    // (c) base-key exact match (unique)
    if (!cust && bkCol && bkCol.length >= 3) {
      const arr = byBaseKey.get(bkCol);
      if (arr && arr.length === 1) cust = arr[0];
    }
    // (d) code prefix in the collection name (e.g. "1058 - اسم" or "1058/ اسم")
    if (!cust) {
      const codeMatch = col.name.match(/^\s*(\d{2,6})\b/);
      if (codeMatch) {
        const byC = byCode.get(codeMatch[1]);
        if (byC) cust = byC;
      }
    }
    // (e) token-based fuzzy match — pick unique best with clear margin
    if (!cust) {
      const colTokens = tokensOf(col.name);
      if (colTokens.length > 0) {
        let best: Customer | undefined;
        let bestScore = 0;
        let secondScore = 0;
        for (const c of byCode.values()) {
          const t = custTokens.get(c);
          if (!t || !t.length) continue;
          // quick prefilter: must share at least one token
          let shares = false;
          for (const tok of colTokens) if (t.includes(tok)) { shares = true; break; }
          if (!shares) continue;
          const s = scoreTokens(colTokens, t);
          if (s > bestScore) {
            secondScore = bestScore;
            bestScore = s;
            best = c;
          } else if (s > secondScore) {
            secondScore = s;
          }
        }
        // accept when strong AND clearly better than runner-up, OR near-perfect
        if (best && (bestScore >= 0.95 || (bestScore >= 0.6 && bestScore - secondScore >= 0.12))) {
          cust = best;
        }
      }
    }
    if (!cust) {
      unmatched.push(col);
      continue;
    }

    const yearCollections = cust.collections[col.year] ?? EMPTY();
    cust.collections[col.year] = yearCollections.map((value, month) => value + (col.monthly[month] ?? 0));
    cust.collectionsByYear[col.year] = (cust.collectionsByYear[col.year] ?? 0) + col.total;
    cust.collectionsAll += col.total;
    const lastM = findLastNonZero(col.monthly);
    if (lastM >= 0) {
      if (
        !cust.lastCollection ||
        col.year > cust.lastCollection.year ||
        (col.year === cust.lastCollection.year && lastM > cust.lastCollection.month)
      ) {
        cust.lastCollection = { year: col.year, month: lastM };
      }
    }
  }

  // 4) finalize computed fields
  const customers = Array.from(byCode.values());
  for (const c of customers) {
    c.years = Array.from(new Set([...Object.keys(c.sales), ...Object.keys(c.collections)].map(Number))).sort();
    let runningBalance = 0;
    for (const y of meta.years.slice().sort()) {
      const s = c.salesByYear[y] ?? 0;
      const col = c.collectionsByYear[y] ?? 0;
      runningBalance += s - col;
      c.balanceByYear[y] = runningBalance;
      c.collectionRateByYear[y] = s > 0 ? (col / s) * 100 : 0;
    }
    c.balanceAll = c.salesAll - c.collectionsAll;
    c.collectionRateAll = c.salesAll > 0 ? (c.collectionsAll / c.salesAll) * 100 : 0;

    // per-year status using previous years as history
    const sortedYears = meta.years.slice().sort();
    for (let i = 0; i < sortedYears.length; i++) {
      const y = sortedYears[i];
      const monthly = c.sales[y] ?? EMPTY();
      const am = actualMonthsFor(y, monthly, meta);
      const prevMonthly: number[][] = [];
      const prevAm: number[] = [];
      for (let j = 0; j < i; j++) {
        const py = sortedYears[j];
        prevMonthly.push(c.sales[py] ?? EMPTY());
        prevAm.push(actualMonthsFor(py, c.sales[py] ?? EMPTY(), meta));
      }
      const hist = historicalAvg(prevMonthly, prevAm);
      c.statusByYear[y] = classifyYear(monthly, hist, am);
    }

    // overall status: based on latest year with any activity
    const latestActive = [...sortedYears].reverse().find((y) => (c.salesByYear[y] ?? 0) > 0);
    if (latestActive) {
      // if last year was inactive but earlier years had activity → stagnant (churned)
      const latestYear = sortedYears[sortedYears.length - 1];
      if (latestActive !== latestYear) c.statusOverall = "stagnant";
      else c.statusOverall = c.statusByYear[latestYear];
    } else {
      c.statusOverall = "inactive";
    }

    c.trendScore = computeTrend(c.sales, sortedYears, meta);
  }

  // 5) ABC classification on latest year with sales (Pareto 80/15/5)
  const latestYear = meta.currentYear;
  const salesSorted = customers
    .map((c) => ({ c, v: c.salesByYear[latestYear] ?? 0 }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = salesSorted.reduce((a, b) => a + b.v, 0);
  let cum = 0;
  for (const item of salesSorted) {
    cum += item.v;
    const pct = total > 0 ? cum / total : 0;
    item.c.abc = pct <= 0.8 ? "A" : pct <= 0.95 ? "B" : "C";
  }

  // attach unmatched to a synthetic "شركة غير مطابقة" bucket? No — keep for reconciliation UI.
  (customers as Customer[] & { __unmatched?: CollectionRow[] }).__unmatched = unmatched;
  return customers;
}

export function getUnmatched(customers: Customer[]): CollectionRow[] {
  return (customers as Customer[] & { __unmatched?: CollectionRow[] }).__unmatched ?? [];
}
