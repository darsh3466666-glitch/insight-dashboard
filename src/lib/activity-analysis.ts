import type { Customer, Meta, StatusKey } from "./customer-model";

export type DormancyReasonKey =
  | "gradual_decline"
  | "sudden_stop"
  | "collection_issue"
  | "seasonal_missed"
  | "one_shot"
  | "unknown";

export const DORMANCY_REASON_LABEL: Record<DormancyReasonKey, string> = {
  gradual_decline: "تراجع تدريجي",
  sudden_stop: "توقف مفاجئ",
  collection_issue: "مشكلة تحصيل",
  seasonal_missed: "موسمي انقطع",
  one_shot: "عميل تجربة",
  unknown: "غير محدد",
};

export const DORMANCY_REASON_HINT: Record<DormancyReasonKey, string> = {
  gradual_decline: "المبيعات كانت بتقل شهر بعد شهر قبل ما يتوقف — غالباً منافس أو خدمة أضعف.",
  sudden_stop: "كان نشيط بشكل قوي ثم انقطع فجأة — احتمال شكوى، مشكلة تسليم، أو تحوّل لمورّد آخر.",
  collection_issue: "الرصيد المستحق كان بيتراكم ومعدل التحصيل ضعيف قبل التوقف — مشكلة سيولة أو خلاف مالي.",
  seasonal_missed: "كان بيشتري في شهور محددة كل سنة والسنة دي فوّت الموسم — يحتاج تذكير في نفس التوقيت.",
  one_shot: "عميل جرّب مرة واحدة لفترة قصيرة ولم يعد — تجربة أولى غير مقنعة.",
  unknown: "لا يوجد نمط واضح — يحتاج متابعة يدوية.",
};

export const DORMANCY_REASON_ACTION: Record<DormancyReasonKey, string> = {
  gradual_decline: "زيارة ميدانية وعرض مميز لاستعادة الحصة قبل الفقدان الكامل.",
  sudden_stop: "اتصال فوري لفهم سبب الانقطاع وحل أي شكوى.",
  collection_issue: "تسوية مالية أو خطة سداد قبل استئناف البيع.",
  seasonal_missed: "متابعة قبل بداية الموسم المعتاد بأسبوعين وعرض تجديد.",
  one_shot: "تواصل مع عرض تجربة/خصم أولي وطلب تقييم للتجربة السابقة.",
  unknown: "مكالمة استكشافية لمعرفة الوضع الحالي وسبب التوقف.",
};

export type PatternKey =
  | "regular"
  | "seasonal"
  | "volatile"
  | "short_trial"
  | "declining"
  | "recovering";

export const PATTERN_LABEL: Record<PatternKey, string> = {
  regular: "منتظم",
  seasonal: "موسمي",
  volatile: "متذبذب",
  short_trial: "تجربة قصيرة",
  declining: "متدهور",
  recovering: "متعافي",
};

const MONTHS_PER_YEAR = 12;

function flatMonthly(c: Customer, meta: Meta, upToYear?: number): number[] {
  const flat: number[] = [];
  const years = [...meta.years].sort((a, b) => a - b);
  for (const y of years) {
    if (upToYear !== undefined && y > upToYear) continue;
    const arr = c.sales[y] ?? new Array(MONTHS_PER_YEAR).fill(0);
    const pm = meta.partialMonths[y] ?? MONTHS_PER_YEAR;
    for (let m = 0; m < pm; m++) flat.push(arr[m] ?? 0);
  }
  return flat;
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) ** 2;
  }
  if (den === 0) return 0;
  const slope = num / den;
  return meanY > 0 ? slope / meanY : 0; // normalized
}

