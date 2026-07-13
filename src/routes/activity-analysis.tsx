import { createFileRoute } from "@tanstack/react-router";
import { Fragment as FragmentWithKey, useMemo, useState } from "react";
import { Activity, Search, TrendingDown, TrendingUp, ArrowRight, X } from "lucide-react";
import { useCustomers, useDataStore } from "@/lib/store";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { fmtEGP, fmtInt, fmtPct, ARABIC_MONTHS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  buildCustomerActivity,
  yearOverYearSummary,
  DORMANCY_REASON_LABEL,
  DORMANCY_REASON_HINT,
  DORMANCY_REASON_ACTION,
  PATTERN_LABEL,
  type CustomerActivity,
  type DormancyReasonKey,
  type PatternKey,
} from "@/lib/activity-analysis";

export const Route = createFileRoute("/activity-analysis")({
  head: () => ({
    meta: [
      { title: "تحليل نشاط العملاء — منصّة المبيعات والمقبوضات" },
      {
        name: "description",
        content:
          "تحليل سنوي لأسباب تزايد العملاء الراكدين ونمط شراء كل عميل مع توصيات لتفادي الأنماط المُطفّشة.",
      },
    ],
  }),
  component: ActivityAnalysisPage,
});

const REASON_COLORS: Record<DormancyReasonKey, string> = {
  gradual_decline: "bg-amber-500",
  sudden_stop: "bg-red-500",
  collection_issue: "bg-orange-500",
  seasonal_missed: "bg-blue-500",
  one_shot: "bg-slate-500",
  unknown: "bg-zinc-400",
};

const PATTERN_COLORS: Record<PatternKey, string> = {
  regular: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  seasonal: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  volatile: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  short_trial: "bg-slate-500/15 text-slate-600 border-slate-500/30",
  declining: "bg-red-500/15 text-red-600 border-red-500/30",
  recovering: "bg-teal-500/15 text-teal-600 border-teal-500/30",
};

type Filter = "all" | "new_dormant" | "recovered" | "continuing" | "atrisk";

