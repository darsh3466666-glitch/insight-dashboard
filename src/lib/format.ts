export const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export function fmtInt(n: number): string {
  if (!isFinite(n)) return "0";
  return nf0.format(Math.round(n));
}

export function fmtEGP(n: number): string {
  return `${fmtInt(n)} ج.م`;
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${nf1.format(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${nf1.format(n / 1_000)}K`;
  return fmtInt(n);
}

export function fmtPct(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function fmtSigned(n: number): string {
  if (n > 0) return `+${fmtInt(n)}`;
  return fmtInt(n);
}