/** Classify overall customer purchasing pattern using all history. */
export function classifyPattern(c: Customer, meta: Meta): PatternKey {
  const flat = flatMonthly(c, meta);
  const activeMonths = flat.filter((v) => v > 0).length;
  const totalMonths = flat.length;
  if (activeMonths === 0) return "short_trial";
  if (activeMonths <= 3 && totalMonths >= 12) return "short_trial";

  // seasonality: check if the same month of year concentrates most purchases
  const monthTotals = new Array(12).fill(0);
  const monthCount = new Array(12).fill(0);
  const years = [...meta.years].sort((a, b) => a - b);
  for (const y of years) {
    const arr = c.sales[y] ?? [];
    const pm = meta.partialMonths[y] ?? MONTHS_PER_YEAR;
    for (let m = 0; m < pm; m++) {
      monthTotals[m] += arr[m] ?? 0;
      if ((arr[m] ?? 0) > 0) monthCount[m] += 1;
    }
  }
  const totalSales = monthTotals.reduce((a, b) => a + b, 0);
  const topMonths = [...monthTotals]
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  const topShare = totalSales > 0 ? topMonths.reduce((a, b) => a + b.v, 0) / totalSales : 0;
  if (topShare >= 0.7 && activeMonths >= 4 && activeMonths <= totalMonths * 0.5) {
    return "seasonal";
  }

  // trend on last 12 months vs prev 12
  const last12 = flat.slice(-12);
  const prev12 = flat.slice(-24, -12);
  const avgLast = last12.reduce((a, b) => a + b, 0) / Math.max(1, last12.length);
  const avgPrev = prev12.reduce((a, b) => a + b, 0) / Math.max(1, prev12.length);
  if (avgPrev > 0) {
    const ratio = avgLast / avgPrev;
    if (ratio >= 1.4 && avgLast > 0) return "recovering";
    if (ratio <= 0.5) return "declining";
  }

  // volatility: coefficient of variation on active months
  const activeVals = flat.filter((v) => v > 0);
  if (activeVals.length >= 4) {
    const mean = activeVals.reduce((a, b) => a + b, 0) / activeVals.length;
    const variance =
      activeVals.reduce((a, b) => a + (b - mean) ** 2, 0) / activeVals.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    if (cv > 1.2) return "volatile";
  }

  return "regular";
}

