import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section } from "@/components/pt/kit";
import { ConnectRequired } from "@/components/pt/ConnectNotice";
import { cn } from "@/lib/utils";
import { dayKey, fetchSettings, fmtTime } from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "PT 예약하기 — FORMFIT" },
      { name: "description", content: "캘린더에서 날짜를 고르고 가능한 시간을 선택해 PT를 예약하세요." },
      { property: "og:title", content: "PT 예약하기 — FORMFIT" },
      { property: "og:description", content: "운영시간과 마감시간을 반영한 실시간 예약 가능 시간." },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const me = useRoleGate("member");
  const queryClient = useQueryClient();
  const trainerId = me.data?.profile?.trainer_id ?? null;
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<Date | null>(null);

  const settings = useQuery({
    queryKey: ["settings", trainerId],
    queryFn: () => fetchSettings(trainerId!),
    enabled: !!trainerId,
  });

  const taken = useQuery({
    queryKey: ["taken", trainerId, selected && dayKey(selected)],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("taken_slots", {
        _trainer_id: trainerId!,
        _day: dayKey(selected!),
      });
      if (error) throw error;
      return (data ?? []).map((row: { start_at: string }) => new Date(row.start_at).getTime());
    },
    enabled: !!trainerId && !!selected,
  });

  const create = useMutation({
    mutationFn: async (start: Date) => {
      const { error } = await supabase.from("bookings").insert({
        member_id: me.data!.user.id,
        trainer_id: trainerId!,
        start_at: start.toISOString(),
        duration_min: settings.data?.session_minutes ?? 50,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      await queryClient.invalidateQueries({ queryKey: ["taken"] });
      toast.success("예약 요청을 보냈습니다. 트레이너 승인 후 확정됩니다.");
    },
    onError: () => toast.error("예약에 실패했습니다"),
  });

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

  const slots = useMemo(() => {
    if (!selected || !settings.data) return [];
    const s = settings.data;
    const list: Date[] = [];
    for (let h = s.open_hour; h < s.close_hour; h++) {
      for (let m = 0; m + s.session_minutes <= 60; m += s.session_minutes) {
        const d = new Date(selected);
        d.setHours(h, m, 0, 0);
        list.push(d);
      }
    }
    return list;
  }, [selected, settings.data]);

  function dayClosed(d: Date) {
    const s = settings.data;
    if (!s) return false;
    return s.closed_weekdays.includes(d.getDay()) || s.holidays.includes(dayKey(d));
  }

  if (!trainerId) {
    return (
      <AppShell title="예약하기" role="member">
        <ConnectRequired description="초대코드를 입력하거나 트레이너를 찾아 연결하면 바로 예약할 수 있어요." />
      </AppShell>
    );
  }

  const cutoffMs = (settings.data?.booking_cutoff_hours ?? 3) * 3600 * 1000;

  return (
    <AppShell title="예약하기" subtitle="날짜를 고르고 가능한 시간을 선택하세요" role="member">
      <p className="rounded-2xl border-2 border-dashed border-border-strong px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        시간을 선택하면 <span className="font-bold text-foreground">예약 신청</span> 상태로 접수되고, 트레이너가
        승인하면 확정됩니다.
      </p>
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
            const inMonth = d.getMonth() === cursor.getMonth();
            const past = d.getTime() < new Date().setHours(0, 0, 0, 0);
            const closed = dayClosed(d);
            const active = selected && dayKey(selected) === dayKey(d);
            return (
              <button
                key={d.toISOString()}
                disabled={past || closed}
                onClick={() => setSelected(d)}
                className={cn(
                  "aspect-square rounded-xl text-sm font-bold transition-colors",
                  active
                    ? "bg-ink text-lime"
                    : inMonth
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground/50",
                  (past || closed) && "opacity-30",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>
        {settings.data && (
          <p className="text-xs text-muted-foreground">
            수업 {settings.data.session_minutes}분 · 예약 마감 {settings.data.booking_cutoff_hours}시간
            전 · 휴무 요일 {settings.data.closed_weekdays.map((w) => "일월화수목금토"[w]).join(", ") || "없음"}
          </p>
        )}
      </Card>

      <Section title={selected ? `${selected.getMonth() + 1}월 ${selected.getDate()}일 가능한 시간` : "시간 선택"}>
        {!selected ? (
          <EmptyState title="날짜를 먼저 선택해 주세요" description="캘린더에서 원하는 날짜를 탭하면 가능한 시간이 표시됩니다." />
        ) : settings.isLoading || taken.isLoading ? (
          <ListSkeleton rows={2} />
        ) : slots.length === 0 ? (
          <EmptyState title="이 날은 운영하지 않아요" description="다른 날짜를 선택해 주세요." />
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => {
              const isTaken = (taken.data ?? []).includes(slot.getTime());
              const tooLate = slot.getTime() - Date.now() < cutoffMs;
              const disabled = isTaken || tooLate || create.isPending;
              return (
                <button
                  key={slot.toISOString()}
                  disabled={disabled}
                  onClick={() => create.mutate(slot)}
                  className={cn(
                    "rounded-2xl border-2 px-2 py-3 text-sm font-bold",
                    disabled
                      ? "border-border bg-secondary text-muted-foreground/60"
                      : "border-border-strong bg-card hover:border-lime hover:bg-lime hover:text-lime-foreground",
                  )}
                >
                  {fmtTime(slot.toISOString())}
                </button>
              );
            })}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
