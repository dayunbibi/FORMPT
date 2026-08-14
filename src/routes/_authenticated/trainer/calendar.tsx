import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section, StatusPill } from "@/components/pt/kit";
import { cn } from "@/lib/utils";
import { dayKey, fmtTime, nameMap, statusLabel, statusTone, useMyMembers } from "@/lib/pt";
import { useTrainerBookings } from "./home";

export const Route = createFileRoute("/_authenticated/trainer/calendar")({
  head: () => ({
    meta: [
      { title: "예약 캘린더 — FORMFIT 트레이너" },
      { name: "description", content: "월간 캘린더에서 날짜별 예약 상태를 점으로 확인하고 탭해서 리스트를 펼치세요." },
      { property: "og:title", content: "예약 캘린더 — FORMFIT 트레이너" },
      { property: "og:description", content: "월간 뷰 + 날짜별 예약 리스트." },
    ],
  }),
  component: TrainerCalendar,
});

function TrainerCalendar() {
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const bookings = useTrainerBookings(trainerId);
  const members = useMyMembers(trainerId);
  const names = nameMap(members.data);
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => dayKey(new Date()));

  const byDay = useMemo(() => {
    const map = new Map<string, typeof bookings.data>();
    (bookings.data ?? []).forEach((b) => {
      const key = dayKey(new Date(b.start_at));
      map.set(key, [...(map.get(key) ?? []), b]);
    });
    return map;
  }, [bookings.data]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const dayList = (byDay.get(selected) ?? []).slice().sort(
    (a, b) => +new Date(a.start_at) - +new Date(b.start_at),
  );

  function dotClass(status: string, cancelRequested: boolean) {
    if (cancelRequested) return "bg-warn";
    return {
      pending: "bg-warn",
      confirmed: "bg-lime",
      completed: "bg-ink",
      cancelled: "bg-muted-foreground/40",
      no_show: "bg-destructive",
    }[status] ?? "bg-muted-foreground/40";
  }

  return (
    <AppShell title="캘린더" subtitle="날짜를 탭하면 예약 리스트가 열립니다" role="trainer">
      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            aria-label="이전 달"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="flex size-9 items-center justify-center rounded-2xl border-2 border-border-strong"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="text-lg font-extrabold">
            {cursor.getFullYear()}년 {cursor.getMonth() + 1}월
          </p>
          <button
            aria-label="다음 달"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="flex size-9 items-center justify-center rounded-2xl border-2 border-border-strong"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = dayKey(d);
            const list = byDay.get(key) ?? [];
            const inMonth = d.getMonth() === cursor.getMonth();
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                className={cn(
                  "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold",
                  selected === key
                    ? "bg-ink text-lime"
                    : inMonth
                      ? "bg-secondary"
                      : "text-muted-foreground/50",
                )}
              >
                <span>{d.getDate()}</span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {list.slice(0, 3).map((b) => (
                    <span
                      key={b.id}
                      className={cn("size-1.5 rounded-full", dotClass(b.status, b.cancel_requested))}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-lime" />확정
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-warn" />대기·취소요청
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-ink" />완료
          </span>
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-destructive" />노쇼
          </span>
        </div>
      </Card>

      <Section title={`${selected} 예약 (${dayList.length})`}>
        {bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : dayList.length === 0 ? (
          <EmptyState title="이 날은 예약이 없어요" description="다른 날짜를 탭해서 일정을 확인해 보세요." />
        ) : (
          <div className="space-y-2">
            {dayList.map((b) => (
              <Card key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{fmtTime(b.start_at)}</p>
                  <p className="text-sm text-muted-foreground">
                    {names.get(b.member_id) ?? "회원"} · {b.duration_min}분
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={statusTone(b)}>{statusLabel(b)}</StatusPill>
                  {b.status === "confirmed" &&
                    +new Date(b.start_at) + b.duration_min * 60_000 < Date.now() && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-2xl border-2"
                          onClick={() => tag.mutate({ id: b.id, status: "completed" })}
                        >
                          완료
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-2xl border-2 border-destructive text-destructive"
                          onClick={() => tag.mutate({ id: b.id, status: "no_show" })}
                        >
                          노쇼
                        </Button>
                      </>
                    )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
