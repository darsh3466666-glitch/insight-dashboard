import type { StatusKey } from "@/lib/customer-model";
import { STATUS_LABEL } from "@/lib/customer-model";
import { cn } from "@/lib/utils";

const styles: Record<StatusKey, string> = {
  active: "bg-status-active/15 text-status-active border-status-active/30",
  atrisk: "bg-status-atrisk/15 text-status-atrisk border-status-atrisk/40",
  stagnant: "bg-status-stagnant/15 text-status-stagnant border-status-stagnant/40",
  inactive: "bg-status-inactive/15 text-status-inactive border-status-inactive/30",
};

const dots: Record<StatusKey, string> = {
  active: "bg-status-active",
  atrisk: "bg-status-atrisk",
  stagnant: "bg-status-stagnant",
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
