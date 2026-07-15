type PrintOptions = {
  orientation?: "portrait" | "landscape";
  subtitle?: string;
  autoPrint?: boolean;
};

const BRAND = "منصّة المبيعات والمقبوضات";

/** Open a clean A4 report window with scoped print CSS — not a screenshot of the app UI. */
export function printHtml(title: string, bodyHtml: string, opts?: PrintOptions) {
  const w = window.open("", "_blank", "width=1280,height=900");
  if (!w) {
    alert("لم يُفتح نافذة الطباعة — تأكد من السماح بالنوافذ المنبثقة.");
    return;
  }
  const orientation = opts?.orientation ?? "portrait";
  const generatedAt = new Date().toLocaleString("ar-EG");
  const subtitle = opts?.subtitle ? `<div class="report-subtitle">${escapeHtml(opts.subtitle)}</div>` : "";
  const css = `
    @page { size: A4 ${orientation}; margin: 9mm 9mm 11mm; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      direction: rtl;
      font-family: "Cairo", "Segoe UI", Tahoma, sans-serif;
      color: #122524;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body { font-size: 10px; line-height: 1.45; }
    .report-page { width: 100%; }
    .report-cover {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      align-items: end;
      padding: 0 0 8px;
      margin: 0 0 10px;
      border-bottom: 3px solid #2BA8A2;
    }
    .report-kicker { font-size: 8.5px; font-weight: 800; color: #1E8C86; letter-spacing: 0; }
    .report-title { margin-top: 2px; font-size: 18px; line-height: 1.25; font-weight: 900; color: #0f2423; }
    .report-subtitle { margin-top: 2px; font-size: 10px; color: #5b6b6b; font-weight: 700; }
    .report-meta { text-align: left; font-size: 9px; color: #5b6b6b; white-space: nowrap; }
    h1 { font-size: 17px; margin: 0 0 5px; line-height: 1.25; font-weight: 900; color: #0f2423; }
    h2 { font-size: 13px; margin: 12px 0 7px; padding: 0 0 5px; border-bottom: 2px solid #2BA8A2; color: #1E8C86; font-weight: 900; break-after: avoid; }
    h3 { font-size: 11px; margin: 8px 0 5px; color: #0f2423; font-weight: 900; break-after: avoid; }
    p, li { font-size: 9.5px; line-height: 1.55; }
    .muted { color: #5b6b6b; font-size: 9px; }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 18px;
      border: 1px solid #cfe4e2;
      border-right: 5px solid #2BA8A2;
      border-radius: 8px;
      background: #EFF8F7;
      padding: 9px 11px;
      margin: 0 0 10px;
      break-inside: avoid;
    }
    .brand { font-weight: 900; font-size: 15px; color: #1E8C86; }
    table { width: 100%; border-collapse: collapse; font-size: 8.7px; margin-top: 5px; page-break-inside: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th, td { padding: 4.5px 5px; border: 1px solid #cfe4e2; text-align: right; vertical-align: middle; }
    th { background: #1E8C86; color: #fff; font-weight: 900; font-size: 8.5px; }
    tbody tr:nth-child(even) td { background: #f4fbfa; }
    .num { font-variant-numeric: tabular-nums; }
    .sev-high { background: #fee2e2 !important; }
    .sev-med { background: #fef3c7 !important; }
    .sev-low { background: #ecfeff !important; }
    .pill { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 8.5px; font-weight: 900; }
    .pill-red { background: #fee2e2; color: #991b1b; }
    .pill-amber { background: #fef3c7; color: #92400e; }
    .pill-green { background: #dcfce7; color: #166534; }
    .pill-gray { background: #e5e7eb; color: #374151; }
    .grid-2, .grid-3, .grid-4 { display: grid; gap: 7px; margin: 7px 0 10px; break-inside: avoid; }
    .grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .card {
      border: 1px solid #cfe4e2;
      border-right: 4px solid #2BA8A2;
      border-radius: 7px;
      padding: 7px 9px;
      background: #fff;
      min-height: 44px;
      break-inside: avoid;
    }
    .card .k { font-size: 8.5px; color: #5b6b6b; font-weight: 800; }
    .card .v { font-size: 13px; font-weight: 900; margin-top: 2px; color: #0f2423; }
    .footer { margin-top: 12px; padding-top: 6px; border-top: 1px solid #cfe4e2; font-size: 8.5px; color: #5b6b6b; text-align: center; }

    /* Generic styling for cloned dashboard pages */
    .screen-report { width: 100%; }
    .screen-report > header,
    .screen-report [class*="space-y-6"] > header {
      margin: 0 0 8px;
      padding: 0 0 7px;
      border-bottom: 2px solid #2BA8A2;
      break-after: avoid;
    }
    .screen-report section {
      border: 1px solid #cfe4e2;
      border-radius: 8px;
      background: #fff;
      margin: 0 0 8px;
      overflow: hidden;
      break-inside: avoid;
    }
    .screen-report section > header {
      display: block;
      padding: 6px 9px;
      background: #EFF8F7;
      border-bottom: 1.5px solid #2BA8A2;
    }
    .screen-report section > header h2 { margin: 0; padding: 0; border: 0; font-size: 11px; }
    .screen-report section > header p { margin: 2px 0 0; color: #5b6b6b; }
    .screen-report section > div { padding: 7px 9px; }
    .screen-report [class*="grid"] { display: grid; gap: 7px; }
    .screen-report [class*="grid-cols-6"],
    .screen-report [class*="grid-cols-5"],
    .screen-report [class*="grid-cols-4"],
    .screen-report [class*="lg:grid-cols-6"],
    .screen-report [class*="lg:grid-cols-5"],
    .screen-report [class*="lg:grid-cols-4"],
    .screen-report [class*="sm:grid-cols-2"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .screen-report [class*="grid-cols-3"],
    .screen-report [class*="lg:grid-cols-3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .screen-report [class*="grid-cols-2"],
    .screen-report [class*="md:grid-cols-2"] { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .screen-report [class*="rounded-2xl"][class*="border"],
    .screen-report [class*="rounded-xl"][class*="border"],
    .screen-report [class*="rounded-lg"][class*="border"] {
      border: 1px solid #cfe4e2;
      border-radius: 7px;
      background: #fff;
      box-shadow: none;
      padding: 7px 9px;
      break-inside: avoid;
    }
    .screen-report [class*="text-3xl"] { font-size: 15px; line-height: 1.25; font-weight: 900; }
    .screen-report [class*="text-2xl"] { font-size: 16px; line-height: 1.25; font-weight: 900; }
    .screen-report [class*="text-xl"] { font-size: 13px; line-height: 1.25; font-weight: 900; }
    .screen-report [class*="text-lg"] { font-size: 11px; line-height: 1.3; font-weight: 900; }
    .screen-report [class*="text-sm"] { font-size: 9.5px; }
    .screen-report [class*="text-xs"], .screen-report [class*="text-[11px]"], .screen-report [class*="text-[10px]"] { font-size: 8.5px; }
    .screen-report [class*="text-muted-foreground"] { color: #5b6b6b; }
    .screen-report [class*="text-primary"] { color: #1E8C86; }
    .screen-report [class*="text-status-active"] { color: #0f7a3e; }
    .screen-report [class*="text-status-atrisk"] { color: #8a6a00; }
    .screen-report [class*="text-status-stagnant"], .screen-report [class*="text-destructive"] { color: #b3421f; }
    .screen-report [class*="overflow"] { overflow: visible !important; }
    .screen-report [class*="max-h"] { max-height: none !important; }
    .screen-report .recharts-responsive-container,
    .screen-report .recharts-wrapper { width: 100% !important; height: 185px !important; max-height: 185px !important; }
    .screen-report .recharts-surface { max-width: 100%; height: 185px; overflow: visible; }
    .screen-report .recharts-tooltip-wrapper { display: none; }
    .screen-report svg { max-width: 100%; }
    .screen-report img { max-width: 100%; height: auto; }
    .screen-report a { color: inherit; text-decoration: none; }
    .screen-report ul { margin: 5px 0; padding-inline-start: 18px; }
    .screen-report .no-print,
    .screen-report .print-hide,
    .screen-report button,
    .screen-report input,
    .screen-report select,
    .screen-report textarea,
    .screen-report [role="tablist"],
    .screen-report [role="tab"] { display: none !important; }

    @media print {
      .no-print, .print-hide, button, input, select, textarea { display: none !important; }
      h1, h2, h3, section, .card { break-inside: avoid; }
      body { width: 100%; }
    }
  `;
  const script = opts?.autoPrint === false
    ? ""
    : "<script>window.addEventListener('load',()=>setTimeout(()=>{window.focus();window.print();},450));</script>";
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap"><style>${css}</style></head><body><main class="report-page"><div class="report-cover"><div><div class="report-kicker">${BRAND}</div><div class="report-title">${escapeHtml(title)}</div>${subtitle}</div><div class="report-meta">${escapeHtml(generatedAt)}</div></div>${bodyHtml}<div class="footer">تم إنشاء هذا التقرير آلياً بواسطة ${BRAND}</div></main>${script}</body></html>`);
  w.document.close();
}

