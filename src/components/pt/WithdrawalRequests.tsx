import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberAvatar } from "@/components/pt/MemberAvatar";
import { Card, EmptyState, ListSkeleton, Section, StatusPill } from "@/components/pt/kit";
import { supabase } from "@/integrations/supabase/client";
import { fmtDateTime, type Booking, type Profile } from "@/lib/pt";
import { approveWithdrawal } from "@/lib/withdrawal.functions";
import {
  WITHDRAWAL_STATUS_LABEL,
  WITHDRAWAL_STATUS_TONE,
  reasonSummary,
  useTrainerWithdrawals,
  type WithdrawalRequest,
} from "@/lib/withdrawal";

/** 트레이너 첫 화면의 PT 이용 종료 요청 섹션 */
export function WithdrawalRequestsSection({
  trainerId,
  members,
}: {
  trainerId?: string | undefined;
  members: Profile[];
}) {
  const queryClient = useQueryClient();
  const requests = useTrainerWithdrawals(trainerId);
  const [confirm, setConfirm] = useState<WithdrawalRequest | null>(null);

  const list = requests.data ?? [];
  const memberIds = list.map((r) => r.member_id);

  const context = useQuery({
    queryKey: ["withdrawal-context", trainerId, memberIds.join(",")],
    queryFn: async () => {
      const [credits, bookings] = await Promise.all([
        supabase.from("credit_entries").select("member_id, delta").in("member_id", memberIds),
        supabase
          .from("bookings")
          .select("*")
          .in("member_id", memberIds)
          .in("status", ["pending", "confirmed"])
          .gt("start_at", new Date().toISOString()),
      ]);
      const remaining = new Map<string, number>();
      (credits.data ?? []).forEach((row) =>
        remaining.set(row.member_id, (remaining.get(row.member_id) ?? 0) + row.delta),
      );
      const upcoming = new Map<string, Booking[]>();
      ((bookings.data ?? []) as Booking[]).forEach((b) => {
        upcoming.set(b.member_id, [...(upcoming.get(b.member_id) ?? []), b]);
      });
      return { remaining, upcoming };
    },
    enabled: !!trainerId && memberIds.length > 0,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["trainer-withdrawals"] });
    queryClient.invalidateQueries({ queryKey: ["trainer-members"] });
    queryClient.invalidateQueries({ queryKey: ["trainer-bookings"] });
    queryClient.invalidateQueries({ queryKey: ["renewal-requests"] });
  };

  const setStatus = useMutation({
    mutationFn: async (input: { id: string; status: "rejected" | "needs_info" }) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status: input.status,
          resolved_at: input.status === "rejected" ? new Date().toISOString() : null,
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("이용 종료 요청 상태를 변경했습니다");
    },
    onError: () => toast.error("변경에 실패했습니다"),
  });

  const approve = useMutation({
    mutationFn: async (id: string) => approveWithdrawal({ data: { requestId: id } }),
    onSuccess: () => {
      setConfirm(null);
      refresh();
      toast.success("PT 이용을 종료 처리했습니다");
    },
    onError: (error: Error) => toast.error(error.message || "승인에 실패했습니다"),
  });

  const profileOf = (id: string) => members.find((m) => m.id === id);
  const confirmProfile = confirm ? profileOf(confirm.member_id) : undefined;
  const confirmUpcoming = confirm ? (context.data?.upcoming.get(confirm.member_id) ?? []) : [];

  return (
    <Section title={`PT 이용 종료 요청 (${list.length})`}>
      {requests.isLoading ? (
        <ListSkeleton rows={1} />
      ) : list.length === 0 ? (
        <EmptyState
          title="이용 종료 요청이 없어요"
          description="회원이 이용 종료를 요청하면 여기에서 처리·반려할 수 있습니다."
        />
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const p = profileOf(r.member_id);
            const remaining = context.data?.remaining.get(r.member_id) ?? r.remaining_at_request;
            const upcoming = context.data?.upcoming.get(r.member_id) ?? [];
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex items-start gap-3">
                  <MemberAvatar name={p?.full_name ?? "회원"} photoPath={p?.photo_path} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">{p?.full_name || "이름 미입력"}</p>
                    <p className="text-xs text-muted-foreground">{p?.phone ?? "연락처 미등록"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      남은 PT {remaining}회 · 예정 예약 {upcoming.length}건 ·{" "}
                      {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                  <StatusPill tone={WITHDRAWAL_STATUS_TONE[r.status]}>
                    {WITHDRAWAL_STATUS_LABEL[r.status]}
                  </StatusPill>
                </div>
                <p className="rounded-2xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  사유: {reasonSummary(r)}
                </p>
                {upcoming.length > 0 && (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {upcoming.map((b) => (
                      <li key={b.id}>예정 · {fmtDateTime(b.start_at)}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="flex-1 rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => setConfirm(r)}
                  >
                    승인
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 rounded-2xl border-2"
                    onClick={() => setStatus.mutate({ id: r.id, status: "rejected" })}
                  >
                    반려
                  </Button>
                  {r.status !== "needs_info" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 rounded-2xl"
                      onClick={() => setStatus.mutate({ id: r.id, status: "needs_info" })}
                    >
                      확인 필요
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(next) => !next && setConfirm(null)}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>PT 이용을 종료 처리할까요?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm leading-relaxed">
                <p>
                  이용이 종료될 회원: <b>{confirmProfile?.full_name || "이름 미입력"}</b>
                </p>
                <p>
                  남은 PT:{" "}
                  <b>
                    {confirm
                      ? (context.data?.remaining.get(confirm.member_id) ??
                        confirm.remaining_at_request)
                      : 0}
                    회
                  </b>{" "}
                  → 보류된 PT 횟수로 보존되며 환불은 자동 처리되지 않습니다
                </p>
                <p>
                  취소될 예정 예약: <b>{confirmUpcoming.length}건</b>
                </p>
                <p>보존되는 정보: 프로필·사진·지난 예약·운동기록·PT 이력·매출 기록·트레이너 메모</p>
                <p>
                  계정은 삭제·차단하지 않습니다. 회원은 같은 이메일로 로그인해 과거 기록을 볼 수
                  있고, 재이용 신청도 보낼 수 있습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-2">취소</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={approve.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirm) approve.mutate(confirm.id);
              }}
            >
              {approve.isPending ? "처리 중..." : "이용 종료 처리"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
