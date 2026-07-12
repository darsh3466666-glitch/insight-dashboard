import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCustomers, useDataStore } from "@/lib/store";
import { fmtCompact, fmtEGP, fmtInt, fmtPct, ARABIC_MONTHS } from "@/lib/format";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { agingBuckets, monthlyAggregate, paretoData, yearlyTotals } from "@/lib/analytics";
import { tooltipEGP, tooltipMulti } from "@/lib/recharts-format";
import { cn } from "@/lib/utils";
import { Wallet, TrendingDown, Percent, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { printHtml, escapeHtml } from "@/lib/print";

export const Route = createFileRoute("/collections")({
  head: () => ({
    meta: [
      { title: "تحليل المقبوضات — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "تحصيلات العملاء وأعمار الأرصدة." },
    ],
  }),
  component: CollectionsPage,
});

type YearSel = "all" | number;

function CollectionsPage() {
  const customers = useCustomers();
  const meta = useDataStore((s) => s.meta);
  const [year, setYear] = useState<YearSel>(meta.currentYear);

  const totals = useMemo(() => yearlyTotals(customers, meta.years), [customers, meta.years]);
  const monthly = useMemo(() => {
    if (year === "all") {
      return ARABIC_MONTHS.map((label, i) => {
        let sales = 0, collections = 0;
        for (const y of meta.years) for (const c of customers) {
          sales += c.sales[y]?.[i] ?? 0;
          collections += c.collections[y]?.[i] ?? 0;
        }
        return { label, sales, collections, balance: sales - collections };
      });
    }
    return monthlyAggregate(customers, year);
  }, [customers, meta.years, year]);

  const cur = year === "all"
    ? {
        sales: customers.reduce((a, c) => a + c.salesAll, 0),
        collections: customers.reduce((a, c) => a + c.collectionsAll, 0),
        balance: customers.reduce((a, c) => a + c.balanceAll, 0),
        collectionRate: (() => {
          const s = customers.reduce((a, c) => a + c.salesAll, 0);
          const co = customers.reduce((a, c) => a + c.collectionsAll, 0);
          return s > 0 ? (co / s) * 100 : 0;
        })(),
      }
    : (() => {
        return totals.find((t) => t.year === year) ?? { sales: 0, collections: 0, balance: 0, collectionRate: 0 };
      })();


  const partialMonths = year === "all" ? 12 : meta.partialMonths[year] ?? 12;
  const currentMonthIdx = Math.max(0, partialMonths - 1);
  const aging = useMemo(() => {
    if (year === "all") {
      const latestYear = meta.years[meta.years.length - 1];
      const latestMonth = Math.max(0, (meta.partialMonths[latestYear] ?? 12) - 1);
      return agingBuckets(customers, latestYear, latestMonth, meta.years);
    }
    return agingBuckets(customers, year, currentMonthIdx, meta.years);
  }, [customers, year, currentMonthIdx, meta.years, meta.partialMonths]);
  const totalDebt = Object.values(aging).reduce((a, b) => a + b, 0);

  /** Cumulative outstanding balance = Σ (sales - collections) across all years ≤ selected year.
   *  This reflects the true "مديونية" (open receivable), not the single-year swing. */
  const cumulativeBalance = (c: (typeof customers)[number]) => {
    if (year === "all") return c.balanceAll;
    let bal = 0;
    for (const y of meta.years) {
      if (y > (year as number)) continue;
      bal += (c.salesByYear[y] ?? 0) - (c.collectionsByYear[y] ?? 0);
    }
    return bal;
  };
  const cumulativeSales = (c: (typeof customers)[number]) => {
    if (year === "all") return c.salesAll;
    let s = 0;
    for (const y of meta.years) if (y <= (year as number)) s += c.salesByYear[y] ?? 0;
    return s;
  };
  const cumulativeCollections = (c: (typeof customers)[number]) => {
    if (year === "all") return c.collectionsAll;
    let s = 0;
    for (const y of meta.years) if (y <= (year as number)) s += c.collectionsByYear[y] ?? 0;
    return s;
  };
  const cumulativeRate = (c: (typeof customers)[number]) => {
    const s = cumulativeSales(c);
    return s > 0 ? (cumulativeCollections(c) / s) * 100 : 0;
  };

  const balFor = cumulativeBalance;
  const colFor = (c: (typeof customers)[number]) =>
    year === "all" ? c.collectionsAll : (c.collectionsByYear[year as number] ?? 0);
  const rateFor = cumulativeRate;

  // Year-scoped helpers: use ONLY the selected year's sales/collections.
  // In "all years" mode, fall back to cumulative totals across all years.
  const yearSalesOf = (c: (typeof customers)[number]) =>
    year === "all" ? c.salesAll : (c.salesByYear[year as number] ?? 0);
  const yearCollectionsOf = (c: (typeof customers)[number]) =>
    year === "all" ? c.collectionsAll : (c.collectionsByYear[year as number] ?? 0);
  const yearMovementOf = (c: (typeof customers)[number]) =>
    yearSalesOf(c) - yearCollectionsOf(c);
  const yearRateOf = (c: (typeof customers)[number]) => {
    const s = yearSalesOf(c);
    return s > 0 ? (yearCollectionsOf(c) / s) * 100 : 0;
  };
  void cumulativeSales;

  // (removed) "أعلى 15 مديون" section — dropped due to name-matching inaccuracy.



  // Best payers: SELECTED YEAR's sales & collections only.
  // Filter: year sales ≥ 100k AND 0 < rate ≤ 100% (excludes customers paying off old debts >100%).
  const bestPayers = useMemo(
    () =>
      customers
        .map((c) => ({ c, rate: yearRateOf(c), sales: yearSalesOf(c) }))
        .filter((r) => r.sales >= 100_000 && r.rate > 0 && r.rate <= 100)
        .sort((a, b) => (b.rate - a.rate) || (b.sales - a.sales))
        .slice(0, 10),
    [customers, year], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Pareto on collections
  const paretoCollections = useMemo(
    () => paretoData(customers, (c) => colFor(c), 15),
    [customers, year], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // (removed) 70%-of-debt Pareto section — dropped per user request.


  const label = year === "all" ? "كل السنوات" : String(year);

  function printPage() {
    const payerRows = bestPayers

      .map(
        (r, i) => `<tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(r.c.name)}<div class="muted">${escapeHtml(r.c.code)}</div></td>
          <td class="num">${fmtInt(r.sales)}</td>
          <td class="num">${fmtPct(r.rate)}</td>
        </tr>`,
      )
      .join("");
    const paretoRows = paretoCollections
      .map(
        (r) => `<tr>
          <td class="num">${r.rank}</td>
          <td>${escapeHtml(r.name)}</td>
          <td class="num">${fmtInt(r.value)}</td>
          <td class="num">${r.cumulativePct.toFixed(1)}%</td>
        </tr>`,
      )
      .join("");
    const html = `
      <div class="header">
        <div>
          <div class="brand">تقرير المقبوضات — ${label}</div>
          <div class="muted">إجمالي المقبوضات: ${fmtInt(cur.collections)} ج.م · نسبة التحصيل: ${fmtPct(cur.collectionRate)}</div>
        </div>
        <div class="muted">${new Date().toLocaleDateString("ar-EG")}</div>
      </div>
      <h2>Pareto — أعلى 15 عميل بالمقبوضات</h2>
      <table><thead><tr><th>#</th><th>العميل</th><th>المقبوضات</th><th>التراكمي %</th></tr></thead><tbody>${paretoRows}</tbody></table>
      <h2>أفضل الملتزمين — ${label}</h2>
      <table><thead><tr><th>#</th><th>العميل</th><th>مبيعات السنة</th><th>نسبة التحصيل</th></tr></thead><tbody>${payerRows}</tbody></table>
    `;
    printHtml(`تقرير المقبوضات — ${label}`, html, { orientation: "landscape" });
  }


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">تحليل المقبوضات</h1>
          <p className="mt-1 text-sm text-muted-foreground">نسب التحصيل، أعمار الأرصدة، تركّز الإيرادات، والمديونية.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
            {(["all", ...meta.years] as YearSel[]).map((y) => (
              <button
                key={String(y)}
                onClick={() => setYear(y)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold transition",
                  year === y ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {y === "all" ? "كل السنوات" : y}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={printPage}>
            <Printer className="ms-1 h-4 w-4" /> طباعة
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="إجمالي المقبوضات" value={fmtEGP(cur.collections)} icon={<Wallet className="h-5 w-5" />} tone="info" />
        <KpiCard
          label="نسبة التحصيل"
          value={fmtPct(cur.collectionRate)}
          icon={<Percent className="h-5 w-5" />}
          tone={cur.collectionRate >= 80 ? "success" : cur.collectionRate >= 60 ? "warning" : "destructive"}
        />
        <KpiCard
          label="الرصيد المستحق"
          value={fmtEGP(cur.balance)}
          icon={<TrendingDown className="h-5 w-5" />}
          tone={cur.balance > 0 ? "destructive" : "success"}
        />
        <KpiCard
          label="عدد العملاء بمقبوضات"
          value={fmtInt(customers.filter((c) => colFor(c) > 0).length)}
          tone="muted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="المقبوضات شهرياً" className="lg:col-span-2">
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={tooltipEGP}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Bar dataKey="collections" name="مقبوضات" fill="var(--color-status-active)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title="أعمار الأرصدة" description="تقريبي بناءً على آخر عملية بيع">
          <div className="space-y-3">
            {Object.entries(aging).map(([bucket, val]) => {
              const pct = totalDebt > 0 ? (val / totalDebt) * 100 : 0;
              const color =
                bucket === "0-30"
                  ? "var(--color-status-active)"
                  : bucket === "31-60"
                    ? "var(--color-info)"
                    : bucket === "61-90"
                      ? "var(--color-status-atrisk)"
                      : "var(--color-status-stagnant)";
              return (
                <div key={bucket}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">{bucket} يوم</span>
                    <span className="text-muted-foreground">
                      {fmtEGP(val)} ({fmtPct(pct)})
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
            <div className="mt-3 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">إجمالي الرصيد المدين</span>
                <span className="font-bold">{fmtEGP(totalDebt)}</span>
              </div>
            </div>
          </div>
        </Section>
      </div>

      <Section title={`تحليل باريتو — تمركز المقبوضات (80/20) · ${label}`}>
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <ComposedChart data={paretoCollections}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="rank" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                formatter={tooltipMulti((v, name) => (name === "المقبوضات" ? fmtEGP(v) : `${v.toFixed(1)}%`))}
                labelFormatter={(l) => paretoCollections[Number(l) - 1]?.name ?? ""}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" name="المقبوضات" dataKey="value" fill="var(--color-status-active)" radius={[6, 6, 0, 0]}>
                {paretoCollections.map((_p, i) => (
                  <Cell key={i} fill={i < 5 ? "var(--color-status-active)" : i < 10 ? "var(--color-info)" : "var(--color-primary)"} />
                ))}
              </Bar>
              <Line yAxisId="right" name="التراكمي %" type="monotone" dataKey="cumulativePct" stroke="var(--color-status-stagnant)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>




      <Section
        title={`أفضل 10 ملتزمين · ${label}`}
        description={`نسبة تحصيل ≤ 100% على مبيعات ≥ 100 ألف${year === "all" ? "" : ` في ${label}`}`}
      >
        <RankedTable
          columns={["الكود", "الاسم", "مبيعات السنة", "التحصيل %"]}
          rows={bestPayers.map((r) => [r.c.code, r.c.name, fmtEGP(r.sales), fmtPct(r.rate)])}
        />
      </Section>

    </div>
  );
}

function RankedTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  if (rows.length === 0) return <div className="py-6 text-center text-sm text-muted-foreground">لا توجد بيانات</div>;
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-2 py-2 text-right font-semibold">#</th>
            {columns.map((c) => (
              <th key={c} className="px-2 py-2 text-right font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/40">
              <td className="px-2 py-2 num text-xs text-muted-foreground">{i + 1}</td>
              {r.map((cell, j) => (
                <td key={j} className={cn("px-2 py-2", j === 1 ? "font-medium" : "num")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