function ActivityAnalysisPage() {
  const customers = useCustomers();
  const meta = useDataStore((s) => s.meta);
  const years = useMemo(() => [...meta.years].sort((a, b) => b - a), [meta.years]);
  const [year, setYear] = useState<number>(meta.currentYear);
  const [filter, setFilter] = useState<Filter>("new_dormant");
  const [q, setQ] = useState("");
  const [reasonFilter, setReasonFilter] = useState<"all" | DormancyReasonKey>("all");
  const [colStatus, setColStatus] = useState<"all" | "active" | "atrisk" | "stagnant">("all");
  const [colPattern, setColPattern] = useState<"all" | PatternKey>("all");
  const [balanceFilter, setBalanceFilter] = useState<"all" | "positive" | "zero" | "negative">("all");
  const [selected, setSelected] = useState<CustomerActivity | null>(null);

  const rows = useMemo(
    () => buildCustomerActivity(customers, year, meta),
    [customers, year, meta],
  );
  const summary = useMemo(() => yearOverYearSummary(rows, year, meta), [rows, year, meta]);

  const filtered = useMemo(() => {
    let base = rows;
    switch (filter) {
      case "new_dormant":
        base = base.filter((r) => r.isNewDormant);
        break;
      case "recovered":
        base = base.filter((r) => r.isRecovered);
        break;
      case "continuing":
        base = base.filter((r) => r.isContinuingDormant);
        break;
      case "atrisk":
        base = base.filter((r) => r.currentStatus === "atrisk");
        break;
      default:
        break;
    }
    if (reasonFilter !== "all") base = base.filter((r) => r.reason === reasonFilter);
    if (colStatus !== "all") base = base.filter((r) => r.currentStatus === colStatus);
    if (colPattern !== "all") base = base.filter((r) => r.pattern === colPattern);
    if (balanceFilter !== "all") {
      base = base.filter((r) =>
        balanceFilter === "positive" ? r.balance > 0 : balanceFilter === "negative" ? r.balance < 0 : r.balance === 0,
      );
    }
    if (q) {
      base = base.filter(
        (r) => r.customer.name.includes(q) || r.customer.code.includes(q),
      );
    }
    return [...base].sort((a, b) => b.historicalSales - a.historicalSales);
  }, [rows, filter, reasonFilter, colStatus, colPattern, balanceFilter, q]);

  const topPatterns = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows.filter((x) => x.isNewDormant)) {
      counts[r.pattern] = (counts[r.pattern] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [rows]);

  const deltaPositive = summary.delta > 0;
  const deltaNegative = summary.delta < 0;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl md:text-3xl font-black text-foreground">
            <Activity className="h-6 w-6 text-primary" />
            تحليل نشاط العملاء
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            لماذا يتزايد الراكدون سنة بعد سنة؟ سبب كل عميل، ونمط شراءه، وتوصية عملية.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">السنة</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label={`راكدون في ${year}`}
          value={fmtInt(summary.dormantCount)}
          hint={summary.prevYear ? `${summary.prevYear}: ${fmtInt(summary.prevDormantCount)}` : "—"}
        />
        <KpiCard
          label="الفرق عن السنة السابقة"
          value={`${summary.delta > 0 ? "+" : ""}${fmtInt(summary.delta)}`}
          hint={summary.prevDormantCount > 0 ? fmtPct(summary.deltaPct) : "—"}
          tone={deltaPositive ? "destructive" : deltaNegative ? "success" : "muted"}
          icon={deltaPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        />
        <KpiCard
          label="راكدون جدد"
          value={fmtInt(summary.newDormant)}
          hint="كانوا نشطين → ركدوا"
          tone="destructive"
        />
        <KpiCard
          label="عادوا للشراء"
          value={fmtInt(summary.recovered)}
          hint="ركود → نشاط"
          tone="success"
        />
        <KpiCard
          label="على وشك الركود"
          value={fmtInt(summary.atRisk)}
          hint="متعثرون هذه السنة"
          tone="warning"
        />
      </div>

      {/* Root cause panel */}
      <Section title={`سبب زيادة الراكدين في ${year}`} description="توزيع الراكدين الجدد حسب النمط المكتشف">
        {summary.newDormant === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            لا يوجد راكدون جدد في هذه السنة — إمّا لا توجد بيانات سنة سابقة للمقارنة أو الوضع مستقر.
          </p>
        ) : (
          <div className="space-y-3 p-4">
            {summary.reasonBreakdown
              .filter((r) => r.count > 0)
              .map((r) => (
                <button
                  key={r.reason}
                  onClick={() =>
                    setReasonFilter(reasonFilter === r.reason ? "all" : r.reason)
                  }
                  className={cn(
                    "block w-full rounded-lg border p-3 text-right transition-all hover:border-primary/50",
                    reasonFilter === r.reason ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("h-3 w-3 rounded-full", REASON_COLORS[r.reason])} />
                      <span className="font-semibold">{DORMANCY_REASON_LABEL[r.reason]}</span>
                      <span className="text-sm text-muted-foreground">
                        ({fmtInt(r.count)} عميل — {fmtPct(r.share, 0)})
                      </span>
                    </div>
                  </div>
                  <div className="mb-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full", REASON_COLORS[r.reason])}
                      style={{ width: `${r.share}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {DORMANCY_REASON_HINT[r.reason]}
                  </p>
                </button>
              ))}
          </div>
        )}
      </Section>

      {/* Patterns pushing customers away */}
      {topPatterns.length > 0 && (
        <Section
          title="أنماط تُطفّش العملاء"
          description="أكثر الأنماط انتشارًا بين الراكدين الجدد"
        >
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {topPatterns.map(([pat, count]) => (
              <div key={pat} className="rounded-lg border border-border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                      PATTERN_COLORS[pat as PatternKey],
                    )}
                  >
                    {PATTERN_LABEL[pat as PatternKey]}
                  </span>
                  <span className="text-lg font-bold">{count}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {patternAdvice(pat as PatternKey)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              ["new_dormant", `راكدون جدد (${summary.newDormant})`],
              ["continuing", `مستمرون (${summary.continuing})`],
              ["recovered", `عادوا (${summary.recovered})`],
              ["atrisk", `متعثرون (${summary.atRisk})`],
              ["all", `الكل (${rows.length})`],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === k
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو الكود..."
            className="pr-9"
          />
        </div>
        {reasonFilter !== "all" && (
          <Button variant="outline" size="sm" onClick={() => setReasonFilter("all")}>
            إزالة فلتر: {DORMANCY_REASON_LABEL[reasonFilter]}
            <X className="mr-1 h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Customer table */}
      <Section
        title={`تفاصيل العملاء — ${filtered.length}`}
        description="اضغط على أي عميل لعرض التحليل الكامل"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs">
              <tr>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">آخر شراء</th>
                <th className="p-3 text-right">النمط</th>
                <th className="p-3 text-right">السبب</th>
                <th className="p-3 text-right">مبيعات تاريخية</th>
                <th className="p-3 text-right">الرصيد</th>
                <th className="p-3 text-right">تحصيل</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((r) => (
                <tr
                  key={r.customer.code}
                  className="cursor-pointer border-b border-border/60 hover:bg-muted/30"
                  onClick={() => setSelected(r)}
                >
                  <td className="p-3">
                    <div className="font-semibold">{r.customer.name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer.code}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={r.currentStatus} size="xs" />
                      {r.prevStatus && r.prevStatus !== r.currentStatus && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <ArrowRight className="h-3 w-3 rotate-180" />
                          <StatusBadge status={r.prevStatus} size="xs" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap text-xs">
                    <div>{r.lastSaleLabel}</div>
                    {r.monthsSinceLastSale !== null && (
                      <div className="text-muted-foreground">
                        منذ {fmtInt(r.monthsSinceLastSale)} شهر
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                        PATTERN_COLORS[r.pattern],
                      )}
                    >
                      {PATTERN_LABEL[r.pattern]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full", REASON_COLORS[r.reason])} />
                      <span className="text-xs font-semibold">
                        {DORMANCY_REASON_LABEL[r.reason]}
                      </span>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap">{fmtEGP(r.historicalSales)}</td>
                  <td
                    className={cn(
                      "p-3 whitespace-nowrap",
                      r.balance > 0 ? "text-red-600 font-semibold" : "",
                    )}
                  >
                    {fmtEGP(r.balance)}
                  </td>
                  <td className="p-3">{fmtPct(r.collectionRate, 0)}</td>
                  <td className="p-3">
                    <Button variant="ghost" size="sm">تفاصيل</Button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    لا يوجد عملاء يطابقون هذا الفلتر.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {filtered.length > 200 && (
            <div className="border-t border-border p-2 text-center text-xs text-muted-foreground">
              يعرض أول 200 من {filtered.length}. استخدم البحث أو الفلاتر للتضييق.
            </div>
          )}
        </div>
      </Section>

      {/* Drill-down sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto" dir="rtl">
          {selected && <CustomerDetail row={selected} year={year} meta={meta} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function patternAdvice(p: PatternKey): string {
  switch (p) {
    case "regular":
      return "عملاء منتظمون ركدوا — غالبًا مشكلة خدمة أو منافس. اتصال شخصي فوري.";
    case "seasonal":
      return "عملاء مواسم — تابعهم قبل بداية الموسم المعتاد بأسبوعين.";
    case "volatile":
      return "شراء متذبذب — يحتاج برنامج ولاء وحوافز على الطلب المنتظم.";
    case "short_trial":
      return "تجربة قصيرة لم تُقنعهم — اطلب تقييمًا واعرض تجربة محسّنة.";
    case "declining":
      return "تدهور تدريجي — تدخّل الآن قبل الفقدان الكامل بعرض قيمة مضافة.";
    case "recovering":
      return "بدأوا يرجعون — عزّز الاتجاه بمكافأة الاستمرار.";
  }
}

function CustomerDetail({
  row,
  year,
  meta,
}: {
  row: CustomerActivity;
  year: number;
  meta: import("@/lib/customer-model").Meta;
}) {
  const c = row.customer;
  const years = [...meta.years].sort((a, b) => a - b);
  const maxMonthly = useMemo(() => {
    let m = 0;
    for (const y of years) {
      const arr = c.sales[y] ?? [];
      for (const v of arr) if (v > m) m = v;
    }
    return m || 1;
  }, [c, years]);

  return (
    <>
      <SheetHeader>
        <SheetTitle className="text-right">{c.name}</SheetTitle>
        <SheetDescription className="text-right">
          كود {c.code} • تحليل تفصيلي لعام {year}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 space-y-5">
        {/* Reason box */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={cn("h-3 w-3 rounded-full", REASON_COLORS[row.reason])} />
            <span className="font-bold">{DORMANCY_REASON_LABEL[row.reason]}</span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                PATTERN_COLORS[row.pattern],
              )}
            >
              نمط: {PATTERN_LABEL[row.pattern]}
            </span>
          </div>
          <p className="text-sm">{row.reasonExplanation}</p>
          <div className="mt-3 rounded-md bg-primary/5 p-3 text-xs">
            <div className="mb-1 font-semibold text-primary">توصية عملية</div>
            {DORMANCY_REASON_ACTION[row.reason]}
          </div>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox label="الحالة الحالية" value={<StatusBadge status={row.currentStatus} />} />
          <StatBox
            label="الحالة السابقة"
            value={row.prevStatus ? <StatusBadge status={row.prevStatus} /> : <span className="text-muted-foreground">—</span>}
          />
          <StatBox label="آخر شراء" value={row.lastSaleLabel} />
          <StatBox
            label="منذ آخر شراء"
            value={row.monthsSinceLastSale !== null ? `${row.monthsSinceLastSale} شهر` : "—"}
          />
          <StatBox label="مبيعات تاريخية" value={fmtEGP(row.historicalSales)} />
          <StatBox
            label="رصيد مستحق"
            value={<span className={row.balance > 0 ? "text-red-600 font-semibold" : ""}>{fmtEGP(row.balance)}</span>}
          />
          <StatBox label="نسبة التحصيل" value={fmtPct(row.collectionRate, 1)} />
          <StatBox label="ABC" value={c.abc} />
        </div>

        {/* Warnings */}
        <div className="space-y-2">
          {row.balance > row.historicalSales * 0.4 && row.historicalSales > 0 && (
            <WarnLine text={`رصيد مستحق كبير (${fmtPct((row.balance / row.historicalSales) * 100, 0)} من المبيعات) — قد يكون سبب رئيسي في التوقف.`} />
          )}
          {row.collectionRate < 60 && row.historicalSales > 0 && (
            <WarnLine text={`نسبة تحصيل ضعيفة (${fmtPct(row.collectionRate, 0)}) — يحتاج تسوية مالية.`} />
          )}
          {row.monthsSinceLastSale !== null && row.monthsSinceLastSale > 18 && (
            <WarnLine text={`مضى أكثر من ${row.monthsSinceLastSale} شهر بدون فاتورة — احتمال فقدان دائم.`} />
          )}
        </div>

        {/* Timeline heatmap */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="font-semibold">جدول النشاط الشهري</div>
            <div className="text-[10px] text-muted-foreground">مبيعات كل شهر — الأغمق = أعلى</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="grid grid-cols-[auto_repeat(12,minmax(0,1fr))] gap-1 text-[10px]">
              <div></div>
              {ARABIC_MONTHS.map((m) => (
                <div key={m} className="text-center text-muted-foreground truncate">
                  {m.slice(0, 3)}
                </div>
              ))}
              {years.map((y) => {
                const arr = c.sales[y] ?? new Array(12).fill(0);
                const pm = meta.partialMonths[y] ?? 12;
                return (
                  <FragmentWithKey key={`row-${y}`}>
                    <div className="text-muted-foreground font-semibold pr-1">
                      {y}
                    </div>
                    {arr.map((v: number, mi: number) => {
                      const inScope = mi < pm;
                      const intensity = inScope ? v / maxMonthly : 0;
                      return (
                        <div
                          key={`${y}-${mi}`}
                          className={cn(
                            "aspect-square rounded-sm border",
                            inScope ? "border-border" : "border-transparent bg-muted/30",
                          )}
                          style={
                            inScope && v > 0
                              ? {
                                  backgroundColor: `color-mix(in oklch, var(--color-primary) ${
                                    20 + intensity * 80
                                  }%, transparent)`,
                                }
                              : undefined
                          }
                          title={inScope ? `${ARABIC_MONTHS[mi]} ${y}: ${fmtEGP(v)}` : ""}
                        />
                      );
                    })}
                  </FragmentWithKey>
                );
              })}
            </div>
          </div>
        </div>

        {/* Year totals */}
        <div>
          <div className="mb-2 font-semibold">إجماليات سنوية</div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-right">السنة</th>
                  <th className="p-2 text-right">مبيعات</th>
                  <th className="p-2 text-right">تحصيل</th>
                  <th className="p-2 text-right">نسبة</th>
                  <th className="p-2 text-right">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y) => (
                  <tr key={y} className="border-t border-border">
                    <td className="p-2 font-semibold">{y}</td>
                    <td className="p-2">{fmtEGP(c.salesByYear[y] ?? 0)}</td>
                    <td className="p-2">{fmtEGP(c.collectionsByYear[y] ?? 0)}</td>
                    <td className="p-2">{fmtPct(c.collectionRateByYear[y] ?? 0, 0)}</td>
                    <td className="p-2">
                      {c.statusByYear[y] ? <StatusBadge status={c.statusByYear[y]} size="xs" /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function WarnLine({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
      ⚠️ {text}
    </div>
  );
}
