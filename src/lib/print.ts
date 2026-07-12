/** Open a new window with scoped, printable HTML — avoids fighting app CSS. */
export function printHtml(title: string, bodyHtml: string, opts?: { orientation?: "portrait" | "landscape" }) {
  const w = window.open("", "_blank", "width=1024,height=768");
  if (!w) {
    alert("لم يُفتح نافذة الطباعة — تأكد من السماح بالنوافذ المنبثقة.");
    return;
  }
  const orientation = opts?.orientation ?? "portrait";
  const css = `
    @page { size: A4 ${orientation}; margin: 12mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; direction: rtl; font-family: "Cairo", "Segoe UI", Tahoma, sans-serif; color: #111; }
    body { padding: 8px 4px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 15px; margin: 16px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #1e3a8a; color: #1e3a8a; }
    p, li { font-size: 12px; line-height: 1.55; }
    .muted { color: #666; font-size: 11px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px; }
    .brand { font-weight: 800; font-size: 16px; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
    th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: right; }
    th { background: #1e3a8a; color: #fff; font-weight: 700; }
    tbody tr:nth-child(even) td { background: #f7f9fc; }
    .num { font-variant-numeric: tabular-nums; }
    .sev-high { background: #fee2e2 !important; }
    .sev-med { background: #fef3c7 !important; }
    .sev-low { background: #ecfeff !important; }
    .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .pill-red { background: #fee2e2; color: #991b1b; }
    .pill-amber { background: #fef3c7; color: #92400e; }
    .pill-green { background: #dcfce7; color: #166534; }
    .pill-gray { background: #e5e7eb; color: #374151; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 10px; }
    .card .k { font-size: 10px; color: #666; }
    .card .v { font-size: 15px; font-weight: 800; margin-top: 2px; }
    .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #666; text-align: center; }
    @media print { .no-print { display: none !important; } }
  `;
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap"><style>${css}</style></head><body>${bodyHtml}<div class="footer">تم إنشاء هذا التقرير آلياً بواسطة منصّة المبيعات والمقبوضات — ${new Date().toLocaleDateString("ar-EG")}</div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),350));</script></body></html>`);
  w.document.close();
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
