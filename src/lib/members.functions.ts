import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { memberId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseInput(data: unknown): Input {
  const memberId = (data as Input | undefined)?.memberId;
  if (typeof memberId !== "string" || !UUID.test(memberId)) throw new Error("invalid member id");
  return { memberId };
}

/**
 * 호출자가 트레이너 역할이며 해당 회원의 담당인지 서버에서 검증한다.
 * (RLS가 적용되는 사용자 클라이언트로 확인 → 클라이언트 값은 신뢰하지 않는다.)
 */
async function assertMyMember(
  context: { supabase: { from: (t: string) => any }; userId: string },
  memberId: string,
) {
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "trainer")
    .maybeSingle();
  if (!role) throw new Error("트레이너만 실행할 수 있습니다");

  const { data: member } = await context.supabase
    .from("profiles")
    .select("id, trainer_id, photo_path")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.trainer_id !== context.userId) {
    throw new Error("담당 회원이 아닙니다");
  }
  return member as { id: string; trainer_id: string; photo_path: string | null };
}

/** 소프트 삭제: 기록은 모두 보존하고 로그인/신규 예약만 차단한다. */
export const softDeleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    await assertMyMember(context as never, data.memberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: new Date().toISOString(), deleted_by: context.userId })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    // 인증 계정 차단 (기록 삭제 없음)
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.memberId, {
      ban_duration: "876000h",
    });
    if (banError) throw new Error(banError.message);

    return { ok: true as const };
  });

/** 복구: 삭제 표시와 계정 차단을 함께 해제한다. */
export const restoreMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    await assertMyMember(context as never, data.memberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.memberId, {
      ban_duration: "none",
    });
    if (banError) throw new Error(banError.message);

    return { ok: true as const };
  });
