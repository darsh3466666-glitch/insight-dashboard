import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, Printer } from "lucide-react";
import { useCustomers, useDataStore } from "@/lib/store";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { fmtInt, fmtPct } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/customer-model";
import { escapeHtml, printHtml } from "@/lib/print";


export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "التقارير — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "تصدير التقارير الاحترافية لعرضها على الإدارة." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const customers = useCustomers();
  const meta = useDataStore((s) => s.meta);
  const [busy, setBusy] = useState(false);

  function exportExcel() {
    setBusy(true);
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Summary per year
      let cumulativeBalance = 0;
      const summary = meta.years.slice().sort().map((y) => {
        const sales = customers.reduce((a, c) => a + (c.salesByYear[y] ?? 0), 0);
        const collections = customers.reduce((a, c) => a + (c.collectionsByYear[y] ?? 0), 0);
        cumulativeBalance += sales - collections;
        const active = customers.filter((c) => (c.salesByYear[y] ?? 0) > 0).length;
        return {
          "السنة": y,
          "إجمالي المبيعات": Math.round(sales),
          "إجمالي المقبوضات": Math.round(collections),
          "الرصيد التراكمي": Math.round(cumulativeBalance),
          "نسبة التحصيل %": sales > 0 ? +((collections / sales) * 100).toFixed(2) : 0,
          "عدد العملاء النشطين": active,
        };
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "الملخص التنفيذي");

      // Sheet 2: Customers Master
      const master = customers
        .map((c) => ({
          "الكود": c.code,
          "اسم العميل": c.name,
          "تصنيف ABC": c.abc,
          "الحالة الإجمالية": STATUS_LABEL[c.statusOverall],
          ...Object.fromEntries(
            meta.years.flatMap((y) => [
              [`مبيعات ${y}`, Math.round(c.salesByYear[y] ?? 0)],
              [`مقبوضات ${y}`, Math.round(c.collectionsByYear[y] ?? 0)],
              [`حالة ${y}`, STATUS_LABEL[c.statusByYear[y] ?? "inactive"]],
            ]),
          ),
          "إجمالي المبيعات": Math.round(c.salesAll),
          "إجمالي المقبوضات": Math.round(c.collectionsAll),
          "الرصيد التراكمي": Math.round(c.balanceAll),
          "نسبة التحصيل %": +c.collectionRateAll.toFixed(2),
        }))
        .sort((a, b) => (b["إجمالي المبيعات"] as number) - (a["إجمالي المبيعات"] as number));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(master), "بيانات العملاء");

      // Sheet 3: Stagnant list
      const stagnant = customers
        .filter((c) => c.statusOverall === "stagnant" || c.statusOverall === "atrisk")
        .sort((a, b) => b.salesAll - a.salesAll)
        .map((c) => ({
          "الكود": c.code,
          "الاسم": c.name,
          "الحالة": STATUS_LABEL[c.statusOverall],
          "إجمالي البيع": Math.round(c.salesAll),
          "الرصيد": Math.round(c.balanceAll),
          "آخر بيع": c.lastSale ? `${c.lastSale.year}/${c.lastSale.month + 1}` : "—",
          "آخر تحصيل": c.lastCollection ? `${c.lastCollection.year}/${c.lastCollection.month + 1}` : "—",
        }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stagnant), "الراكدين والمتعثرين");

      XLSX.writeFile(wb, `تقرير_المبيعات_والمقبوضات_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("تم تصدير ملف Excel");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل التصدير");
    } finally {
      setBusy(false);
    }
  }

  function printReport() {
    const title = "تقرير المبيعات والمقبوضات";
    const topCustomers = customers
      .slice()
      .sort((a, b) => b.salesAll - a.salesAll)
      .slice(0, 20)
      .map(
        (c, i) => `<tr>
          <td class="num">${i + 1}</td>
          <td>${escapeHtml(c.name)}<div class="muted">${escapeHtml(c.code)}</div></td>
          <td>${c.abc}</td>
          <td><span class="pill pill-${c.statusOverall === "active" ? "green" : c.statusOverall === "atrisk" ? "amber" : c.statusOverall === "stagnant" ? "red" : "gray"}">${STATUS_LABEL[c.statusOverall]}</span></td>
          <td class="num">${fmtInt(c.salesAll)}</td>
          <td class="num">${fmtInt(c.collectionsAll)}</td>
          <td class="num">${fmtInt(c.balanceAll)}</td>
          <td class="num">${fmtPct(c.collectionRateAll)}</td>
        </tr>`,
      )
      .join("");

    const summaryRows = kpiRows
      .map(
        (r) => `<tr>
          <td class="num"><strong>${r.y}</strong></td>
          <td class="num">${fmtInt(r.sales)}</td>
          <td class="num">${fmtInt(r.collections)}</td>
          <td class="num">${fmtInt(r.balance)}</td>
          <td class="num">${fmtPct(r.rate)}</td>
        </tr>`,
      )
      .join("");

    const html = `
      <div class="grid-4">
        <div class="card"><div class="k">عدد سنوات التقرير</div><div class="v">${meta.years.length}</div></div>
        <div class="card"><div class="k">عدد العملاء</div><div class="v">${fmtInt(customers.length)}</div></div>
        <div class="card"><div class="k">إجمالي المبيعات</div><div class="v">${fmtInt(customers.reduce((a, c) => a + c.salesAll, 0))} ج.م</div></div>
        <div class="card"><div class="k">إجمالي المقبوضات</div><div class="v">${fmtInt(customers.reduce((a, c) => a + c.collectionsAll, 0))} ج.م</div></div>
      </div>
      <h2>ملخّص السنوات</h2>
      <table>
        <thead><tr><th>السنة</th><th>المبيعات</th><th>المقبوضات</th><th>الرصيد التراكمي</th><th>نسبة التحصيل</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
      <h2>أعلى العملاء بالمبيعات</h2>
      <table>
        <thead><tr><th>#</th><th>العميل</th><th>ABC</th><th>الحالة</th><th>المبيعات</th><th>المقبوضات</th><th>الرصيد</th><th>التحصيل %</th></tr></thead>
        <tbody>${topCustomers}</tbody>
      </table>
    `;
    printHtml(title, html, {
      orientation: "landscape",
      subtitle: `الفترة ${meta.years[0]}–${meta.years[meta.years.length - 1]} · تقرير إداري منسق للطباعة`,
    });
  }

    let cumulativeBalance = 0;
    const kpiRows = meta.years.slice().sort().map((y) => {
    const sales = customers.reduce((a, c) => a + (c.salesByYear[y] ?? 0), 0);
    const collections = customers.reduce((a, c) => a + (c.collectionsByYear[y] ?? 0), 0);
      cumulativeBalance += sales - collections;
      return { y, sales, collections, balance: cumulativeBalance, rate: sales > 0 ? (collections / sales) * 100 : 0 };
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">التقارير القابلة للتصدير</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          تحميل بيانات كاملة على شكل Excel، أو طباعة تقرير احترافي للإدارة.
        </p>
      </header>

      <Section title="تصدير سريع">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-8 w-8 text-status-active" />
              <div>
                <div className="font-bold">تقرير Excel شامل</div>
                <div className="text-xs text-muted-foreground">3 شيتات: ملخّص تنفيذي، ماستر عملاء، والراكدين</div>
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={exportExcel} disabled={busy}>
              تنزيل ملف Excel
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-background p-5">
            <div className="flex items-center gap-3">
              <Printer className="h-8 w-8 text-primary" />
              <div>
                <div className="font-bold">طباعة / تصدير PDF</div>
                <div className="text-xs text-muted-foreground">استخدم "حفظ كـ PDF" من نافذة الطباعة</div>
              </div>
            </div>
            <Button variant="outline" className="mt-4 w-full" onClick={printReport}>
              فتح نافذة الطباعة
            </Button>
          </div>
        </div>
      </Section>

      <Section title="ملخّص تنفيذي — قابل للطباعة" description="عرض متكامل بالأرقام الرئيسية">
        <div className="print:break-inside-avoid">
          <div className="mb-4 border-b border-border pb-3">
            <h2 className="text-xl md:text-2xl font-black">تقرير المبيعات والمقبوضات — {meta.currentYear}</h2>
            <p className="text-xs text-muted-foreground">
              تاريخ الإصدار: {new Date().toLocaleDateString("ar-EG")} — يغطي الفترة {meta.years[0]}–{meta.years[meta.years.length - 1]}
            </p>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                <th className="px-3 py-2 text-right font-bold">السنة</th>
                <th className="px-3 py-2 text-right font-bold">المبيعات</th>
                <th className="px-3 py-2 text-right font-bold">المقبوضات</th>
                <th className="px-3 py-2 text-right font-bold">الرصيد التراكمي</th>
                <th className="px-3 py-2 text-right font-bold">نسبة التحصيل</th>
              </tr>
            </thead>
            <tbody>
              {kpiRows.map((r) => (
                <tr key={r.y} className="border-b border-border">
                  <td className="px-3 py-2 font-bold">{r.y}</td>
                  <td className="px-3 py-2 num">{fmtInt(r.sales)}</td>
                  <td className="px-3 py-2 num">{fmtInt(r.collections)}</td>
                  <td className="px-3 py-2 num">{fmtInt(r.balance)}</td>
                  <td className="px-3 py-2 num">{fmtPct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
