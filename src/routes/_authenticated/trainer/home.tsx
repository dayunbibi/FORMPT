import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, ListSkeleton, Section, StatCard, StatSkeleton, StatusPill } from "@/components/pt/kit";
import { useI18n } from "@/lib/i18n";
import {
  dayKey,
  fmtDateTime,
  fmtTime,
  nameMap,
  statusLabel,
  statusTone,
  useMyMembers,
  type Booking,
} from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/trainer/home")({
  head: () => ({
    meta: [
      { title: "트레이너 홈 — FORMFIT" },
      { name: "description", content: "승인 대기와 취소 요청, 오늘 예약된 수업을 가장 먼저 처리하세요." },
      { property: "og:title", content: "트레이너 홈 — FORMFIT" },
      { property: "og:description", content: "오늘 처리할 일과 수업 일정을 한 화면에서." },
    ],
  }),
  component: TrainerHome,
});

export function useTrainerBookings(trainerId?: string) {
  return useQuery({
    queryKey: ["trainer-bookings", trainerId],
    queryFn: async () => {
      // 접근 제어는 DB 정책이 담당하지만, 쿼리에서도 담당 트레이너로 명시 제한한다.
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("trainer_id", trainerId!)
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    enabled: !!trainerId,
  });
}

function TrainerHome() {
  const { t } = useI18n();
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const queryClient = useQueryClient();
  const bookings = useTrainerBookings(trainerId);
  const members = useMyMembers(trainerId);
  const names = nameMap(members.data);

  const requests = useQuery({
    queryKey: ["join-requests", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, member_id, message, status, created_at")
        .eq("trainer_id", trainerId!)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as { id: string; member_id: string; message: string | null }[];
    },
    enabled: !!trainerId,
  });

  const decide = useMutation({
    mutationFn: async (input: { id: string; memberId: string; approve: boolean }) => {
      const { error } = await supabase
        .from("join_requests")
        .update({ status: input.approve ? "approved" : "rejected" })
        .eq("id", input.id);
      if (error) throw error;
      if (input.approve) {
        await supabase.from("profiles").update({ trainer_id: trainerId ?? null }).eq("id", input.memberId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["join-requests"] });
      queryClient.invalidateQueries({ queryKey: ["trainer-members"] });
      toast.success(t("처리했습니다"));
    },
    onError: () => toast.error(t("처리에 실패했습니다")),
  });

  const act = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Booking> }) => {
      const { error } = await supabase.from("bookings").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-bookings"] });
      toast.success(t("예약 상태를 변경했습니다"));
    },
    onError: () => toast.error(t("변경에 실패했습니다")),
  });

  const requestNames = names;
  const all = bookings.data ?? [];
  const pending = all.filter((b) => b.status === "pending");
  const cancelReq = all.filter((b) => b.cancel_requested && b.status === "confirmed");
  const today = all.filter(
    (b) => dayKey(new Date(b.start_at)) === dayKey(new Date()) && b.status !== "cancelled",
  );
  const now = Date.now();
  // 노쇼/완료는 자동 판정하지 않고, 시간이 지난 확정 예약을 트레이너가 직접 태깅한다.
  const toTag = all.filter(
    (b) =>
      b.status === "confirmed" &&
      +new Date(b.start_at) + b.duration_min * 60_000 < now &&
      dayKey(new Date(b.start_at)) !== dayKey(new Date()),
  );

  return (
    <AppShell title={t("오늘의 운영")} subtitle={me.data?.profile?.full_name ?? ""} role="trainer">
      {bookings.isLoading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label={t("처리 대기")} value={pending.length + cancelReq.length} unit={t("건")} hint={t("승인·취소요청")} />
          <StatCard label={t("오늘 수업")} value={today.length} unit={t("건")} hint={t("취소 제외")} />
        </div>
      )}

      <Section title={t("승인 대기 ({n})", { n: pending.length })}>
        {bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : pending.length === 0 ? (
          <EmptyState title={t("대기 중인 예약이 없어요")} description={t("새 예약 요청이 오면 여기에 표시됩니다.")} />
        ) : (
          <div className="space-y-3">
            {pending.map((b) => (
              <Card key={b.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{names.get(b.member_id) ?? t("회원")}</p>
                    <p className="text-sm text-muted-foreground">{fmtDateTime(b.start_at)}</p>
                  </div>
                  <StatusPill tone={statusTone(b)}>{statusLabel(b)}</StatusPill>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-2xl"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "confirmed" } })}
                  >
                    {t("승인")}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "cancelled" } })}
                  >
                    {t("거절")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {cancelReq.length > 0 && (
        <Section title={t("취소 요청 ({n})", { n: cancelReq.length })}>
          <div className="space-y-3">
            {cancelReq.map((b) => (
              <Card key={b.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{names.get(b.member_id) ?? t("회원")}</p>
                    <p className="text-sm text-muted-foreground">{fmtDateTime(b.start_at)}</p>
                  </div>
                  <StatusPill tone="warn">{t("취소요청")}</StatusPill>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-2xl"
                    onClick={() =>
                      act.mutate({
                        id: b.id,
                        patch: { status: "cancelled", cancel_requested: false },
                      })
                    }
                  >
                    {t("취소 승인")}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => act.mutate({ id: b.id, patch: { cancel_requested: false } })}
                  >
                    {t("유지")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("오늘 예약된 수업 ({n})", { n: today.length })}>
        {bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : today.length === 0 ? (
          <EmptyState
            title={t("오늘 수업이 없어요")}
            description={t("캘린더에서 이번 달 일정을 확인해 보세요.")}
            action={
              <Button asChild variant="outline" className="rounded-2xl border-2">
                <Link to="/trainer/calendar">{t("캘린더 보기")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {today.map((b) => (
              <Card key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{fmtTime(b.start_at)}</p>
                  <p className="text-sm text-muted-foreground">{names.get(b.member_id) ?? t("회원")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill tone={statusTone(b)}>{statusLabel(b)}</StatusPill>
                  {b.status === "confirmed" &&
                    +new Date(b.start_at) + b.duration_min * 60_000 < now && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-2xl border-2"
                          onClick={() => act.mutate({ id: b.id, patch: { status: "completed" } })}
                        >
                          {t("완료")}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-2xl border-2 border-destructive text-destructive"
                          onClick={() => act.mutate({ id: b.id, patch: { status: "no_show" } })}
                        >
                          {t("노쇼")}
                        </Button>
                      </>
                    )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {toTag.length > 0 && (
        <Section title={t("완료·노쇼 정리 ({n})", { n: toTag.length })}>
          <div className="space-y-2">
            {toTag.map((b) => (
              <Card key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{fmtDateTime(b.start_at)}</p>
                  <p className="text-sm text-muted-foreground">{names.get(b.member_id) ?? t("회원")}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl border-2"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "completed" } })}
                  >
                    {t("완료")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl border-2 border-destructive text-destructive"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "no_show" } })}
                  >
                    {t("노쇼")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("가입 요청 ({n})", { n: requests.data?.length ?? 0 })}>
        {requests.isLoading ? (
          <ListSkeleton rows={1} />
        ) : (requests.data ?? []).length === 0 ? (
          <EmptyState title={t("새 가입 요청이 없어요")} description={t("회원이 검색으로 요청을 보내면 여기에 표시됩니다.")} />
        ) : (
          <div className="space-y-3">
            {(requests.data ?? []).map((r) => (
              <Card key={r.id} className="space-y-3">
                <div>
                  <p className="font-extrabold">{requestNames.get(r.member_id) ?? t("회원")}</p>
                  {r.message && <p className="text-sm text-muted-foreground">{r.message}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-2xl"
                    onClick={() => decide.mutate({ id: r.id, memberId: r.member_id, approve: true })}
                  >
                    {t("승인")}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => decide.mutate({ id: r.id, memberId: r.member_id, approve: false })}
                  >
                    {t("거절")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
