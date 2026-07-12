import * as XLSX from "xlsx";
import { nameKey } from "./name-key";

export type SalesRow = {
  code: string;
  name: string;
  nameKey: string;
  year: number;
  monthly: number[];
  total: number;
};

export type CollectionRow = {
  name: string;
  nameKey: string;
  year: number;
  monthly: number[];
  total: number;
};

const TOTAL_HINTS = ["اجمالي", "الاجمالي", "الإجمالى", "الإجمالي", "total", "grand total"];

function isTotalRow(a: string, b: string): boolean {
  const t = `${a} ${b}`.toLowerCase();
  return TOTAL_HINTS.some((h) => t.includes(h.toLowerCase()));
}

/** True when a cell is empty, "nan", or purely dashes/underscores/dots/spaces (visual separator). */
function isDashLike(v: string): boolean {
  const s = v.trim();
  if (!s) return true;
  if (s.toLowerCase() === "nan") return true;
  // Arabic/latin dashes, underscores, en/em dashes, hyphens, dots — any combination
  return /^[-_\u2010-\u2015\u2212.\s]+$/.test(s);
}

function toNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "string" && isDashLike(v)) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}

/** Parses "تقرير مبيعات الاصناف سنوي" — expected header row at index 2:
 *  [Code, البيان, يناير..ديسمبر, مجموع]. Data from row index 3+. */
export function parseSalesWorkbook(buf: ArrayBuffer, year: number): SalesRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const out: SalesRow[] = [];
  for (let r = 3; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 3) continue;
    const code = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    // Ignore visual separator rows from the source Excel (e.g. "----" placeholders
    // that aren't real customers, just aesthetic dividers between number groups).
    if (isDashLike(code) && isDashLike(name)) continue;
    if (isDashLike(code)) continue;
    if (!code || code.toLowerCase() === "nan") continue;
    if (isTotalRow(code, name)) continue;
    const monthly: number[] = [];
    for (let m = 0; m < 12; m++) monthly.push(toNum(row[2 + m]));
    const total = monthly.reduce((a, b) => a + b, 0);
    if (total === 0 && !monthly.some((v) => v !== 0)) continue;
    out.push({ code, name, nameKey: nameKey(name), year, monthly, total });
  }
  return out;
}

/** Parses "تقرير تحصيلات العملاء سنوي" — expected header row at index 1:
 *  [الاسم, يناير..ديسمبر]. Data from row index 2+. */
export function parseCollectionsWorkbook(buf: ArrayBuffer, year: number): CollectionRow[] {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const out: CollectionRow[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length < 2) continue;
    const name = String(row[0] ?? "").trim();
    // Ignore visual separator rows ("----" placeholders that are just number
    // aggregation dividers, not real customers).
    if (isDashLike(name)) continue;
    if (!name || name.toLowerCase() === "nan") continue;
    if (isTotalRow(name, "")) continue;
    const monthly: number[] = [];
    for (let m = 0; m < 12; m++) monthly.push(toNum(row[1 + m]));
    const total = monthly.reduce((a, b) => a + b, 0);
    if (total === 0) continue;
    out.push({ name, nameKey: nameKey(name), year, monthly, total });
  }
  return out;
}

/** Guess year from filename: contains 2024/2025/2026. */
export function guessYear(fileName: string): number | null {
  const m = fileName.match(/20\d{2}/);
  return m ? Number(m[0]) : null;
}

/** Guess kind (sales vs collections) from filename. */
export function guessKind(fileName: string): "sales" | "collections" | null {
  const n = fileName.toLowerCase();
  if (n.includes("مبيعات") || n.includes("sales")) return "sales";
  if (n.includes("مقبوض") || n.includes("تحصيل") || n.includes("collect") || n.includes("payment")) return "collections";
  return null;
}
