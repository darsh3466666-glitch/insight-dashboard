import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Search, ArrowRight, TrendingUp, TrendingDown, Minus, Printer } from "lucide-react";
import { useCustomers, useDataStore } from "@/lib/store";
import { fmtCompact, fmtEGP, fmtInt, fmtPct } from "@/lib/format";
import { ARABIC_MONTHS } from "@/lib/format";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { tooltipEGP } from "@/lib/recharts-format";
import type { Customer } from "@/lib/customer-model";
import { STATUS_LABEL, type StatusKey } from "@/lib/customer-model";
import { cn } from "@/lib/utils";
import { printHtml, escapeHtml } from "@/lib/print";

const searchSchema = z.object({ code: z.coerce.string().optional() });

export const Route = createFileRoute("/customers")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "رحلة العميل 360° — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "بروفايل العميل الكامل عبر السنوات مع المبيعات والمقبوضات ورصيد الحساب." },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { code } = Route.useSearch();
  const navigate = Route.useNavigate();
  const customers = useCustomers();
  const meta = useDataStore((s) => s.meta);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [abcFilter, setAbcFilter] = useState<"all" | "A" | "B" | "C">("all");

  const filtered = useMemo(
    () =>
      customers
        .filter((c) => c.salesAll > 0 || c.collectionsAll > 0)
        .filter((c) => (statusFilter === "all" ? true : c.statusOverall === statusFilter))
        .filter((c) => (abcFilter === "all" ? true : c.abc === abcFilter))
        .filter((c) => (q ? c.name.includes(q) || c.code.includes(q) : true))
        .sort((a, b) => b.salesAll - a.salesAll),
    [customers, q, statusFilter, abcFilter],
  );

  const selected = useMemo(() => customers.find((c) => c.code === code) ?? filtered[0], [customers, code, filtered]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">رحلة العميل 360°</h1>
        <p className="mt-1 text-sm text-muted-foreground">بروفايل كامل عبر السنوات: مبيعات، مقبوضات، ورصيد.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Section title={`اختر عميل (${fmtInt(filtered.length)})`} contentClassName="p-0">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث…" className="pr-8" />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "active", "atrisk", "stagnant", "inactive"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "rounded-md border border-border px-2 py-0.5 text-[10px] font-bold transition",
                    statusFilter === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {s === "all" ? "الكل" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "A", "B", "C"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAbcFilter(a)}
                  className={cn(
                    "rounded-md border border-border px-2 py-0.5 text-[10px] font-bold transition",
                    abcFilter === a ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  {a === "all" ? "كل ABC" : a}
                </button>
              ))}
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
            {filtered.slice(0, 300).map((c) => (
              <button
                key={c.code}
                onClick={() => navigate({ search: { code: c.code }, replace: true })}
                className={cn(
                  "flex w-full items-center gap-2 border-b border-border/60 px-3 py-2 text-right text-xs transition hover:bg-muted",
                  selected?.code === c.code && "bg-primary/10",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.code} · {fmtCompact(c.salesAll)}
                  </div>
                </div>
                <StatusBadge status={c.statusOverall} size="xs" />
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="p-4 text-center text-xs text-muted-foreground">لا نتائج</div>
            )}
          </div>
        </Section>

        {selected ? <CustomerProfile customer={selected} years={meta.years} /> : <div>لا يوجد عميل</div>}
      </div>
    </div>
  );
}

