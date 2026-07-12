import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useCustomers, useDataStore } from "@/lib/store";
import { fmtCompact, fmtEGP, fmtInt, fmtPct } from "@/lib/format";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { monthlyAggregate, yearlyTotals } from "@/lib/analytics";
import { tooltipEGP } from "@/lib/recharts-format";
import { ARABIC_MONTHS } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "تحليل المبيعات — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "تحليل مبيعات العملاء شهرياً وسنوياً مع تصنيف ABC." },
    ],
  }),
  component: SalesPage,
});

type YearSel = "all" | number;

function SalesPage() {
  const customers = useCustomers();
  const meta = useDataStore((s) => s.meta);
  const [year, setYear] = useState<YearSel>(meta.currentYear);
  const [q, setQ] = useState("");
  const [abc, setAbc] = useState<"all" | "A" | "B" | "C">("all");
  const [status, setStatus] = useState<"all" | "active" | "atrisk" | "stagnant">("all");
  const [page, setPage] = useState(1);
  const perPage = 15;

  const totals = useMemo(() => yearlyTotals(customers, meta.years), [customers, meta.years]);
  const monthly = useMemo(() => {
    if (year === "all") {
      // sum across years, then average across years to make readable; use total
      const agg = ARABIC_MONTHS.map((label, i) => {
        let sales = 0;
        let collections = 0;
        for (const y of meta.years) {
          for (const c of customers) {
            sales += c.sales[y]?.[i] ?? 0;
            collections += c.collections[y]?.[i] ?? 0;
          }
        }
        return { label, sales, collections, balance: sales - collections };
      });
      return agg;
    }
    return monthlyAggregate(customers, year);
  }, [customers, meta.years, year]);

  const totalForYear =
    year === "all"
      ? {
          sales: customers.reduce((a, c) => a + c.salesAll, 0),
          collections: customers.reduce((a, c) => a + c.collectionsAll, 0),
        }
      : totals.find((t) => t.year === year) ?? { sales: 0, collections: 0 };

  const filtered = useMemo(() => {
    const rows = customers
      .map((c) => {
        const salesVal =
          year === "all" ? c.salesAll : c.salesByYear[year] ?? 0;
        const colVal =
          year === "all" ? c.collectionsAll : c.collectionsByYear[year] ?? 0;
        const stat = year === "all" ? c.statusOverall : c.statusByYear[year as number];
        const balance = year === "all" ? c.balanceAll : (c.balanceByYear[year] ?? 0);
        return { c, salesVal, colVal, balance, stat };
      })
      .filter((r) => r.salesVal > 0)
      .filter((r) => (abc === "all" ? true : r.c.abc === abc))
      .filter((r) => (status === "all" ? true : r.stat === status))
      .filter((r) => (q ? r.c.name.includes(q) || r.c.code.includes(q) : true))
      .sort((a, b) => b.salesVal - a.salesVal);
    return rows;
  }, [customers, year, q, abc, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">تحليل المبيعات</h1>
          <p className="mt-1 text-sm text-muted-foreground">مبيعات العملاء شهرياً وسنوياً مع تصنيف ABC.</p>
        </div>
        <YearTabs value={year} years={meta.years} onChange={(v) => { setYear(v); setPage(1); }} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="إجمالي المبيعات" value={fmtEGP(totalForYear.sales)} tone="primary" />
        <KpiCard label="إجمالي المقبوضات" value={fmtEGP(totalForYear.collections)} tone="info" />
        <KpiCard label="عدد العملاء المسجّلين" value={fmtInt(filtered.length)} tone="muted" />
        <KpiCard
          label="نسبة التحصيل"
          value={fmtPct(totalForYear.sales > 0 ? (totalForYear.collections / totalForYear.sales) * 100 : 0)}
          tone="success"
        />
      </div>

      <Section title="المبيعات شهرياً">
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
              <Bar dataKey="sales" name="مبيعات" fill="var(--color-primary)" radius={[6, 6, 0, 0]}>
                {monthly.map((_e, i) => (
                  <Cell key={i} fill="var(--color-primary)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section
        title="جدول العملاء"
        description={`${fmtInt(filtered.length)} عميل بعد التصفية`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="ابحث بالاسم أو الكود…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setPage(1); }}
                className="w-56 pr-8"
              />
            </div>
            <SelectPills
              options={[
                { v: "all", l: "كل التصنيفات" },
                { v: "A", l: "A (Top)" },
                { v: "B", l: "B" },
                { v: "C", l: "C" },
              ]}
              value={abc}
              onChange={(v) => { setAbc(v as typeof abc); setPage(1); }}
            />
            <SelectPills
              options={[
                { v: "all", l: "كل الحالات" },
                { v: "active", l: "نشط" },
                { v: "atrisk", l: "متعثر" },
                { v: "stagnant", l: "راكد" },
              ]}
              value={status}
              onChange={(v) => { setStatus(v as typeof status); setPage(1); }}
            />
          </div>
        }
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-semibold">الترتيب</th>
                <th className="px-3 py-2 text-right font-semibold">الكود</th>
                <th className="px-3 py-2 text-right font-semibold">اسم العميل</th>
                <th className="px-3 py-2 text-center font-semibold">ABC</th>
                <th className="px-3 py-2 text-right font-semibold">المبيعات</th>
                <th className="px-3 py-2 text-right font-semibold">المقبوضات</th>
                <th className="px-3 py-2 text-right font-semibold">الرصيد التراكمي</th>
                <th className="px-3 py-2 text-right font-semibold">التحصيل %</th>
                <th className="px-3 py-2 text-center font-semibold">الحالة</th>
                <th className="px-3 py-2 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => (
                <tr key={r.c.code} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 num">{(page - 1) * perPage + i + 1}</td>
                  <td className="px-3 py-2 num text-xs text-muted-foreground">{r.c.code}</td>
                  <td className="px-3 py-2 font-medium">{r.c.name}</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                        r.c.abc === "A" && "bg-status-active/20 text-status-active",
                        r.c.abc === "B" && "bg-info/20 text-info",
                        r.c.abc === "C" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {r.c.abc}
                    </span>
                  </td>
                  <td className="px-3 py-2 num font-semibold">{fmtInt(r.salesVal)}</td>
                  <td className="px-3 py-2 num">{fmtInt(r.colVal)}</td>
                  <td className={cn("px-3 py-2 num font-semibold", r.balance > 0 ? "text-status-stagnant" : r.balance < 0 ? "text-status-active" : "")}>
                    {fmtInt(r.balance)}
                  </td>
                  <td className="px-3 py-2 num">
                    {fmtPct(r.salesVal > 0 ? (r.colVal / r.salesVal) * 100 : 0)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={r.stat} size="xs" />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Link
                      to="/customers"
                      search={{ code: r.c.code }}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      تفاصيل
                    </Link>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    لا توجد نتائج تطابق التصفية
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              السابق
            </Button>
            <div className="text-xs text-muted-foreground">
              صفحة {page} من {pages}
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
              التالي
            </Button>
          </div>
        )}
      </Section>
    </div>
  );
}

function YearTabs({
  value,
  years,
  onChange,
}: {
  value: YearSel;
  years: number[];
  onChange: (v: YearSel) => void;
}) {
  const opts: YearSel[] = ["all", ...years];
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
      {opts.map((o) => (
        <button
          key={String(o)}
          onClick={() => onChange(o)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-bold transition",
            value === o ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o === "all" ? "كل السنوات" : o}
        </button>
      ))}
    </div>
  );
}

function SelectPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ v: T; l: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-bold transition",
            value === o.v ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
