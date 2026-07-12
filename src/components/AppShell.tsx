import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Users,
  AlertTriangle,
  FileDown,
  Upload,
  TrendingUp,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = { to: string; label: string; icon: typeof Upload; description: string };

const NAV: NavItem[] = [
  { to: "/", label: "رفع البيانات", icon: Upload, description: "تحميل شيتات المبيعات والمقبوضات" },
  { to: "/executive", label: "الملخّص التنفيذي", icon: LayoutDashboard, description: "مؤشرات الإدارة الرئيسية" },
  { to: "/sales", label: "المبيعات", icon: ShoppingCart, description: "تحليل شهري وسنوي" },
  { to: "/collections", label: "المقبوضات", icon: Wallet, description: "نسب التحصيل والأعمار" },
  { to: "/customers", label: "رحلة العميل 360°", icon: Users, description: "بروفايل كامل عبر السنين" },
  { to: "/stagnation", label: "الراكدين", icon: AlertTriangle, description: "تصنيف 3 مستويات" },
  { to: "/activity-analysis", label: "تحليل نشاط العملاء", icon: Activity, description: "أسباب الركود ونمط كل عميل" },
  
  { to: "/reports", label: "التقارير", icon: FileDown, description: "تصدير PDF و Excel" },

];

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-72 flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-6 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-tight">منصّة المبيعات والمقبوضات</div>
            <div className="text-xs text-sidebar-foreground/70">Sales &amp; Collections Intelligence</div>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary/20 text-sidebar-primary-foreground shadow-sm"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", active ? "text-sidebar-primary" : "opacity-80")} />
                <div className="min-w-0">
                  <div className="font-semibold">{item.label}</div>
                  <div className="mt-0.5 text-[11px] leading-tight text-sidebar-foreground/60">
                    {item.description}
                  </div>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4 text-[11px] text-sidebar-foreground/60">
          البيانات المصدرية: شيتات المبيعات والمقبوضات السنوية (2024–2026)
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 font-bold">
          <TrendingUp className="h-5 w-5 text-primary" />
          منصّة المبيعات والمقبوضات
        </div>
        <ThemeToggle />
      </header>
      <div className="lg:hidden">
        <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border bg-card px-2 py-2">
          {NAV.map((item) => {
            const active = location.pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <main className="lg:mr-72">
        <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
