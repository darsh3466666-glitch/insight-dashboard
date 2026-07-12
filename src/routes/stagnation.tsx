import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Printer, Download, ArrowUpDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useCustomers, useDataStore } from "@/lib/store";
import { Section } from "@/components/Section";
import { KpiCard } from "@/components/KpiCard";
import { fmtEGP, fmtInt, fmtPct, ARABIC_MONTHS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { printHtml, escapeHtml } from "@/lib/print";
import {
  buildStagnantList,
  formatDays,
  priorityEmoji,
  priorityLabel,
  type Priority,
  type Scope,
  type StagnantRow,
} from "@/lib/stagnation";

export const Route = createFileRoute("/stagnation")({
  head: () => ({
    meta: [
      { title: "تقرير العملاء الراكدين — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "قائمة العملاء المتوقفين بترتيب الأولوية حسب مدة التوقف والقيمة التاريخية." },
    ],
  }),
  component: StagnationPage,
});

type SortKey = "priority" | "name" | "sales" | "days" | "lastSale" | "rate";
type SortDir = "asc" | "desc";

function StagnationPage() {
  const customers = useCustomers();
  const meta = useDataStore((s) => s.meta);
  const [scopeKind, setScopeKind] = useState<"year" | "all">("all");
  const [scopeYear, setScopeYear] = useState<number>(meta.currentYear);
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const perPage = 25;

  const scope: Scope = scopeKind === "all" ? { kind: "all" } : { kind: "year", year: scopeYear };
  const { rows: allStagnant, refDate } = useMemo(
    () => buildStagnantList(customers, scope, meta),
    [customers, scope, meta],
  );

  const groups = useMemo(() => {
    const g = { high: 0, med: 0, low: 0 };
    for (const r of allStagnant) g[r.priority]++;
    return g;
  }, [allStagnant]);
  const totalHistoricalSales = useMemo(
    () => allStagnant.reduce((a, b) => a + b.historicalSales, 0),
    [allStagnant],
  );
  const avgDays = allStagnant.length
    ? Math.round(allStagnant.reduce((a, b) => a + b.days, 0) / allStagnant.length)
    : 0;

  const filtered = useMemo(() => {
    const base = allStagnant
      .filter((r) => (priorityFilter === "all" ? true : r.priority === priorityFilter))
      .filter((r) => (q ? r.c.name.includes(q) || r.c.code.includes(q) : true));
    const priRank: Record<Priority, number> = { high: 0, med: 1, low: 2 };
    const sorted = [...base].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "priority":
          cmp = priRank[a.priority] - priRank[b.priority];
          if (cmp === 0) cmp = b.historicalSales - a.historicalSales;
          break;
        case "name":
          cmp = a.c.name.localeCompare(b.c.name, "ar");
          break;
        case "sales":
          cmp = a.historicalSales - b.historicalSales;
          break;
        case "days":
          cmp = a.days - b.days;
          break;
        case "lastSale":
          cmp = a.lastSaleDate.getTime() - b.lastSaleDate.getTime();
          break;
        case "rate":
          cmp = a.collectionRate - b.collectionRate;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [allStagnant, priorityFilter, q, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const rows = filtered.slice((page - 1) * perPage, page * perPage);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir(k === "name" ? "asc" : "desc");
    }
    setPage(1);
  }

  const scopeLabel = scopeKind === "all" ? "كل السنوات" : `سنة ${scopeYear}`;

  function exportExcel() {
    const data = filtered.map((r, i) => ({
      "#": i + 1,
      "الأولوية": priorityLabel(r.priority),
      "كود العميل": r.c.code,
      "اسم العميل": r.c.name,
      "إجمالي المبيعات التاريخية": r.historicalSales,
      "آخر فاتورة بيع": `${ARABIC_MONTHS[r.lastSaleDate.getMonth()]} ${r.lastSaleDate.getFullYear()}`,
      "مدة التوقف (يوم)": r.days,
      "نسبة التحصيل %": Number(r.collectionRate.toFixed(1)),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "الراكدين");
    XLSX.writeFile(wb, `stagnant-customers-${scopeKind === "all" ? "all" : scopeYear}.xlsx`);
  }

  function printCurrent() {
    const rowsHtml = filtered
      .map(
        (r, i) => `<tr class="sev-${r.priority}">
        <td class="num">${i + 1}</td>
        <td><span class="pill pill-${r.priority === "high" ? "red" : r.priority === "med" ? "amber" : "gray"}">${priorityEmoji(r.priority)} ${priorityLabel(r.priority)}</span></td>
        <td>${escapeHtml(r.c.name)}<div class="muted">${escapeHtml(r.c.code)}</div></td>
        <td class="num">${fmtInt(r.historicalSales)}</td>
        <td>${ARABIC_MONTHS[r.lastSaleDate.getMonth()]} ${r.lastSaleDate.getFullYear()}</td>
        <td>${formatDays(r.days)}</td>
        <td class="num">${fmtPct(r.collectionRate)}</td>
      </tr>`,
      )
      .join("");
    const html = `
      <div class="header">
        <div><div class="brand">تقرير العملاء الراكدين — ${scopeLabel}</div>
        <div class="muted">${filtered.length} عميل · تاريخ الاحتساب: ${refDate.toLocaleDateString("ar-EG")}</div></div>
        <div class="muted">${new Date().toLocaleString("ar-EG")}</div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="k">إجمالي العملاء الراكدين</div><div class="v">${allStagnant.length}</div></div>
        <div class="card"><div class="k">🔴 أولوية عالية (60–180 يوم)</div><div class="v" style="color:#991b1b">${groups.high}</div></div>
        <div class="card"><div class="k">🟡 أولوية متوسطة (181–540 يوم)</div><div class="v" style="color:#92400e">${groups.med}</div></div>
        <div class="card"><div class="k">⚪ أولوية منخفضة (>540 يوم)</div><div class="v" style="color:#374151">${groups.low}</div></div>
        <div class="card"><div class="k">إجمالي مبيعات تاريخية</div><div class="v">${fmtInt(totalHistoricalSales)} ج.م</div></div>
        <div class="card"><div class="k">متوسط مدة التوقف</div><div class="v">${avgDays} يوم</div></div>
      </div>
      <table>
        <thead><tr><th>#</th><th>الأولوية</th><th>العميل</th><th>إجمالي المبيعات التاريخية</th><th>آخر فاتورة بيع</th><th>مدة التوقف</th><th>التحصيل %</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="muted" style="margin-top:14px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.7">
        <div>• تاريخ ووقت إنشاء التقرير: ${new Date().toLocaleString("ar-EG")}</div>
        <div>• تم احتساب الركود بناءً على آخر فاتورة بيع فعلية.</div>
        <div>• تم استبعاد جميع العملاء الذين اشتروا خلال آخر 60 يوم.</div>
        <div>• الأرصدة السالبة (دائن) تُعرض كما هي ولا تُعتبر مديونية.</div>
        <div>• تم ترتيب العملاء حسب الأولوية ثم القيمة التاريخية.</div>
      </div>`;
    printHtml(`تقرير الراكدين — ${scopeLabel}`, html, { orientation: "landscape" });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">تقرير العملاء الراكدين</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            العميل الراكد = آخر فاتورة بيع مضى عليها 60 يوم أو أكثر. النطاق: {scopeLabel} · تاريخ الاحتساب:{" "}
            {refDate.toLocaleDateString("ar-EG")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="ms-1 h-4 w-4" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={printCurrent}>
            <Printer className="ms-1 h-4 w-4" /> طباعة / PDF
          </Button>
        </div>
      </header>

      {/* Scope selector */}
      <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm md:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-bold text-muted-foreground">النطاق الزمني</div>
          <div className="inline-flex rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => setScopeKind("all")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold transition",
                scopeKind === "all" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground",
              )}
            >
              كل السنوات (حتى اليوم)
            </button>
            <button
              onClick={() => setScopeKind("year")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-bold transition",
                scopeKind === "year" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground",
              )}
            >
              سنة محددة
            </button>
          </div>
        </div>
        {scopeKind === "year" && (
          <div>
            <div className="mb-2 text-xs font-bold text-muted-foreground">اختر السنة</div>
            <div className="inline-flex rounded-lg border border-border bg-background p-1">
              {meta.years.map((y) => (
                <button
                  key={y}
                  onClick={() => setScopeYear(y)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-bold transition",
                    scopeYear === y ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <KpiCard label="إجمالي الراكدين" value={fmtInt(allStagnant.length)} tone="destructive" icon={<AlertTriangle className="h-5 w-5" />} />
        <KpiCard label="🔴 أولوية عالية" value={fmtInt(groups.high)} hint="60 – 180 يوم" tone="destructive" />
        <KpiCard label="🟡 أولوية متوسطة" value={fmtInt(groups.med)} hint="181 – 540 يوم" tone="warning" />
        <KpiCard label="⚪ أولوية منخفضة" value={fmtInt(groups.low)} hint="> 540 يوم" tone="muted" />
        <KpiCard label="إجمالي المبيعات التاريخية" value={fmtEGP(totalHistoricalSales)} tone="info" />
        <KpiCard label="متوسط مدة التوقف" value={`${avgDays} يوم`} tone="primary" />
      </div>

      <Section
        title="قائمة العملاء الراكدين"
        description="مرتبة حسب الأولوية والقيمة التاريخية — اضغط أي عمود للترتيب"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="ابحث بالاسم أو الكود…"
              className="w-56"
            />
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              {(["all", "high", "med", "low"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPriorityFilter(p);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-bold transition",
                    priorityFilter === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p === "all" ? "الكل" : priorityLabel(p)}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-right font-semibold">#</th>
                <Th onClick={() => toggleSort("priority")} active={sortKey === "priority"}>الأولوية</Th>
                <Th onClick={() => toggleSort("name")} active={sortKey === "name"}>العميل</Th>
                <Th onClick={() => toggleSort("sales")} active={sortKey === "sales"} align="right">إجمالي المبيعات التاريخية</Th>
                <Th onClick={() => toggleSort("lastSale")} active={sortKey === "lastSale"}>آخر فاتورة بيع</Th>
                <Th onClick={() => toggleSort("days")} active={sortKey === "days"}>مدة التوقف</Th>
                <Th onClick={() => toggleSort("rate")} active={sortKey === "rate"} align="right">التحصيل %</Th>
                <th className="px-3 py-2 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.c.code} className="border-t border-border hover:bg-muted/40">
                  <td className="px-3 py-2 num text-xs text-muted-foreground">{(page - 1) * perPage + i + 1}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                        r.priority === "high"
                          ? "bg-status-stagnant/10 text-status-stagnant"
                          : r.priority === "med"
                            ? "bg-status-atrisk/10 text-status-atrisk"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {priorityEmoji(r.priority)} {priorityLabel(r.priority)}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    <div>{r.c.name}</div>
                    <div className="text-[10px] text-muted-foreground">{r.c.code}</div>
                  </td>
                  <td className="px-3 py-2 num">{fmtInt(r.historicalSales)}</td>
                  <td className="px-3 py-2 text-xs">
                    {ARABIC_MONTHS[r.lastSaleDate.getMonth()]} {r.lastSaleDate.getFullYear()}
                  </td>
                  <td className="px-3 py-2 text-xs">{formatDays(r.days)}</td>
                  <td className="px-3 py-2 num">{fmtPct(r.collectionRate)}</td>
                  <td className="px-3 py-2 text-center">
                    <Link to="/customers" search={{ code: r.c.code }} className="text-xs font-semibold text-primary hover:underline">
                      تفاصيل
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    لا يوجد عملاء راكدون ضمن المعايير المحددة
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              <ChevronRight className="h-4 w-4" /> السابق
            </Button>
            <div className="text-xs text-muted-foreground">
              صفحة {page} من {pages}
            </div>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages}>
              التالي <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
          <div>• تاريخ ووقت إنشاء التقرير: {new Date().toLocaleString("ar-EG")}</div>
          <div>• تم احتساب الركود بناءً على آخر فاتورة بيع فعلية.</div>
          <div>• تم استبعاد جميع العملاء الذين اشتروا خلال آخر 60 يوم.</div>
          <div>• الأرصدة السالبة (دائن) تُعرض كما هي ولا تُعتبر مديونية.</div>
          <div>• تم ترتيب العملاء حسب الأولوية ثم القيمة التاريخية.</div>
        </div>
      </Section>

      <Section title="التنبيهات الذكية">
        <SmartTags rows={allStagnant} />
      </Section>
    </div>
  );
}

function Th({
  children,
  onClick,
  active,
  align = "right",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  align?: "right" | "center";
}) {
  return (
    <th className={cn("px-3 py-2 font-semibold", align === "right" ? "text-right" : "text-center")}>
      <button
        onClick={onClick}
        className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-60" />
      </button>
    </th>
  );
}

function SmartTags({ rows }: { rows: StagnantRow[] }) {
  const tags = useMemo(() => {
    const out: Array<{ icon: string; text: string; row: StagnantRow }> = [];
    for (const r of rows) {
      if (r.days <= 90 && r.historicalSales >= 500_000) out.push({ icon: "🟢", text: "مبيعاته التاريخية كبيرة وتوقف مؤخراً — متابعة عاجلة", row: r });
      else if (r.balance > 0 && r.days >= 180) out.push({ icon: "🟡", text: "رصيده مرتفع ولم يشترِ منذ فترة طويلة", row: r });
      else if (r.days > 365 && r.historicalSales >= 300_000) out.push({ icon: "🔴", text: "توقف أكثر من سنة وكان من كبار العملاء", row: r });
      else if (r.collectionRate >= 90 && r.historicalSales >= 100_000) out.push({ icon: "⭐", text: "نسبة تحصيله ممتازة ويمكن استرجاعه بسهولة", row: r });
    }
    return out.slice(0, 12);
  }, [rows]);
  if (tags.length === 0) return <div className="text-sm text-muted-foreground">لا توجد تنبيهات.</div>;
  return (
    <ul className="grid gap-2 md:grid-cols-2">
      {tags.map((t, i) => (
        <li key={i} className="rounded-lg border border-border bg-card p-3 text-sm">
          <div className="font-semibold">
            {t.icon} {t.row.c.name}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{t.text}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {fmtEGP(t.row.historicalSales)} · متوقف {formatDays(t.row.days)} · تحصيل {fmtPct(t.row.collectionRate)}
          </div>
        </li>
      ))}
    </ul>
  );
}