/** Determine the most likely dormancy reason for a customer as of end of `year`. */
export function dormancyReason(
  c: Customer,
  year: number,
  meta: Meta,
): { reason: DormancyReasonKey; explanation: string } {
  const flat = flatMonthly(c, meta, year);
  const activeMonths = flat.filter((v) => v > 0).length;
  const lastIdx = (() => {
    for (let i = flat.length - 1; i >= 0; i--) if (flat[i] > 0) return i;
    return -1;
  })();

  if (activeMonths === 0) {
    return { reason: "unknown", explanation: "لا توجد فواتير مسجّلة قبل السنة المختارة." };
  }

  // One-shot: <=3 active months and short window
  if (activeMonths <= 3 && lastIdx >= 0) {
    return {
      reason: "one_shot",
      explanation: `العميل اشترى في ${activeMonths} أشهر فقط عبر تاريخه ثم توقف.`,
    };
  }

  // Collection issue: cumulative collection rate below 60% and outstanding balance positive
  const salesTotal = Object.entries(c.salesByYear)
    .filter(([y]) => Number(y) <= year)
    .reduce((a, [, v]) => a + v, 0);
  const colTotal = Object.entries(c.collectionsByYear)
    .filter(([y]) => Number(y) <= year)
    .reduce((a, [, v]) => a + v, 0);
  const rate = salesTotal > 0 ? (colTotal / salesTotal) * 100 : 0;
  const balance = salesTotal - colTotal;

  // Seasonality check
  const monthTotals = new Array(12).fill(0);
  const monthCount = new Array(12).fill(0);
  const yrs = [...meta.years].sort((a, b) => a - b).filter((y) => y <= year);
  for (const y of yrs) {
    const arr = c.sales[y] ?? [];
    const pm = meta.partialMonths[y] ?? MONTHS_PER_YEAR;
    for (let m = 0; m < pm; m++) {
      monthTotals[m] += arr[m] ?? 0;
      if ((arr[m] ?? 0) > 0) monthCount[m] += 1;
    }
  }
  const totalSales = monthTotals.reduce((a, b) => a + b, 0);
  const topMonths = [...monthTotals]
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, 4);
  const topShare = totalSales > 0 ? topMonths.reduce((a, b) => a + b.v, 0) / totalSales : 0;
  const isSeasonal = topShare >= 0.7 && activeMonths <= yrs.length * 6;

  if (isSeasonal) {
    const topSet = new Set(topMonths.filter((x) => x.v > 0).map((x) => x.i));
    const currentYearArr = c.sales[year] ?? [];
    const pmY = meta.partialMonths[year] ?? MONTHS_PER_YEAR;
    let missedSeasonal = false;
    let hitSeasonal = false;
    for (let m = 0; m < pmY; m++) {
      if (topSet.has(m)) {
        if ((currentYearArr[m] ?? 0) > 0) hitSeasonal = true;
        else missedSeasonal = true;
      }
    }
    if (missedSeasonal && !hitSeasonal) {
      const names = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
      const list = [...topSet].sort((a, b) => a - b).map((i) => names[i]).join("، ");
      return {
        reason: "seasonal_missed",
        explanation: `العميل كان معتاد يشتري في: ${list}، والسنة دي فوّت المواسم المعتادة.`,
      };
    }
  }

  if (rate < 60 && balance > 0 && salesTotal > 0) {
    return {
      reason: "collection_issue",
      explanation: `نسبة التحصيل ${rate.toFixed(1)}% ورصيد مستحق ${Math.round(balance).toLocaleString("en-US")} ج.م قبل التوقف.`,
    };
  }

  // Trend analysis on last 12 active months
  const tail = flat.slice(-12);
  const half1 = tail.slice(0, 6);
  const half2 = tail.slice(6);
  const s1 = half1.reduce((a, b) => a + b, 0);
  const s2 = half2.reduce((a, b) => a + b, 0);
  const slope = linearSlope(tail);

  if (s1 > 0 && s2 === 0) {
    return {
      reason: "sudden_stop",
      explanation: "كان في مبيعات نشطة ثم انقطعت فجأة بدون تدهور تدريجي.",
    };
  }
  if (slope < -0.05 && s1 > s2 && s2 >= 0) {
    return {
      reason: "gradual_decline",
      explanation: "متوسط المبيعات الشهرية انخفض بشكل متواصل قبل التوقف.",
    };
  }

  return {
    reason: "unknown",
    explanation: "لا يوجد نمط واضح — يحتاج مراجعة تفصيلية.",
  };
}

export type CustomerActivity = {
  customer: Customer;
  currentStatus: StatusKey;
  prevStatus: StatusKey | null;
  isNewDormant: boolean;
  isRecovered: boolean;
  isContinuingDormant: boolean;
  pattern: PatternKey;
  reason: DormancyReasonKey;
  reasonExplanation: string;
  monthsSinceLastSale: number | null;
  lastSaleLabel: string;
  historicalSales: number;
  balance: number;
  collectionRate: number;
};

function statusOrInactive(c: Customer, year: number): StatusKey {
  return c.statusByYear[year] ?? "inactive";
}

function monthsSince(c: Customer, refYear: number, meta: Meta): number | null {
  if (!c.lastSale) return null;
  const refMonth = (meta.partialMonths[refYear] ?? MONTHS_PER_YEAR) - 1;
  const diff = (refYear - c.lastSale.year) * 12 + (refMonth - c.lastSale.month);
  return Math.max(0, diff);
}

