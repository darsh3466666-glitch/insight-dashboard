import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtPct, fmtSigned } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

type Trend = { delta: number; label?: string; kind?: "pct" | "abs" };

type KpiCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: Trend;
  tone?: "primary" | "success" | "warning" | "destructive" | "info" | "muted";
};

const toneRing: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "before:bg-primary/60",
  success: "before:bg-status-active",
  warning: "before:bg-status-atrisk",
  destructive: "before:bg-status-stagnant",
  info: "before:bg-info",
  muted: "before:bg-muted-foreground/40",
};

const toneIcon: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-status-active/15 text-status-active",
  warning: "bg-status-atrisk/15 text-status-atrisk",
  destructive: "bg-status-stagnant/15 text-status-stagnant",
  info: "bg-info/15 text-info",
  muted: "bg-muted text-muted-foreground",
};

export function KpiCard({ label, value, hint, icon, trend, tone = "primary" }: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm",
        "before:absolute before:inset-y-3 before:right-0 before:w-1 before:rounded-full",
        toneRing[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-1.5 text-2xl font-black tracking-tight text-foreground">{value}</div>
          {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneIcon[tone])}>{icon}</div>
        ) : null}
      </div>
      {trend ? <TrendPill {...trend} /> : null}
    </div>
  );
}

function TrendPill({ delta, label, kind = "pct" }: Trend) {
  const zero = Math.abs(delta) < 0.05;
  const up = delta > 0;
  const Icon = zero ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const cls = zero
    ? "bg-muted text-muted-foreground"
    : up
      ? "bg-status-active/15 text-status-active"
      : "bg-status-stagnant/15 text-status-stagnant";
  const text = kind === "pct" ? fmtPct(delta) : fmtSigned(delta);
  return (
    <div className={cn("mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", cls)}>
      <Icon className="h-3 w-3" />
      <span>{kind === "abs" ? fmtCompact(delta) : text}</span>
      {label ? <span className="text-muted-foreground/80">· {label}</span> : null}
    </div>
  );
}
