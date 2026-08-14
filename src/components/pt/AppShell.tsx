import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ClipboardList,
  Dumbbell,
  Home,
  LogOut,
  Settings,
  Ticket,
  Users,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/pt";

const memberNav = [
  { to: "/home", label: "홈", icon: Home },
  { to: "/book", label: "예약하기", icon: CalendarDays },
  { to: "/bookings", label: "예약목록", icon: ClipboardList },
  { to: "/records", label: "운동기록", icon: Dumbbell },
  { to: "/pass", label: "이용권", icon: Ticket },
] as const;

const trainerNav = [
  { to: "/trainer/home", label: "오늘", icon: Home },
  { to: "/trainer/calendar", label: "캘린더", icon: CalendarDays },
  { to: "/trainer/members", label: "회원", icon: Users },
  { to: "/trainer/logs", label: "기록작성", icon: Dumbbell },
  { to: "/trainer/dashboard", label: "현황", icon: BarChart3 },
  { to: "/trainer/settings", label: "설정", icon: Settings },
] as const;

export function AppShell({
  title,
  subtitle,
  role,
  children,
  banner,
}: {
  title: string;
  subtitle?: string | undefined;
  role: Role;
  children: ReactNode;
  banner?: ReactNode | undefined;
}) {
  const nav = role === "trainer" ? trainerNav : memberNav;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <p className="display-xl text-xs uppercase tracking-[0.3em] text-muted-foreground">
              formfit {role === "trainer" ? "trainer" : "member"}
            </p>
            <h1 className="truncate text-2xl">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            onClick={signOut}
            aria-label="로그아웃"
            className="flex size-10 shrink-0 items-center justify-center rounded-2xl border-2 border-border-strong bg-card text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {banner && <div className="mx-auto w-full max-w-3xl px-5 pt-4">{banner}</div>}

      <main className="mx-auto w-full max-w-3xl space-y-6 px-5 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-stretch justify-between px-2 py-2">
          {nav.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[11px] font-bold transition-colors",
                  active ? "bg-ink text-ink-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active && "text-lime")} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
