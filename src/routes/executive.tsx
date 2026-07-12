import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ShoppingCart,
  Wallet,
  Users,
  AlertTriangle,
  Percent,
  Trophy,
  Timer,
  Printer,
  FileText,
} from "lucide-react";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { useCustomers, useDataStore } from "@/lib/store";
import { fmtCompact, fmtEGP, fmtInt, fmtPct, ARABIC_MONTHS } from "@/lib/format";
import { KpiCard } from "@/components/KpiCard";
import { Section } from "@/components/Section";
import { estimateDSO, paretoData, yearlyTotals } from "@/lib/analytics";
import { tooltipEGP, tooltipMulti } from "@/lib/recharts-format";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { printHtml, escapeHtml } from "@/lib/print";
import type { Customer } from "@/lib/customer-model";
import type { Meta } from "@/lib/customer-model";
import {
  buildStagnantList,
  formatDays,
  priorityEmoji,
  priorityLabel,
  type Scope,
} from "@/lib/stagnation";

export const Route = createFileRoute("/executive")({
  head: () => ({
    meta: [
      { title: "الملخّص التنفيذي — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "لوحة قرار الإدارة: مبيعات، مقبوضات، DSO، ونسبة تحصيل عبر السنوات." },
    ],
  }),
  component: Executive,
});

function sumRange(monthly: number[] | undefined, from: number, to: number): number {
  if (!monthly) return 0;
  let s = 0;
  for (let i = from; i <= to && i < monthly.length; i++) s += monthly[i] ?? 0;
  return s;
}

function aggForYearRange(customers: Customer[], year: number, from: number, to: number) {
  let sales = 0, collections = 0, active = 0;
  for (const c of customers) {
    const s = sumRange(c.sales[year], from, to);
    const col = sumRange(c.collections[year], from, to);
    sales += s;
    collections += col;
    if (s > 0) active++;
  }
  return { sales, collections, active, balance: sales - collections, rate: sales > 0 ? (collections / sales) * 100 : 0 };
}




function Executive() {
  const customers = useCustomers();
  const meta = useDataStore((s: { meta: Meta }) => s.meta);
  const [selectedYear, setSelectedYear] = useState<number>(meta.currentYear);
  const [compareYear, setCompareYear] = useState<number>(Math.max(meta.years[0], meta.currentYear - 1));
  const partialMonthsSel = meta.partialMonths[selectedYear] ?? 12;
  const [monthFrom, setMonthFrom] = useState<number>(0);
  const [monthTo, setMonthTo] = useState<number>(Math.max(0, partialMonthsSel - 1));
  const [alertsScope, setAlertsScope] = useState<"year" | "all">("year");

  const totalsAllYears = useMemo(() => yearlyTotals(customers, meta.years), [customers, meta.years]);

  const cur = useMemo(() => aggForYearRange(customers, selectedYear, monthFrom, monthTo), [customers, selectedYear, monthFrom, monthTo]);
  const prev = useMemo(() => aggForYearRange(customers, compareYear, monthFrom, monthTo), [customers, compareYear, monthFrom, monthTo]);

  const dso = useMemo(() => estimateDSO(customers, selectedYear, meta.years), [customers, selectedYear, meta.years]);

  const monthly = useMemo(() => {
    return ARABIC_MONTHS.slice(monthFrom, monthTo + 1).map((label, idx) => {
      const i = monthFrom + idx;
      let sales = 0, collections = 0;
      for (const c of customers) {
        sales += c.sales[selectedYear]?.[i] ?? 0;
        collections += c.collections[selectedYear]?.[i] ?? 0;
      }
      return { label, sales, collections, balance: sales - collections };
    });
  }, [customers, selectedYear, monthFrom, monthTo]);

  const pareto = useMemo(
    () => paretoData(customers, (c) => sumRange(c.sales[selectedYear], monthFrom, monthTo), 15),
    [customers, selectedYear, monthFrom, monthTo],
  );

  // Year-scoped customer counts — stagnant/at-risk are aligned with the 60-day
  // definition used across the app (buildStagnantList) so exec KPIs match the
  // stagnation report exactly. "at-risk" = 30–59 days since last invoice (approaching stagnation).
  const yearCounts = useMemo(() => {
    const scope: Scope = { kind: "year", year: selectedYear };
    const { rows: stagnantRows, refDate } = buildStagnantList(customers, scope, meta);
    const stagnantCodes = new Set(stagnantRows.map((r) => r.c.code));
    const stagnant = stagnantRows.length;
    let active = 0, atrisk = 0;
    for (const c of customers) {
      if (stagnantCodes.has(c.code)) continue;
      // must have had any sales in years ≤ selectedYear to be counted
      let hasSales = false;
      for (const y of meta.years) {
        if (y <= selectedYear && (c.salesByYear[y] ?? 0) > 0) { hasSales = true; break; }
      }
      if (!hasSales) continue;
      if (!c.lastSale) continue;
      const lastDate = new Date(c.lastSale.year, c.lastSale.month + 1, 0);
      if (lastDate.getTime() > refDate.getTime()) { active++; continue; }
      const days = Math.floor((refDate.getTime() - lastDate.getTime()) / 86400000);
      if (days < 30) active++;
      else atrisk++; // 30..59 days → approaching stagnation
    }
    return { active, atrisk, stagnant };
  }, [customers, selectedYear, meta]);
  const { active: activeCount, atrisk: atRiskCount, stagnant: stagnantCount } = yearCounts;

  const topCustomer = [...customers]
    .map((c) => ({ c, v: sumRange(c.sales[selectedYear], monthFrom, monthTo) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v)[0];

  const yoyGrowth = prev.sales > 0 ? ((cur.sales - prev.sales) / prev.sales) * 100 : 0;

  const rangeLabel = `${ARABIC_MONTHS[monthFrom]} – ${ARABIC_MONTHS[monthTo]}`;

  const alertsScopeObj: Scope = alertsScope === "all" ? { kind: "all" } : { kind: "year", year: selectedYear };


  function printExecutive() {
    const rows = totalsAllYears
      .map((t) => `<tr><td class="num">${t.year}</td><td class="num">${fmtInt(t.sales)}</td><td class="num">${fmtInt(t.collections)}</td><td class="num">${fmtInt(t.balance)}</td><td class="num">${fmtPct(t.collectionRate)}</td></tr>`)
      .join("");
    const html = `
      <div class="header">
        <div>
          <div class="brand">الملخّص التنفيذي</div>
          <div class="muted">مقارنة ${selectedYear} (${rangeLabel}) مقابل ${compareYear} — نفس الفترة</div>
        </div>
        <div class="muted">${new Date().toLocaleDateString("ar-EG")}</div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="k">نسبة التحصيل — ${selectedYear}</div><div class="v">${fmtPct(cur.rate)}</div></div>
        <div class="card"><div class="k">نسبة التحصيل — ${compareYear}</div><div class="v">${fmtPct(prev.rate)}</div></div>
        <div class="card"><div class="k">متوسط أيام التحصيل (DSO)</div><div class="v">${dso > 0 ? dso + " يوم" : "—"}</div></div>
        <div class="card"><div class="k">عملاء نشطين / متعثرين / راكدين</div><div class="v">${activeCount} / ${atRiskCount} / ${stagnantCount}</div></div>
      </div>
      <h2>نظرة عبر السنوات — نسبة التحصيل والرصيد</h2>
      <table>
        <thead><tr><th>السنة</th><th>المبيعات</th><th>المقبوضات</th><th>الرصيد</th><th>التحصيل %</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="muted" style="margin-top:10px">* إجمالي مبيعات السنة الحالية غير مدرج في هذه النسخة (سرّي).</div>
    `;
    printHtml(`الملخّص التنفيذي — ${selectedYear}`, html);
  }

  function printStagnationReport() {
    const { rows: stagnant, refDate } = buildStagnantList(customers, alertsScopeObj, meta);
    const groups = { high: [] as typeof stagnant, med: [] as typeof stagnant, low: [] as typeof stagnant };
    for (const s of stagnant) groups[s.priority].push(s);
    const totalHistoricalSales = stagnant.reduce((a, b) => a + b.historicalSales, 0);
    const avgDays = stagnant.length ? Math.round(stagnant.reduce((a, b) => a + b.days, 0) / stagnant.length) : 0;
    const scopeLabel = alertsScope === "all" ? "كل السنوات" : `سنة ${selectedYear}`;

    const renderRows = (list: typeof stagnant) =>
      list
        .map(
          (r, i) => `<tr class="sev-${r.priority}">
            <td class="num">${i + 1}</td>
            <td>${escapeHtml(r.c.name)}<div class="muted">${escapeHtml(r.c.code)}</div></td>
            <td class="num">${fmtInt(r.historicalSales)}</td>
            <td>${ARABIC_MONTHS[r.lastSaleDate.getMonth()]} ${r.lastSaleDate.getFullYear()}</td>
            <td>${formatDays(r.days)}</td>
            <td>${fmtPct(r.collectionRate)}</td>
          </tr>`,
        )
        .join("");

    const section = (title: string, color: string, list: typeof stagnant) => {
      if (list.length === 0) return "";
      const total = list.reduce((a, b) => a + b.historicalSales, 0);
      return `<h2 style="color:${color};border-color:${color}">${title} (${list.length} عميل — إجمالي تاريخي ${fmtInt(total)} ج.م)</h2>
      <table>
        <thead><tr><th>#</th><th>العميل</th><th>إجمالي البيع التاريخي</th><th>آخر فاتورة بيع</th><th>مدة التوقف</th><th>التحصيل %</th></tr></thead>
        <tbody>${renderRows(list)}</tbody>
      </table>`;
    };

    const html = `
      <div class="header">
        <div>
          <div class="brand">تقرير العملاء الراكدين</div>
          <div class="muted">النطاق: ${scopeLabel} · تاريخ الاحتساب: ${refDate.toLocaleDateString("ar-EG")}</div>
        </div>
        <div class="muted">${new Date().toLocaleString("ar-EG")}</div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="k">إجمالي العملاء الراكدين</div><div class="v">${stagnant.length}</div></div>
        <div class="card"><div class="k">🔴 أولوية عالية (60–180 يوم)</div><div class="v" style="color:#991b1b">${groups.high.length}</div></div>
        <div class="card"><div class="k">🟡 أولوية متوسطة (181–540 يوم)</div><div class="v" style="color:#92400e">${groups.med.length}</div></div>
        <div class="card"><div class="k">⚪ أولوية منخفضة (>540 يوم)</div><div class="v" style="color:#374151">${groups.low.length}</div></div>
        <div class="card"><div class="k">إجمالي مبيعات تاريخية للراكدين</div><div class="v">${fmtInt(totalHistoricalSales)} ج.م</div></div>
        <div class="card"><div class="k">متوسط مدة التوقف</div><div class="v">${avgDays} يوم</div></div>
      </div>
      ${section("🔴 أولوية عالية — توقف 60 إلى 180 يوم", "#b91c1c", groups.high)}
      ${section("🟡 أولوية متوسطة — توقف 181 إلى 540 يوم", "#b45309", groups.med)}
      ${section("⚪ أولوية منخفضة — توقف أكثر من 540 يوم", "#374151", groups.low)}
      <div class="muted" style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.7">
        <div>• تاريخ ووقت إنشاء التقرير: ${new Date().toLocaleString("ar-EG")}</div>
        <div>• تم احتساب الركود بناءً على آخر فاتورة بيع فعلية.</div>
        <div>• تم استبعاد جميع العملاء الذين اشتروا خلال آخر 60 يوم.</div>
        <div>• الأرصدة السالبة (دائن) تُعرض كما هي ولا تُعتبر مديونية.</div>
        <div>• تم ترتيب العملاء حسب الأولوية ثم قيمة العميل التاريخية.</div>
      </div>
    `;
    printHtml("تقرير العملاء الراكدين", html, { orientation: "landscape" });
  }


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">الملخّص التنفيذي</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedYear} · الفترة: {rangeLabel} — مقارنة مع {compareYear} في نفس الفترة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={printExecutive}>
            <Printer className="ms-1 h-4 w-4" /> طباعة الملخّص
          </Button>
          <Button variant="outline" size="sm" onClick={printStagnationReport}>
            <FileText className="ms-1 h-4 w-4" /> تقرير الراكدين
          </Button>
        </div>
      </header>

      {/* Filters bar */}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-3">
        <div>
          <div className="mb-2 text-xs font-bold text-muted-foreground">السنة الرئيسية</div>
          <YearPills years={meta.years} value={selectedYear} onChange={(y) => {
            setSelectedYear(y);
            const pm = meta.partialMonths[y] ?? 12;
            setMonthTo((m) => Math.min(m, pm - 1));
          }} />
        </div>
        <div>
          <div className="mb-2 text-xs font-bold text-muted-foreground">سنة المقارنة</div>
          <YearPills years={meta.years.filter((y) => y !== selectedYear)} value={compareYear} onChange={setCompareYear} />
        </div>
        <div>
          <div className="mb-2 text-xs font-bold text-muted-foreground">فترة المقارنة (من – إلى)</div>
          <div className="flex items-center gap-2 text-xs">
            <select
              value={monthFrom}
              onChange={(e) => { const v = Number(e.target.value); setMonthFrom(v); if (v > monthTo) setMonthTo(v); }}
              className="rounded-md border border-border bg-background px-2 py-1.5 font-semibold"
            >
              {ARABIC_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <span className="text-muted-foreground">إلى</span>
            <select
              value={monthTo}
              onChange={(e) => { const v = Number(e.target.value); setMonthTo(v); if (v < monthFrom) setMonthFrom(v); }}
              className="rounded-md border border-border bg-background px-2 py-1.5 font-semibold"
            >
              {ARABIC_MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            المقارنة تعتمد نفس الفترة من {compareYear} لضمان عدالة المقارنة.
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={`المبيعات — ${selectedYear} (${rangeLabel})`}
          value={fmtEGP(cur.sales)}
          icon={<ShoppingCart className="h-5 w-5" />}
          trend={{ delta: yoyGrowth, label: `مقابل ${compareYear}` }}
          tone="primary"
        />
        <KpiCard
          label={`المقبوضات — ${selectedYear}`}
          value={fmtEGP(cur.collections)}
          icon={<Wallet className="h-5 w-5" />}
          hint={`صافي حركة الفترة: ${fmtEGP(cur.balance)}`}
          tone="info"
        />
        <KpiCard
          label="نسبة التحصيل"
          value={fmtPct(cur.rate)}
          icon={<Percent className="h-5 w-5" />}
          hint={`${compareYear}: ${fmtPct(prev.rate)}`}
          tone={cur.rate >= 80 ? "success" : cur.rate >= 60 ? "warning" : "destructive"}
        />
        <KpiCard
          label={`متوسط أيام التحصيل (DSO) — ${selectedYear}`}
          value={dso > 0 ? `${dso} يوم` : "—"}
          icon={<Timer className="h-5 w-5" />}
          hint={`لسنة ${selectedYear} الكاملة`}
          tone={dso <= 45 ? "success" : dso <= 90 ? "warning" : "destructive"}
        />
        <KpiCard label={`عملاء نشطين — ${selectedYear}`} value={fmtInt(activeCount)} icon={<Users className="h-5 w-5" />} tone="success" />
        <KpiCard label={`عملاء متعثرين — ${selectedYear}`} value={fmtInt(atRiskCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <KpiCard label={`عملاء راكدين — ${selectedYear}`} value={fmtInt(stagnantCount)} icon={<AlertTriangle className="h-5 w-5" />} tone="destructive" />
        <KpiCard
          label={`أعلى عميل ${selectedYear}`}
          value={topCustomer ? topCustomer.c.name : "—"}
          icon={<Trophy className="h-5 w-5" />}
          hint={topCustomer ? fmtEGP(topCustomer.v) : ""}
          tone="primary"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title={`المبيعات مقابل المقبوضات — ${rangeLabel} ${selectedYear}`} className="lg:col-span-2">
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <ComposedChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={tooltipEGP}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="مبيعات" dataKey="sales" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                <Bar name="مقبوضات" dataKey="collections" fill="var(--color-status-active)" radius={[6, 6, 0, 0]} />
                <Line name="الرصيد" type="monotone" dataKey="balance" stroke="var(--color-status-atrisk)" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <div className="lg:sticky lg:top-4 lg:self-start">
          <Section title="نظرة عبر السنوات">
            <div className="space-y-3">
              {totalsAllYears.map((t) => (
                <div key={t.year} className={cn("rounded-lg border p-3", t.year === selectedYear ? "border-primary bg-primary/5" : "border-border")}>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold">{t.year}</div>
                    <div className="text-xs text-muted-foreground">{fmtInt(t.activeCustomers)} عميل نشط</div>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">مبيعات</div>
                      <div className="font-semibold text-primary">{fmtCompact(t.sales)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">مقبوضات</div>
                      <div className="font-semibold text-status-active">{fmtCompact(t.collections)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">تحصيل</div>
                      <div className="font-semibold">{fmtPct(t.collectionRate)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <Section title={`Pareto — أعلى 15 عميل ${selectedYear} (${rangeLabel})`}>
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <ComposedChart data={pareto}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="rank" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip
                formatter={tooltipMulti((v, name) => (name === "المبيعات" ? fmtEGP(v) : `${v.toFixed(1)}%`))}
                labelFormatter={(l) => pareto[Number(l) - 1]?.name ?? ""}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" name="المبيعات" dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]}>
                {pareto.map((_p, i) => (
                  <Cell key={i} fill={i < 5 ? "var(--color-status-active)" : i < 10 ? "var(--color-primary)" : "var(--color-status-atrisk)"} />
                ))}
              </Bar>
              <Line yAxisId="right" name="التراكمي %" type="monotone" dataKey="cumulativePct" stroke="var(--color-status-stagnant)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section
        title="تنبيهات ذكية للإدارة"
        description={
          alertsScope === "all"
            ? "كل العملاء الراكدين عبر السنوات الثلاث (توقف ≥ 60 يوم من تاريخ اليوم)"
            : `عملاء راكدين بالنسبة لسنة ${selectedYear} (توقف ≥ 60 يوم من نهاية السنة)`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              <button
                onClick={() => setAlertsScope("year")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition",
                  alertsScope === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                سنة {selectedYear}
              </button>
              <button
                onClick={() => setAlertsScope("all")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-bold transition",
                  alertsScope === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                كل السنوات
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={printStagnationReport}>
              <Printer className="ms-1 h-4 w-4" /> طباعة تقرير كامل
            </Button>
          </div>
        }
      >
        <AlertsList customers={customers} scope={alertsScopeObj} meta={meta} />
      </Section>
    </div>
  );
}


function YearPills({ years, value, onChange }: { years: number[]; value: number; onChange: (y: number) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-background p-1">
      {years.map((y) => (
        <button
          key={y}
          onClick={() => onChange(y)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-bold transition",
            value === y ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {y}
        </button>
      ))}
    </div>
  );
}

function AlertsList({ customers, scope, meta }: { customers: Customer[]; scope: Scope; meta: Meta }) {
  const { rows: stagnant } = useMemo(() => buildStagnantList(customers, scope, meta), [customers, scope, meta]);

  const alerts = useMemo(() => {
    return stagnant.slice(0, 12).map((r) => {
      // Smart tag based on customer profile
      let tag = "";
      if (r.days <= 90 && r.historicalSales >= 500_000) tag = "🟢 مبيعاته كبيرة وتوقف منذ فترة قصيرة — متابعة عاجلة";
      else if (r.balance > 0 && r.days >= 180) tag = "🟡 رصيد مرتفع ولم يشترِ منذ فترة طويلة";
      else if (r.days > 365 && r.historicalSales >= 300_000) tag = "🔴 توقف أكثر من سنة وكان من كبار العملاء";
      else if (r.collectionRate >= 90) tag = "⭐ نسبة تحصيله ممتازة ويمكن استرجاعه بسهولة";
      return { r, tag };
    });
  }, [stagnant]);

  if (alerts.length === 0) return <div className="text-sm text-muted-foreground">لا توجد تنبيهات حالياً.</div>;

  const styleFor = (s: "high" | "med" | "low") =>
    s === "high"
      ? "border-status-stagnant/30 bg-status-stagnant/5 text-status-stagnant"
      : s === "med"
        ? "border-status-atrisk/30 bg-status-atrisk/5 text-status-atrisk"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <ul className="space-y-2">
      {alerts.map(({ r, tag }, i) => (
        <li key={r.c.code} className={cn("flex items-start gap-3 rounded-lg border p-3 text-sm", styleFor(r.priority))}>
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-bold">
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="font-semibold text-foreground">
              {priorityEmoji(r.priority)} {r.c.name}
            </div>
            <div className="text-xs text-muted-foreground">
              إجمالي تاريخي {fmtEGP(r.historicalSales)} · متوقف {formatDays(r.days)} · تحصيل {fmtPct(r.collectionRate)}
            </div>
            {tag && <div className="mt-1 text-xs font-semibold">{tag}</div>}
          </div>
          <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold">
            {priorityLabel(r.priority)}
          </span>
        </li>
      ))}
    </ul>
  );
}

void BarChart;

