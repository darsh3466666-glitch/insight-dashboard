import { fmtEGP, fmtInt, fmtPct } from "./format";

// Recharts v3 Tooltip formatter accepts `unknown` (ValueType). Coerce here.
export const tooltipEGP = (v: unknown): string => fmtEGP(Number(v ?? 0));
export const tooltipInt = (v: unknown): string => fmtInt(Number(v ?? 0));
export const tooltipPct = (v: unknown): string => fmtPct(Number(v ?? 0));

// Multi-line formatter for series with different units.
export function tooltipMulti(
  valueFmt: (n: number, name: string) => string,
): (v: unknown, name: unknown) => string {
  return (v, name) => valueFmt(Number(v ?? 0), String(name ?? ""));
}

export const tooltipLabelString = (l: unknown): string => (l == null ? "" : String(l));
