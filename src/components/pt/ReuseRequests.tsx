import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MemberAvatar } from "@/components/pt/MemberAvatar";
import { Card, EmptyState, Section } from "@/components/pt/kit";
import { supabase } from "@/integrations/supabase/client";
import { fmtDate, fmtDateTime } from "@/lib/pt";
import { reactivateMember } from "@/lib/members.functions";

export type ReuseRequest = {
  id: string;
  member_id: string;
  full_name: string | null;
  phone: string | null;
  photo_path: string | null;
  message: string | null;
  created_at: string;
  ended_at: string | null;
  held_credits: number | null;
};

/** 이용이 종료된 회원이 보낸 재이용 신청 섹션 */
export function ReuseRequestsSection({ requests }: { requests: ReuseRequest[] }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<ReuseRequest | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["join-requests"] });
    queryClient.invalidateQueries({ queryKey: ["trainer-members"] });
    queryClient.invalidateQueries({ queryKey: ["trainer-credits"] });
  };

  const approve = useMutation({
    mutationFn: async (input: { request: ReuseRequest; keepCredits: boolean }) =>
      reactivateMember({
        data: {
          memberId: input.request.member_id,
          requestId: input.request.id,
          keepCredits: input.keepCredits,
        },
      }),
    onSuccess: () => {
      setConfirm(null);
      refresh();
      toast.success("재이용을 승인했습니다");
    },
    onError: (error: Error) => toast.error(error.message || "승인에 실패했습니다"),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("join_requests")
        .update({ status: "rejected" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success("재이용 신청을 거절했습니다");
    },
    onError: () => toast.error("처리에 실패했습니다"),
  });

  return (
    <Section title={`재이용 신청 (${requests.length})`}>
      {requests.length === 0 ? (
        <EmptyState
          title="재이용 신청이 없어요"
          description="이용이 종료된 회원이 다시 신청하면 여기에 표시됩니다."
        />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="space-y-3">
              <div className="flex items-start gap-3">
                <MemberAvatar name={r.full_name || "?"} photoPath={r.photo_path} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{r.full_name?.trim() || "이름 미입력"}</p>
                  <p className="text-sm font-bold tabular-nums">
                    {r.phone?.trim() || "전화번호 없음"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    이전 이용 종료 {r.ended_at ? fmtDate(r.ended_at) : "기록 없음"} · 보류 PT{" "}
                    {r.held_credits ?? 0}회
                  </p>
                  <p className="text-xs text-muted-foreground">
                    재이용 신청 {fmtDateTime(r.created_at)}
                  </p>
                </div>
              </div>
              {r.message?.trim() && (
                <p className="rounded-2xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  회원 전달사항: {r.message}
                </p>
              )}
              <div className="flex gap-2">
                <Button className="flex-1 rounded-2xl" onClick={() => setConfirm(r)}>
                  승인
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl border-2"
                  onClick={() => reject.mutate(r.id)}
                >
                  거절
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(next) => !next && setConfirm(null)}>
        <AlertDialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>보류된 PT 횟수를 어떻게 할까요?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm leading-relaxed">
                <p>
                  회원: <b>{confirm?.full_name || "이름 미입력"}</b>
                </p>
                <p>
                  보류된 PT: <b>{confirm?.held_credits ?? 0}회</b>
                </p>
                <p>
                  승인하면 예약 기능이 복구되고, 기존 기록은 같은 회원 계정에 계속 연결됩니다. 새
                  계정은 만들어지지 않습니다.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full rounded-2xl"
              disabled={approve.isPending}
              onClick={() => confirm && approve.mutate({ request: confirm, keepCredits: true })}
            >
              보류 {confirm?.held_credits ?? 0}회 복구하고 승인
            </Button>
            <Button
              variant="outline"
              className="w-full rounded-2xl border-2"
              disabled={approve.isPending}
              onClick={() => confirm && approve.mutate({ request: confirm, keepCredits: false })}
            >
              0회부터 시작하고 승인
            </Button>
            <AlertDialogCancel className="w-full rounded-2xl border-2">취소</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}
