import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WithdrawalStatus = "requested" | "needs_info" | "approved" | "rejected" | "cancelled";

export type WithdrawalRequest = {
  id: string;
  member_id: string;
  trainer_id: string;
  reason_code: string | null;
  reason_text: string | null;
  remaining_at_request: number;
  upcoming_at_request: number;
  status: WithdrawalStatus;
  trainer_note: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export const WITHDRAWAL_STATUS_LABEL: Record<WithdrawalStatus, string> = {
  requested: "이용 종료 요청 확인 중",
  needs_info: "회원 확인 필요",
  approved: "이용 종료 처리 완료",
  rejected: "이용 종료 요청 반려",
  cancelled: "회원이 취소함",
};

export const WITHDRAWAL_STATUS_TONE: Record<
  WithdrawalStatus,
  "alert" | "warn" | "muted" | "danger"
> = {
  requested: "alert",
  needs_info: "warn",
  approved: "muted",
  rejected: "danger",
  cancelled: "muted",
};

export const OPEN_WITHDRAWAL_STATUSES: WithdrawalStatus[] = ["requested", "needs_info"];

export const WITHDRAWAL_REASONS = [
  "이사·이동으로 방문이 어려워요",
  "운동을 잠시 쉬려고 해요",
  "가격·일정이 맞지 않아요",
  "다른 곳에서 운동할 예정이에요",
  "직접 작성",
] as const;

export const WITHDRAWAL_NOTICE =
  "이용 종료가 처리되면 예약과 PT 이용 기능을 사용할 수 없습니다. 계정은 삭제되지 않으므로 같은 이메일로 로그인해 과거 운동 기록과 PT 사용 이력을 계속 확인할 수 있고, 나중에 다시 이용 신청도 가능합니다. 남은 PT 횟수는 보류되며 환불 여부는 트레이너와 별도로 확인해 주세요.";

/** 내 이용 종료 요청 (가장 최근 1건) */
export function useMyWithdrawal(memberId?: string) {
  return useQuery({
    queryKey: ["my-withdrawal", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WithdrawalRequest | null;
    },
    enabled: !!memberId,
  });
}

/** 트레이너에게 온 처리 대기 이용 종료 요청 */
export function useTrainerWithdrawals(trainerId?: string) {
  return useQuery({
    queryKey: ["trainer-withdrawals", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("trainer_id", trainerId!)
        .in("status", OPEN_WITHDRAWAL_STATUSES)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as WithdrawalRequest[];
    },
    enabled: !!trainerId,
  });
}

export function reasonSummary(r: Pick<WithdrawalRequest, "reason_code" | "reason_text">) {
  const parts = [r.reason_code, r.reason_text].filter(Boolean);
  return parts.length ? parts.join(" · ") : "사유 미입력";
}
