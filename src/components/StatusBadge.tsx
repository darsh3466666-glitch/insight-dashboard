import type { StatusKey } from "@/lib/customer-model";
import { STATUS_LABEL } from "@/lib/customer-model";
import { cn } from "@/lib/utils";

const styles: Record<StatusKey, string> = {
  active: "bg-status-active/20 text-status-active border-status-active/40",
  atrisk: "bg-accent/30 text-accent-foreground border-accent/60",
  stagnant: "bg-destructive/20 text-destructive border-destructive/50",
  inactive: "bg-muted text-muted-foreground border-border",
};

const dots: Record<StatusKey, string> = {
  active: "bg-status-active",
  atrisk: "bg-accent",
  stagnant: "bg-destructive",
  inactive: "bg-status-inactive",
};

export function StatusBadge({ status, size = "sm" }: { status: StatusKey; size?: "sm" | "xs" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        styles[status],
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dots[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}
