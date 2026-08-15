import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { requestId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseInput(data: unknown): Input {
  const requestId = (data as Input | undefined)?.requestId;
  if (typeof requestId !== "string" || !UUID.test(requestId)) {
    throw new Error("invalid request id");
  }
  return { requestId };
}

/**
 * 탈퇴 요청 최종 승인.
 * - 호출자가 해당 요청의 담당 트레이너인지 RLS 클라이언트로 먼저 검증한다.
 * - 승인 후에도 예약/운동기록/PT이력/매출 기록은 삭제하지 않고 보존한다.
 */
export const approveWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    const userClient = context.supabase;

    const { data: role } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "trainer")
      .maybeSingle();
    if (!role) throw new Error("트레이너만 실행할 수 있습니다");

    const { data: request } = await userClient
      .from("withdrawal_requests")
      .select("id, member_id, trainer_id, status")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request || request.trainer_id !== context.userId) {
      throw new Error("담당 회원의 요청이 아닙니다");
    }
    if (request.status !== "requested" && request.status !== "needs_info") {
      throw new Error("이미 처리된 요청입니다");
    }

    const memberId = request.member_id;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    // 1) 미래 예약(대기/확정) 취소 — 지난 예약과 기록은 그대로 보존
    const { error: bookingError } = await supabaseAdmin
      .from("bookings")
      .update({ status: "cancelled", cancel_requested: false })
      .eq("member_id", memberId)
      .in("status", ["pending", "confirmed"])
      .gt("start_at", nowIso);
    if (bookingError) throw new Error(bookingError.message);

    // 2) 진행 중인 재등록 상담 종료
    const { error: renewalError } = await supabaseAdmin
      .from("renewal_requests")
      .update({ status: "declined", resolved_at: nowIso })
      .eq("member_id", memberId)
      .in("status", ["requested", "contacted"]);
    if (renewalError) throw new Error(renewalError.message);

    // 3) 사진 및 불필요한 개인정보 제거 + 소프트 삭제(로그인/신규 예약 차단)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("photo_path")
      .eq("id", memberId)
      .maybeSingle();
    if (profile?.photo_path) {
      await supabaseAdmin.storage.from("member-photos").remove([profile.photo_path]);
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: "탈퇴 회원",
        phone: null,
        goal: null,
        injuries: null,
        preferred_time: null,
        photo_path: null,
        deleted_at: nowIso,
        deleted_by: context.userId,
        deleted_reason: "withdrawal",
      })
      .eq("id", memberId);
    if (profileError) throw new Error(profileError.message);

    // 4) 인증 계정은 하드 삭제하지 않고 차단만 한다(과거 기록 연쇄 삭제 방지)
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(memberId, {
      ban_duration: "876000h",
    });
    if (banError) throw new Error(banError.message);

    const { error: statusError } = await supabaseAdmin
      .from("withdrawal_requests")
      .update({ status: "approved", resolved_at: nowIso })
      .eq("id", data.requestId);
    if (statusError) throw new Error(statusError.message);

    return { ok: true as const };
  });