export function printCurrentPageReport(title: string, opts?: PrintOptions) {
  const source = document.querySelector<HTMLElement>("[data-print-root]") ?? document.querySelector<HTMLElement>("main");
  if (!source) {
    alert("لا يوجد محتوى قابل للطباعة في الصفحة الحالية.");
    return;
  }

  const clone = source.cloneNode(true) as HTMLElement;
  sanitizePrintClone(clone);
  const subtitle = opts?.subtitle ?? currentPageSubtitle(clone);
  printHtml(title, `<div class="screen-report">${clone.innerHTML}</div>`, {
    orientation: opts?.orientation ?? "landscape",
    subtitle,
    autoPrint: opts?.autoPrint,
  });
}

function sanitizePrintClone(root: HTMLElement) {
  root
    .querySelectorAll(
      '.no-print, .print-hide, script, style, button, input, select, textarea, [role="tablist"], [role="tab"], [data-sonner-toaster], [role="dialog"], [role="alertdialog"]',
    )
    .forEach((el) => el.remove());

  root.querySelectorAll("a").forEach((a) => {
    a.removeAttribute("href");
    a.removeAttribute("target");
  });

  root.querySelectorAll("svg").forEach((svg) => {
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.removeAttribute("tabindex");
  });
}

function currentPageSubtitle(root: HTMLElement): string {
  const paragraph = root.querySelector("header p")?.textContent?.trim();
  return paragraph ? paragraph.replace(/\s+/g, " ") : "تقرير ديناميكي من بيانات الصفحة الحالية";
}

export function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
