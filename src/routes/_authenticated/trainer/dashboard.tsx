import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section, StatCard, StatSkeleton, StatusPill } from "@/components/pt/kit";
import { nameMap, useMyMembers } from "@/lib/pt";
import { useTrainerBookings } from "./home";

export const Route = createFileRoute("/_authenticated/trainer/dashboard")({
  head: () => ({
    meta: [
      { title: "운영 대시보드 — FORMFIT 트레이너" },
      { name: "description", content: "이번 달 수업 수와 노쇼율, 재등록 임박 회원을 한눈에 확인하세요." },
      { property: "og:title", content: "운영 대시보드 — FORMFIT 트레이너" },
      { property: "og:description", content: "수업량·노쇼율·재등록 알림 요약." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const bookings = useTrainerBookings(trainerId);
  const members = useMyMembers(trainerId);
  const names = nameMap(members.data);

  const credits = useQuery({
    queryKey: ["trainer-credits", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("credit_entries").select("member_id, delta");
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((row) => map.set(row.member_id, (map.get(row.member_id) ?? 0) + row.delta));
      return map;
    },
    enabled: !!trainerId,
  });

  const now = new Date();
  const all = bookings.data ?? [];
  const thisMonth = all.filter((b) => {
    const d = new Date(b.start_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const done = thisMonth.filter((b) => b.status === "completed").length;
  const noShow = thisMonth.filter((b) => b.status === "no_show").length;
  const rate = done + noShow > 0 ? Math.round((noShow / (done + noShow)) * 100) : 0;

  const renewSoon = (members.data ?? [])
    .map((m) => ({ member: m, remaining: credits.data?.get(m.id) ?? 0 }))
    .filter((row) => row.remaining <= 2)
    .sort((a, b) => a.remaining - b.remaining);

  return (
    <AppShell title="대시보드" subtitle={`${now.getMonth() + 1}월 운영 현황`} role="trainer">
      {bookings.isLoading ? (
        <StatSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="이번 달 수업" value={done} unit="회" hint={`예약 ${thisMonth.length}건`} />
            <StatCard label="노쇼율" value={rate} unit="%" hint={`노쇼 ${noShow}회`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="담당 회원" value={members.data?.length ?? 0} unit="명" />
            <StatCard label="재등록 임박" value={renewSoon.length} unit="명" hint="남은 2회 이하" />
          </div>
        </>
      )}

      <Section title="재등록 임박 회원">
        {members.isLoading || credits.isLoading ? (
          <ListSkeleton rows={2} />
        ) : renewSoon.length === 0 ? (
          <EmptyState title="임박한 회원이 없어요" description="남은 횟수가 2회 이하가 되면 여기에 표시됩니다." />
        ) : (
          <div className="space-y-2">
            {renewSoon.map((row) => (
              <Card key={row.member.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{names.get(row.member.id) ?? row.member.full_name}</p>
                  <p className="text-sm text-muted-foreground">{row.member.phone ?? "연락처 미등록"}</p>
                </div>
                <StatusPill tone={row.remaining <= 0 ? "danger" : "warn"}>
                  남은 {row.remaining}회
                </StatusPill>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
