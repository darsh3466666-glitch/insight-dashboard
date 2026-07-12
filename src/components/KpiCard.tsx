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
  primary: "before:bg-primary",
  success: "before:bg-status-active",
  warning: "before:bg-accent",
  destructive: "before:bg-destructive",
  info: "before:bg-info",
  muted: "before:bg-muted-foreground/40",
};

const toneShadow: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "shadow-teal-glow",
  success: "shadow-teal-glow",
  warning: "shadow-accent-glow",
  destructive: "shadow-coral-glow",
  info: "shadow-sky-glow",
  muted: "shadow-card",
};

const toneIcon: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  primary: "bg-primary/15 text-primary",
  success: "bg-status-active/15 text-status-active",
  warning: "bg-accent/25 text-accent-foreground",
  destructive: "bg-destructive/15 text-destructive",
  info: "bg-info/15 text-info",
  muted: "bg-muted text-muted-foreground",
};

export function KpiCard({ label, value, hint, icon, trend, tone = "primary" }: KpiCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-transform hover:-translate-y-0.5",
        "before:absolute before:inset-y-0 before:right-0 before:w-1.5",
        toneRing[tone],
        toneShadow[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-black tracking-tight text-foreground">{value}</div>
          {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
        </div>
        {icon ? (
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneIcon[tone])}>{icon}</div>
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
