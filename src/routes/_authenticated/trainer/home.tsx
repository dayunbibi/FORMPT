import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { MemberAvatar } from "@/components/pt/MemberAvatar";
import { Card, EmptyState, ListSkeleton, Section, StatCard, StatSkeleton, StatusPill } from "@/components/pt/kit";
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
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const queryClient = useQueryClient();
  const bookings = useTrainerBookings(trainerId);
  const members = useMyMembers(trainerId);
  const names = nameMap(members.data);

  // 아직 담당 회원이 아니어서 프로필을 직접 읽을 수 없으므로, 전용 함수로 신청자 정보까지 함께 받는다.
  const requests = useQuery({
    queryKey: ["join-requests", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("incoming_join_requests");
      if (error) throw error;
      return data ?? [];
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
      toast.success("처리했습니다");
    },
    onError: () => toast.error("처리에 실패했습니다"),
  });

  const act = useMutation({
    mutationFn: async (input: { id: string; patch: Partial<Booking> }) => {
      const { error } = await supabase.from("bookings").update(input.patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-bookings"] });
      toast.success("예약 상태를 변경했습니다");
    },
    onError: () => toast.error("변경에 실패했습니다"),
  });

  const renewals = useQuery({
    queryKey: ["renewal-requests", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renewal_requests")
        .select("id, member_id, status, remaining_at_request, created_at")
        .eq("trainer_id", trainerId!)
        .in("status", ["requested", "contacted"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as {
        id: string;
        member_id: string;
        status: "requested" | "contacted";
        remaining_at_request: number;
        created_at: string;
      }[];
    },
    enabled: !!trainerId,
  });

  const renewalAct = useMutation({
    mutationFn: async (input: { id: string; status: "contacted" | "renewed" | "declined" }) => {
      const { error } = await supabase
        .from("renewal_requests")
        .update({
          status: input.status,
          resolved_at: input.status === "contacted" ? null : new Date().toISOString(),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["renewal-requests"] });
      toast.success("재등록 요청 상태를 변경했습니다");
    },
    onError: () => toast.error("변경에 실패했습니다"),
  });

  
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
    <AppShell title="오늘의 운영" subtitle={me.data?.profile?.full_name ?? ""} role="trainer">
      {bookings.isLoading ? (
        <StatSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="처리 대기" value={pending.length + cancelReq.length} unit="건" hint="승인·취소요청" />
          <StatCard label="오늘 수업" value={today.length} unit="건" hint="취소 제외" />
        </div>
      )}

      <WithdrawalRequestsSection trainerId={trainerId} members={members.data ?? []} />

      <Section title={`재등록 요청 (${renewals.data?.length ?? 0})`}>
        {renewals.isLoading ? (
          <ListSkeleton rows={1} />
        ) : (renewals.data ?? []).length === 0 ? (
          <EmptyState
            title="재등록 상담 요청이 없어요"
            description="남은 횟수가 1회 이하인 회원이 요청하면 여기에 표시됩니다."
            action={
              <Button asChild variant="outline" className="rounded-2xl border-2">
                <Link to="/trainer/members">회원 관리로</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {(renewals.data ?? []).map((r) => (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{names.get(r.member_id) ?? "회원"}</p>
                    <p className="text-xs text-muted-foreground">
                      요청 시 남은 {r.remaining_at_request}회 · {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                  <StatusPill tone={r.status === "contacted" ? "warn" : "alert"}>
                    {r.status === "contacted" ? "연락 완료" : "상담 요청"}
                  </StatusPill>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "requested" && (
                    <Button
                      size="sm"
                      className="flex-1 rounded-2xl"
                      onClick={() => renewalAct.mutate({ id: r.id, status: "contacted" })}
                    >
                      연락 완료
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => renewalAct.mutate({ id: r.id, status: "renewed" })}
                  >
                    재등록 완료
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 rounded-2xl"
                    onClick={() => renewalAct.mutate({ id: r.id, status: "declined" })}
                  >
                    안 함
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title={`승인 대기 (${pending.length})`}>
        {bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : pending.length === 0 ? (
          <EmptyState title="대기 중인 예약이 없어요" description="새 예약 요청이 오면 여기에 표시됩니다." />
        ) : (
          <div className="space-y-3">
            {pending.map((b) => (
              <Card key={b.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{names.get(b.member_id) ?? "회원"}</p>
                    <p className="text-sm text-muted-foreground">{fmtDateTime(b.start_at)}</p>
                  </div>
                  <StatusPill tone={statusTone(b)}>{statusLabel(b)}</StatusPill>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-2xl"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "confirmed" } })}
                  >
                    승인
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "cancelled" } })}
                  >
                    거절
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {cancelReq.length > 0 && (
        <Section title={`취소 요청 (${cancelReq.length})`}>
          <div className="space-y-3">
            {cancelReq.map((b) => (
              <Card key={b.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{names.get(b.member_id) ?? "회원"}</p>
                    <p className="text-sm text-muted-foreground">{fmtDateTime(b.start_at)}</p>
                  </div>
                  <StatusPill tone="warn">취소요청</StatusPill>
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
                    취소 승인
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => act.mutate({ id: b.id, patch: { cancel_requested: false } })}
                  >
                    유지
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title={`오늘 예약된 수업 (${today.length})`}>
        {bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : today.length === 0 ? (
          <EmptyState
            title="오늘 수업이 없어요"
            description="캘린더에서 이번 달 일정을 확인해 보세요."
            action={
              <Button asChild variant="outline" className="rounded-2xl border-2">
                <Link to="/trainer/calendar">캘린더 보기</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {today.map((b) => (
              <Card key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{fmtTime(b.start_at)}</p>
                  <p className="text-sm text-muted-foreground">{names.get(b.member_id) ?? "회원"}</p>
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
                          완료
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-2xl border-2 border-destructive text-destructive"
                          onClick={() => act.mutate({ id: b.id, patch: { status: "no_show" } })}
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

      {toTag.length > 0 && (
        <Section title={`완료·노쇼 정리 (${toTag.length})`}>
          <div className="space-y-2">
            {toTag.map((b) => (
              <Card key={b.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{fmtDateTime(b.start_at)}</p>
                  <p className="text-sm text-muted-foreground">{names.get(b.member_id) ?? "회원"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl border-2"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "completed" } })}
                  >
                    완료
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-2xl border-2 border-destructive text-destructive"
                    onClick={() => act.mutate({ id: b.id, patch: { status: "no_show" } })}
                  >
                    노쇼
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title={`가입 요청 (${requests.data?.length ?? 0})`}>
        {requests.isLoading ? (
          <ListSkeleton rows={1} />
        ) : (requests.data ?? []).length === 0 ? (
          <EmptyState title="새 가입 요청이 없어요" description="회원이 검색으로 요청을 보내면 여기에 표시됩니다." />
        ) : (
          <div className="space-y-3">
            {(requests.data ?? []).map((r) => (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <MemberAvatar name={r.full_name || "?"} photoPath={r.photo_path} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">{r.full_name?.trim() || "이름 미입력"}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.phone?.trim() || "연락처 미입력"} · 요청 {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                </div>

                <dl className="space-y-2 rounded-2xl bg-secondary px-4 py-3 text-sm">
                  <div>
                    <dt className="text-xs font-bold text-muted-foreground">운동 목표</dt>
                    <dd className="leading-relaxed">{r.goal?.trim() || "작성하지 않았어요"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-muted-foreground">부상 이력 · 주의사항</dt>
                    <dd className="leading-relaxed">{r.injuries?.trim() || "작성하지 않았어요"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-muted-foreground">선호 시간대</dt>
                    <dd className="leading-relaxed">{r.preferred_time?.trim() || "작성하지 않았어요"}</dd>
                  </div>
                  {r.message?.trim() && (
                    <div>
                      <dt className="text-xs font-bold text-muted-foreground">요청 메시지</dt>
                      <dd className="leading-relaxed">{r.message}</dd>
                    </div>
                  )}
                </dl>

                <div className="flex gap-2">
                  <Button
                    className="flex-1 rounded-2xl"
                    onClick={() => decide.mutate({ id: r.id, memberId: r.member_id, approve: true })}
                  >
                    승인
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => decide.mutate({ id: r.id, memberId: r.member_id, approve: false })}
                  >
                    거절
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
