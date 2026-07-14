import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { Upload as UploadIcon, FileCheck2, AlertCircle, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  guessKind,
  guessYear,
  parseCollectionsWorkbook,
  parseSalesWorkbook,
} from "@/lib/parser";
import { useDataStore } from "@/lib/store";
import { Section } from "@/components/Section";
import { Button } from "@/components/ui/button";
import { fmtInt } from "@/lib/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رفع البيانات — منصّة المبيعات والمقبوضات" },
      { name: "description", content: "رفع شيتات المبيعات والمقبوضات السنوية للتحليل." },
    ],
  }),
  component: UploadPage,
});

type Detected = {
  file: File;
  kind: "sales" | "collections" | null;
  year: number | null;
  ok: boolean;
  status: "pending" | "done" | "error";
  message?: string;
  count?: number;
};

function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Detected[]>([]);
  const [busy, setBusy] = useState(false);
  const store = useDataStore();

  const stats = useMemo(() => {
    const salesYears = new Set(store.sales.map((r) => r.year));
    const colYears = new Set(store.collections.map((r) => r.year));
    return {
      salesRows: store.sales.length,
      colRows: store.collections.length,
      salesYears: [...salesYears].sort(),
      colYears: [...colYears].sort(),
    };
  }, [store.sales, store.collections]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const detected: Detected[] = Array.from(files).map((file) => ({
      file,
      kind: guessKind(file.name),
      year: guessYear(file.name),
      ok: false,
      status: "pending",
    }));
    setItems((prev) => [...prev, ...detected]);
  }

  async function processAll() {
    setBusy(true);
    const next = items.slice();
    for (let i = 0; i < next.length; i++) {
      const item = next[i];
      if (item.status === "done") continue;
      if (!item.kind || !item.year) {
        item.status = "error";
        item.message = "تعذّر التعرّف على نوع الملف أو السنة من اسمه";
        continue;
      }
      try {
        const buf = await item.file.arrayBuffer();
        if (item.kind === "sales") {
          const rows = parseSalesWorkbook(buf, item.year);
          store.replaceYear("sales", item.year, rows);
          item.count = rows.length;
        } else {
          const rows = parseCollectionsWorkbook(buf, item.year);
          store.replaceYear("collections", item.year, rows);
          item.count = rows.length;
        }
        item.status = "done";
        item.ok = true;
      } catch (err) {
        item.status = "error";
        item.message = err instanceof Error ? err.message : "خطأ في قراءة الملف";
      }
      setItems([...next]);
    }
    setBusy(false);
    toast.success("تم تحديث البيانات");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">رفع البيانات المصدرية</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          البيانات الحالية محمّلة تلقائياً من شيتات 2024–2026. تقدر ترفع ملفات جديدة تحل محل السنة المطابقة.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="عدد سطور المبيعات المحفوظة" value={fmtInt(stats.salesRows)} sub={`سنوات: ${stats.salesYears.join("، ") || "—"}`} />
        <StatCard label="عدد سطور المقبوضات المحفوظة" value={fmtInt(stats.colRows)} sub={`سنوات: ${stats.colYears.join("، ") || "—"}`} />
        <StatCard
          label="مصدر البيانات"
          value={store.hasCustomData ? "ملفات مستخدم" : "بيانات مصدرية"}
          sub={store.hasCustomData ? "ملفات مرفوعة من الجهاز" : "شيتات 2024–2026 المرفقة"}
        />
      </div>

      <Section
        title="ارفع ملفات إكسل (مبيعات / مقبوضات)"
        description="تسمية الملف يفضّل تحتوي على السنة و‏‎(‎مبيعات / مقبوضات‎)‎ حتى يتم التصنيف تلقائياً."
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("سيتم مسح كل بيانات المبيعات والمقبوضات المرفوعة. هل أنت متأكد؟")) {
                  store.clearAll();
                  setItems([]);
                }
              }}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              مسح كل البيانات
            </Button>
          </div>
        }
      >
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 py-10 text-center transition hover:border-primary hover:bg-primary/5"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFiles(e.dataTransfer.files);
          }}
        >
          <UploadIcon className="h-10 w-10 text-primary" />
          <div className="mt-3 font-semibold">اسحب الملفات هنا أو اضغط للاختيار</div>
          <div className="mt-1 text-xs text-muted-foreground">.xlsx / .xls — يدعم الاختيار المتعدد</div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {items.length > 0 && (
          <div className="mt-5 space-y-2">
            {items.map((it, i) => (
              <div
                key={i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {it.status === "done" ? (
                    <FileCheck2 className="h-4 w-4 shrink-0 text-status-active" />
                  ) : it.status === "error" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 text-status-stagnant" />
                  ) : (
                    <FileCheck2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate font-medium">{it.file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {it.kind === "sales" ? "مبيعات" : it.kind === "collections" ? "مقبوضات" : "غير معروف"} · {it.year ?? "—"}
                  </span>
                </div>
                <div className="text-xs">
                  {it.status === "done" && <span className="text-status-active">{fmtInt(it.count ?? 0)} صف</span>}
                  {it.status === "error" && <span className="text-status-stagnant">{it.message}</span>}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setItems([])} disabled={busy}>
                <Trash2 className="mr-1 h-4 w-4" />
                مسح القائمة
              </Button>
              <Button onClick={processAll} disabled={busy || items.every((i) => i.status === "done")}>
                معالجة الملفات
              </Button>
            </div>
          </div>
        )}
      </Section>

      <Section title="ابدأ التحليل" description="بعد التأكد من البيانات، افتح واحدة من الصفحات التالية:">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: "/executive", label: "الملخّص التنفيذي" },
            { to: "/sales", label: "تحليل المبيعات" },
            { to: "/collections", label: "تحليل المقبوضات" },
            { to: "/customers", label: "رحلة العميل 360°" },
            { to: "/stagnation", label: "تحليل الراكدين" },
            { to: "/reports", label: "التقارير القابلة للتصدير" },
          ].map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-semibold transition hover:border-primary hover:bg-primary/5"
            >
              {n.label} ←
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
