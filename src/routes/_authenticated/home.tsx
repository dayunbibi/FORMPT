import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section, StatCard, StatSkeleton, StatusPill } from "@/components/pt/kit";
import { fetchRemaining, fmtDateTime, statusLabel, statusTone, type Booking } from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "내 PT 홈 — FORMFIT" },
      { name: "description", content: "남은 PT 횟수와 다음 예약, 오늘의 운동 피드백을 한눈에 확인하세요." },
      { property: "og:title", content: "내 PT 홈 — FORMFIT" },
      { property: "og:description", content: "남은 횟수·다음 예약·최근 피드백 요약." },
    ],
  }),
  component: MemberHome,
});

function MemberHome() {
  const me = useRoleGate("member");
  const userId = me.data?.user.id;

  const remaining = useQuery({
    queryKey: ["remaining", userId],
    queryFn: () => fetchRemaining(userId!),
    enabled: !!userId,
  });

  const bookings = useQuery({
    queryKey: ["my-bookings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    enabled: !!userId,
  });

  const lastLog = useQuery({
    queryKey: ["my-last-log", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, log_date, feedback, workout_items(exercise, weight_kg, reps, sets)")
        .order("log_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const upcoming = (bookings.data ?? []).filter(
    (b) => new Date(b.start_at).getTime() > Date.now() && b.status !== "cancelled",
  );
  const next = upcoming[0];
  const soon =
    next && new Date(next.start_at).getTime() - Date.now() < 48 * 3600 * 1000 ? next : undefined;
  const linked = !!me.data?.profile?.trainer_id;

  return (
    <AppShell
      title={`${me.data?.profile?.full_name ?? ""}님, 오늘도 가볍게`}
      subtitle={linked ? undefined : "아직 담당 트레이너가 연결되지 않았어요"}
      role="member"
      banner={
        soon ? (
          <div className="flex items-start gap-3 rounded-2xl border-2 border-ink bg-lime px-4 py-3 text-lime-foreground">
            <Bell className="mt-0.5 size-4 shrink-0" />
            <p className="text-sm font-bold">
              예약 리마인드 · {fmtDateTime(soon.start_at)} 수업이 곧 시작됩니다
            </p>
          </div>
        ) : undefined
      }
    >
      {remaining.isLoading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="남은 PT"
            value={remaining.data ?? 0}
            unit="회"
            hint="이용 이력과 항상 일치"
          />
          <StatCard label="예정된 예약" value={upcoming.length} unit="건" hint="취소 제외" />
        </div>
      )}

      <Section title="다음 예약">
        {bookings.isLoading ? (
          <ListSkeleton rows={1} />
        ) : next ? (
          <Card className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-extrabold">{fmtDateTime(next.start_at)}</p>
              <p className="text-sm text-muted-foreground">{next.duration_min}분 수업</p>
            </div>
            <StatusPill tone={statusTone(next)}>{statusLabel(next)}</StatusPill>
          </Card>
        ) : (
          <EmptyState
            title="예정된 예약이 없어요"
            description={
              linked
                ? "캘린더에서 원하는 날짜와 시간을 골라 예약해 보세요."
                : "먼저 트레이너에게 가입 요청을 보내면 예약할 수 있어요."
            }
            action={
              <Button asChild className="rounded-2xl">
                <Link to={linked ? "/book" : "/onboarding"}>
                  {linked ? "예약하기" : "트레이너 찾기"}
                </Link>
              </Button>
            }
          />
        )}
      </Section>

      <Section title="최근 운동 · 피드백">
        {lastLog.isLoading ? (
          <ListSkeleton rows={1} />
        ) : lastLog.data ? (
          <Card className="space-y-3">
            <p className="text-sm font-bold">{lastLog.data.log_date}</p>
            <ul className="space-y-1 text-sm">
              {(lastLog.data.workout_items ?? []).map((item, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="font-semibold">{item.exercise}</span>
                  <span className="text-muted-foreground">
                    {item.weight_kg ?? 0}kg · {item.reps ?? 0}회 · {item.sets ?? 0}세트
                  </span>
                </li>
              ))}
            </ul>
            {lastLog.data.feedback && (
              <p className="rounded-2xl bg-secondary px-4 py-3 text-sm leading-relaxed">
                {lastLog.data.feedback}
              </p>
            )}
            <Button asChild variant="outline" className="w-full rounded-2xl border-2">
              <Link to="/records">전체 기록 보기</Link>
            </Button>
          </Card>
        ) : (
          <EmptyState
            title="아직 운동기록이 없어요"
            description="수업이 끝나면 트레이너가 종목·무게·횟수와 피드백을 기록해 줍니다."
            action={
              <Button asChild variant="outline" className="rounded-2xl border-2">
                <Link to="/pass">이용권 확인</Link>
              </Button>
            }
          />
        )}
      </Section>
    </AppShell>
  );
}
