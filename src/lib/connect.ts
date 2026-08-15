/** 트레이너 연결(초대코드 · 가입요청) 공용 로직 */

export function inviteErrorMessage(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  if (message.includes("already linked")) {
    return "이미 담당 트레이너와 연결되어 있어요. 변경이 필요하면 담당 트레이너에게 문의해 주세요.";
  }
  if (message.includes("invalid code")) {
    return "초대코드가 올바르지 않거나 더 이상 사용할 수 없어요. 트레이너에게 코드를 다시 확인해 주세요.";
  }
  if (message.includes("not authenticated")) {
    return "로그인이 만료되었어요. 다시 로그인해 주세요.";
  }
  return "연결에 실패했어요. 잠시 후 다시 시도해 주세요.";
}

export function joinRequestErrorMessage(error: { message?: string; code?: string } | null | undefined) {
  const message = error?.message ?? "";
  if (error?.code === "23505" || message.includes("duplicate key") || message.includes("join_requests_pending_unique")) {
    return "이미 이 트레이너에게 연결 요청을 보냈어요. 승인을 기다려 주세요.";
  }
  return "요청을 보내지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export const REQUEST_STATUS_LABEL: Record<string, string> = {
  pending: "승인 대기 중",
  approved: "승인됨",
  rejected: "거절됨",
};

export function requestStatusTone(status: string) {
  if (status === "approved") return "lime" as const;
  if (status === "rejected") return "danger" as const;
  return "warn" as const;
}