function CustomerProfile({ customer, years }: { customer: Customer; years: number[] }) {
  const timeline = useMemo(() => {
    const flat: Array<{ label: string; sales: number; collections: number; balance: number }> = [];
    let runningBalance = 0;
    for (const y of years) {
      const s = customer.sales[y] ?? Array(12).fill(0);
      const c = customer.collections[y] ?? Array(12).fill(0);
      for (let i = 0; i < 12; i++) {
        runningBalance += s[i] - c[i];
        flat.push({
          label: `${ARABIC_MONTHS[i].slice(0, 3)} ${String(y).slice(2)}`,
          sales: s[i],
          collections: c[i],
          balance: runningBalance,
        });
      }
    }
    return flat;
  }, [customer, years]);

  const trendIcon =
    customer.trendScore > 5 ? <TrendingUp className="h-4 w-4" /> :
    customer.trendScore < -5 ? <TrendingDown className="h-4 w-4" /> :
    <Minus className="h-4 w-4" />;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black">{customer.name}</h2>
              <StatusBadge status={customer.statusOverall} />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              كود: {customer.code} · تصنيف ABC: {customer.abc} · اتجاه:{" "}
              <span className={cn(
                "inline-flex items-center gap-1 font-semibold",
                customer.trendScore > 5 ? "text-status-active" : customer.trendScore < -5 ? "text-status-stagnant" : "text-muted-foreground",
              )}>
                {trendIcon}
                {customer.trendScore > 0 ? "+" : ""}{customer.trendScore}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => printCustomer(customer, years)}>
              <Printer className="ms-1 h-4 w-4" /> طباعة
            </Button>
            <Link to="/sales" className="text-xs font-semibold text-primary hover:underline">
              رجوع لجدول المبيعات <ArrowRight className="inline h-3 w-3" />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="إجمالي المبيعات" value={fmtEGP(customer.salesAll)} tone="primary" />
          <KpiCard label="إجمالي المقبوضات" value={fmtEGP(customer.collectionsAll)} tone="info" />
          <KpiCard
            label={`الرصيد المحسوب منذ ${years[0] ?? "بداية البيانات"}`}
            value={fmtEGP(customer.balanceAll)}
            tone={customer.balanceAll > 0 ? "destructive" : customer.balanceAll < 0 ? "success" : "muted"}
          />
          <KpiCard
            label="نسبة التحصيل"
            value={fmtPct(customer.collectionRateAll)}
            tone={customer.collectionRateAll >= 80 ? "success" : customer.collectionRateAll >= 60 ? "warning" : "destructive"}
          />
        </div>
      </div>

      <Section title="تفصيل سنوي">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-2 text-right font-semibold">السنة</th>
                <th className="px-3 py-2 text-right font-semibold">المبيعات</th>
                <th className="px-3 py-2 text-right font-semibold">المقبوضات</th>
                <th className="px-3 py-2 text-right font-semibold">الرصيد التراكمي</th>
                <th className="px-3 py-2 text-right font-semibold">التحصيل %</th>
                <th className="px-3 py-2 text-center font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const s = customer.salesByYear[y] ?? 0;
                const c = customer.collectionsByYear[y] ?? 0;
                return (
                  <tr key={y} className="border-b border-border/50">
                    <td className="px-3 py-2 font-bold">{y}</td>
                    <td className="px-3 py-2 num">{fmtInt(s)}</td>
                    <td className="px-3 py-2 num">{fmtInt(c)}</td>
                    <td className={cn("px-3 py-2 num font-semibold", (customer.balanceByYear[y] ?? 0) > 0 ? "text-status-stagnant" : (customer.balanceByYear[y] ?? 0) < 0 ? "text-status-active" : "")}>
                      {fmtInt(customer.balanceByYear[y] ?? 0)}
                    </td>
                    <td className="px-3 py-2 num">{fmtPct(s > 0 ? (c / s) * 100 : 0)}</td>
                    <td className="px-3 py-2 text-center">
                      <StatusBadge status={customer.statusByYear[y] ?? "inactive"} size="xs" />
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-muted/40 font-bold">
                <td className="px-3 py-2">الإجمالي</td>
                <td className="px-3 py-2 num">{fmtInt(customer.salesAll)}</td>
                <td className="px-3 py-2 num">{fmtInt(customer.collectionsAll)}</td>
                <td className={cn("px-3 py-2 num", customer.balanceAll > 0 ? "text-status-stagnant" : "text-status-active")}>
                  {fmtInt(customer.balanceAll)}
                </td>
                <td className="px-3 py-2 num">{fmtPct(customer.collectionRateAll)}</td>
                <td className="px-3 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="خط زمني (36 شهر)" description="مبيعات، مقبوضات، ورصيد شهري">
        <div className="h-80 w-full">
          <ResponsiveContainer>
            <ComposedChart data={timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={tooltipEGP}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8 }}
              />
              <Bar name="مبيعات" dataKey="sales" fill="var(--color-primary)" />
              <Bar name="مقبوضات" dataKey="collections" fill="var(--color-status-active)" />
              <Line name="الرصيد" type="monotone" dataKey="balance" stroke="var(--color-status-stagnant)" strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="ملاحظات">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            • الرصيد المعروض = المبيعات − المقبوضات بشكل تراكمي منذ <strong className="text-foreground">{years[0]}</strong>؛ ولا يشمل رصيدًا افتتاحيًا أو مرتجعات وتسويات غير موجودة في الملفات.
          </li>
          {customer.lastSale && (
            <li>
              • آخر عملية بيع مسجّلة: <strong className="text-foreground">{ARABIC_MONTHS[customer.lastSale.month]} {customer.lastSale.year}</strong>
            </li>
          )}
          {customer.lastCollection && (
            <li>
              • آخر عملية تحصيل مسجّلة: <strong className="text-foreground">{ARABIC_MONTHS[customer.lastCollection.month]} {customer.lastCollection.year}</strong>
            </li>
          )}
          <li>
            • تصنيف ABC: <strong className="text-foreground">{customer.abc}</strong>
            {customer.abc === "A" && " — ضمن أعلى 80% من المبيعات (عميل استراتيجي)"}
            {customer.abc === "B" && " — ضمن الشريحة الوسطى"}
            {customer.abc === "C" && " — من العملاء الصغار"}
          </li>
        </ul>
      </Section>
    </div>
  );
}