export function buildCustomerActivity(
  customers: Customer[],
  year: number,
  meta: Meta,
): CustomerActivity[] {
  const rows: CustomerActivity[] = [];
  const hasPrev = meta.years.includes(year - 1);
  for (const c of customers) {
    // Only include customers that have any history up to this year
    const salesUpTo = Object.entries(c.salesByYear)
      .filter(([y]) => Number(y) <= year)
      .reduce((a, [, v]) => a + v, 0);
    if (salesUpTo <= 0) continue;

    const cur = statusOrInactive(c, year);
    const prev = hasPrev ? statusOrInactive(c, year - 1) : null;
    const isDormantCur = cur === "stagnant" || cur === "inactive";
    const isDormantPrev = prev === "stagnant" || prev === "inactive";
    const isNewDormant = isDormantCur && prev !== null && !isDormantPrev;
    const isRecovered = !isDormantCur && isDormantPrev;
    const isContinuingDormant = isDormantCur && isDormantPrev;

    const { reason, explanation } = dormancyReason(c, year, meta);
    const pattern = classifyPattern(c, meta);
    const colUpTo = Object.entries(c.collectionsByYear)
      .filter(([y]) => Number(y) <= year)
      .reduce((a, [, v]) => a + v, 0);
    const rate = salesUpTo > 0 ? (colUpTo / salesUpTo) * 100 : 0;

    rows.push({
      customer: c,
      currentStatus: cur,
      prevStatus: prev,
      isNewDormant,
      isRecovered,
      isContinuingDormant,
      pattern,
      reason,
      reasonExplanation: explanation,
      monthsSinceLastSale: monthsSince(c, year, meta),
      lastSaleLabel: c.lastSale
        ? `${["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"][c.lastSale.month]} ${c.lastSale.year}`
        : "—",
      historicalSales: salesUpTo,
      balance: salesUpTo - colUpTo,
      collectionRate: rate,
    });
  }
  return rows;
}

export type YearOverYearSummary = {
  year: number;
  prevYear: number | null;
  dormantCount: number;
  prevDormantCount: number;
  delta: number;
  deltaPct: number;
  newDormant: number;
  recovered: number;
  continuing: number;
  atRisk: number;
  reasonBreakdown: { reason: DormancyReasonKey; count: number; share: number }[];
};

export function yearOverYearSummary(
  rows: CustomerActivity[],
  year: number,
  meta: Meta,
): YearOverYearSummary {
  const hasPrev = meta.years.includes(year - 1);
  const dormantCount = rows.filter(
    (r) => r.currentStatus === "stagnant" || r.currentStatus === "inactive",
  ).length;
  const prevDormantCount = hasPrev
    ? rows.filter((r) => r.prevStatus === "stagnant" || r.prevStatus === "inactive").length
    : 0;
  const newDormant = rows.filter((r) => r.isNewDormant).length;
  const recovered = rows.filter((r) => r.isRecovered).length;
  const continuing = rows.filter((r) => r.isContinuingDormant).length;
  const atRisk = rows.filter((r) => r.currentStatus === "atrisk").length;

  const reasons: Record<DormancyReasonKey, number> = {
    gradual_decline: 0,
    sudden_stop: 0,
    collection_issue: 0,
    seasonal_missed: 0,
    one_shot: 0,
    unknown: 0,
  };
  const newDormantRows = rows.filter((r) => r.isNewDormant);
  for (const r of newDormantRows) reasons[r.reason]++;
  const total = newDormantRows.length;
  const reasonBreakdown = (Object.keys(reasons) as DormancyReasonKey[])
    .map((k) => ({
      reason: k,
      count: reasons[k],
      share: total > 0 ? (reasons[k] / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const delta = dormantCount - prevDormantCount;
  const deltaPct = prevDormantCount > 0 ? (delta / prevDormantCount) * 100 : 0;

  return {
    year,
    prevYear: hasPrev ? year - 1 : null,
    dormantCount,
    prevDormantCount,
    delta,
    deltaPct,
    newDormant,
    recovered,
    continuing,
    atRisk,
    reasonBreakdown,
  };
}
