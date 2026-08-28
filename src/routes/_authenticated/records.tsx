import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section } from "@/components/pt/kit";
import { ConnectRequired } from "@/components/pt/ConnectNotice";

export const Route = createFileRoute("/_authenticated/records")({
  head: () => ({
    meta: [
      { title: "운동기록 타임라인 — FORMPT" },
      {
        name: "description",
        content: "날짜별 운동 종목·무게·횟수·세트와 트레이너 피드백을 확인하세요.",
      },
      { property: "og:title", content: "운동기록 타임라인 — FORMPT" },
      { property: "og:description", content: "이전 기록과 비교한 증가 표시까지 함께 제공." },
    ],
  }),
  component: RecordsPage,
});

type Item = {
  exercise: string;
  weight_kg: number | null;
  reps: number | null;
  sets: number | null;
};
type Log = { id: string; log_date: string; feedback: string | null; workout_items: Item[] };

export function RecordsPage() {
  const me = useRoleGate("member", { allowEnded: true });

  const logs = useQuery({
    queryKey: ["my-logs", me.data?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workout_logs")
        .select("id, log_date, feedback, workout_items(exercise, weight_kg, reps, sets)")
        .order("log_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Log[];
    },
    enabled: !!me.data,
  });

  const list = logs.data ?? [];

  /** 같은 종목의 더 이전 기록보다 무게/횟수가 늘었는지 판단 */
  function grew(index: number, item: Item) {
    for (let i = index + 1; i < list.length; i++) {
      const prev = list[i]!.workout_items.find((x) => x.exercise === item.exercise);
      if (!prev) continue;
      return (item.weight_kg ?? 0) > (prev.weight_kg ?? 0) || (item.reps ?? 0) > (prev.reps ?? 0);
    }
    return false;
  }

  if (me.data && !me.data.profile?.trainer_id) {
    return (
      <AppShell title="운동기록" role="member">
        <ConnectRequired description="담당 트레이너와 연결되면 수업 기록과 피드백이 여기에 쌓여요." />
      </AppShell>
    );
  }

  return (
    <AppShell title="운동기록" subtitle="날짜별 타임라인" role="member">
      <Section title={`전체 기록 (${list.length})`}>
        {logs.isLoading ? (
          <ListSkeleton rows={3} />
        ) : list.length === 0 ? (
          <EmptyState
            title="아직 기록이 없어요"
            description="수업을 진행하면 트레이너가 종목과 무게, 피드백을 남겨줍니다."
            action={
              <Button asChild className="rounded-2xl">
                <Link to="/book">첫 수업 예약하기</Link>
              </Button>
            }
          />
        ) : (
          <ol className="relative space-y-4 border-l-2 border-border-strong pl-5">
            {list.map((log, index) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[27px] top-4 size-3 rounded-full border-2 border-ink bg-lime" />
                <Card className="space-y-3">
                  <p className="text-sm font-extrabold">{log.log_date}</p>
                  <ul className="space-y-2">
                    {log.workout_items.map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-1 font-bold">
                          {item.exercise}
                          {grew(index, item) && (
                            <span className="flex items-center gap-0.5 rounded-full bg-lime px-1.5 py-0.5 text-[10px] font-extrabold text-lime-foreground">
                              <ArrowUpRight className="size-3" />
                              상승
                            </span>
                          )}
                        </span>
                        <span className="text-muted-foreground">
                          {item.weight_kg ?? 0}kg · {item.reps ?? 0}회 · {item.sets ?? 0}세트
                        </span>
                      </li>
                    ))}
                  </ul>
                  {log.feedback && (
                    <p className="rounded-2xl bg-secondary px-4 py-3 text-sm leading-relaxed">
                      {log.feedback}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </AppShell>
  );
}
