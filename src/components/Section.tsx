import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function Section({ title, description, actions, children, className, contentClassName }: Props) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-dashed border-primary/30 px-6 py-4">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  );
}
