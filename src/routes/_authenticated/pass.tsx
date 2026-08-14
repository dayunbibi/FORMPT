import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section, StatCard, StatSkeleton } from "@/components/pt/kit";
import { fmtDate } from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/pass")({
  head: () => ({
    meta: [
      { title: "이용권 · 결제 이력 — FORMFIT" },
      { name: "description", content: "남은 PT 횟수와 충전·차감 이력, 결제 내역을 확인하세요." },
      { property: "og:title", content: "이용권 · 결제 이력 — FORMFIT" },
      { property: "og:description", content: "남은 횟수와 사용 이력이 항상 일치합니다." },
    ],
  }),
  component: PassPage,
});

type Entry = {
  id: string;
  delta: number;
  kind: string;
  note: string | null;
  amount_paid: number | null;
  created_at: string;
};

const KIND_LABEL: Record<string, string> = {
  charge: "이용권 충전",
  deduct: "수업 차감",
  adjust: "횟수 조정",
  refund: "환불",
};

function label(e: Entry) {
  return e.note?.trim() || KIND_LABEL[e.kind] || e.kind;
}

function PassPage() {
  const me = useRoleGate("member");

  const entries = useQuery({
    queryKey: ["my-credits", me.data?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_entries")
        .select("id, delta, kind, note, amount_paid, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Entry[];
    },
    enabled: !!me.data,
  });

  const list = entries.data ?? [];
  const remaining = list.reduce((sum, e) => sum + e.delta, 0);
  const charged = list.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0);
  const used = charged - remaining;
  const payments = list.filter((e) => (e.amount_paid ?? 0) > 0);

  return (
    <AppShell title="이용권" subtitle="남은 횟수와 사용 이력" role="member">
      {entries.isLoading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="남은 PT" value={remaining} unit="회" hint={`총 충전 ${charged}회`} />
          <StatCard label="사용 완료" value={used} unit="회" hint="차감 이력 합계" />
        </div>
      )}

      <Section title={`사용 이력 (${list.length})`}>
        {entries.isLoading ? (
          <ListSkeleton rows={3} />
        ) : list.length === 0 ? (
          <EmptyState
            title="이용권 이력이 없어요"
            description="트레이너가 이용권을 충전하면 여기에서 확인할 수 있어요."
            action={
              <Button asChild variant="outline" className="rounded-2xl border-2">
                <Link to="/home">홈으로</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {list.map((e) => (
              <Card key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-bold">{label(e)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}</p>
                </div>
                <p
                  className={
                    e.delta > 0
                      ? "text-base font-extrabold text-success"
                      : "text-base font-extrabold text-muted-foreground"
                  }
                >
                  {e.delta > 0 ? `+${e.delta}` : e.delta}회
                </p>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title={`결제 · 충전 이력 (${payments.length})`}>
        {payments.length === 0 ? (
          <EmptyState title="결제 이력이 없어요" description="결제와 함께 충전되면 금액이 함께 표시됩니다." />
        ) : (
          <div className="space-y-2">
            {payments.map((e) => (
              <Card key={e.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="text-sm font-bold">{label(e)}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(e.created_at)} · {e.delta}회 충전
                  </p>
                </div>
                <p className="text-base font-extrabold">
                  {(e.amount_paid ?? 0).toLocaleString("ko-KR")}원
                </p>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