function printCustomer(customer: Customer, years: number[]) {
  const yearRows = years
    .map((y) => {
      const s = customer.salesByYear[y] ?? 0;
      const co = customer.collectionsByYear[y] ?? 0;
      return `<tr>
        <td class="num"><strong>${y}</strong></td>
        <td class="num">${fmtInt(s)}</td>
        <td class="num">${fmtInt(co)}</td>
        <td class="num">${fmtInt(customer.balanceByYear[y] ?? 0)}</td>
        <td class="num">${fmtPct(s > 0 ? (co / s) * 100 : 0)}</td>
        <td><span class="pill pill-${customer.statusByYear[y] === "stagnant" ? "red" : customer.statusByYear[y] === "atrisk" ? "amber" : customer.statusByYear[y] === "active" ? "green" : "gray"}">${STATUS_LABEL[customer.statusByYear[y] ?? "inactive"]}</span></td>
      </tr>`;
    })
    .join("");

  const monthlyRows = years
    .map((y) => {
      const s = customer.sales[y] ?? Array(12).fill(0);
      const co = customer.collections[y] ?? Array(12).fill(0);
      const cells = s
        .map((val, i) => `<td class="num">${val ? fmtInt(val) : "—"}<div class="muted" style="font-size:9px">${co[i] ? fmtInt(co[i]) : ""}</div></td>`)
        .join("");
      return `<tr><td><strong>${y}</strong></td>${cells}</tr>`;
    })
    .join("");
  const monthHeaders = ARABIC_MONTHS.map((m) => `<th>${m.slice(0, 3)}</th>`).join("");

  const html = `
    <div class="header">
      <div>
        <div class="brand">${escapeHtml(customer.name)}</div>
        <div class="muted">كود: ${escapeHtml(customer.code)} · ABC: ${customer.abc} · الحالة: ${STATUS_LABEL[customer.statusOverall]}</div>
      </div>
      <div class="muted">${new Date().toLocaleDateString("ar-EG")}</div>
    </div>
    <div class="grid-2">
      <div class="card"><div class="k">إجمالي المبيعات</div><div class="v">${fmtInt(customer.salesAll)} ج.م</div></div>
      <div class="card"><div class="k">إجمالي المقبوضات</div><div class="v">${fmtInt(customer.collectionsAll)} ج.م</div></div>
      <div class="card"><div class="k">الرصيد التراكمي</div><div class="v">${fmtInt(customer.balanceAll)} ج.م</div></div>
      <div class="card"><div class="k">نسبة التحصيل</div><div class="v">${fmtPct(customer.collectionRateAll)}</div></div>
    </div>
    <h2>تفصيل سنوي</h2>
    <table><thead><tr><th>السنة</th><th>المبيعات</th><th>المقبوضات</th><th>الرصيد التراكمي</th><th>التحصيل %</th><th>الحالة</th></tr></thead><tbody>${yearRows}</tbody></table>
    <h2>خط زمني شهري (المبيعات / المقبوضات)</h2>
    <table><thead><tr><th>السنة</th>${monthHeaders}</tr></thead><tbody>${monthlyRows}</tbody></table>
    <p class="muted" style="margin-top:8px">الرقم العلوي في كل خانة: المبيعات — الرقم السفلي: المقبوضات (بالجنيه المصري).</p>
    <h2>ملاحظات</h2>
    <ul>
      <li>الرصيد محسوب تراكميًا من المبيعات ناقص المقبوضات منذ ${years[0]}، ولا يتضمن رصيدًا افتتاحيًا أو تسويات غير واردة بالملفات.</li>
      ${customer.lastSale ? `<li>آخر عملية بيع: <strong>${ARABIC_MONTHS[customer.lastSale.month]} ${customer.lastSale.year}</strong></li>` : ""}
      ${customer.lastCollection ? `<li>آخر عملية تحصيل: <strong>${ARABIC_MONTHS[customer.lastCollection.month]} ${customer.lastCollection.year}</strong></li>` : ""}
      <li>مؤشر الاتجاه (Trend Score): <strong>${customer.trendScore > 0 ? "+" : ""}${customer.trendScore}%</strong></li>
    </ul>
  `;
  printHtml(`عميل — ${customer.name}`, html, { orientation: "landscape" });
}

// silence unused import
void BarChart;
