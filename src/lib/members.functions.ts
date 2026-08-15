import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Input = { memberId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseInput(data: unknown): Input {
  const memberId = (data as Input | undefined)?.memberId;
  if (typeof memberId !== "string" || !UUID.test(memberId)) throw new Error("invalid member id");
  return { memberId };
}

type ReactivateInput = { memberId: string; keepCredits: boolean; requestId?: string | undefined };

function parseReactivate(data: unknown): ReactivateInput {
  const raw = (data ?? {}) as Partial<ReactivateInput>;
  if (typeof raw.memberId !== "string" || !UUID.test(raw.memberId)) {
    throw new Error("invalid member id");
  }
  if (typeof raw.keepCredits !== "boolean") throw new Error("invalid credit option");
  if (
    raw.requestId !== undefined &&
    (typeof raw.requestId !== "string" || !UUID.test(raw.requestId))
  ) {
    throw new Error("invalid request id");
  }
  return { memberId: raw.memberId, keepCredits: raw.keepCredits, requestId: raw.requestId };
}

function parseApply(data: unknown): { apply: boolean } {
  const apply = (data as { apply?: unknown } | undefined)?.apply;
  return { apply: apply === true };
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
    .select("id, trainer_id, photo_path, deleted_at")
    .eq("id", memberId)
    .maybeSingle();
  if (!member || member.trainer_id !== context.userId) {
    throw new Error("담당 회원이 아닙니다");
  }
  return member as {
    id: string;
    trainer_id: string;
    photo_path: string | null;
    deleted_at: string | null;
  };
}

async function assertTrainer(context: { supabase: { from: (t: string) => any }; userId: string }) {
  const { data: role } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "trainer")
    .maybeSingle();
  if (!role) throw new Error("트레이너만 실행할 수 있습니다");
}

/** 이용 종료 처리: 기록·프로필·사진·보류 횟수를 모두 보존하고 예약/PT 이용만 제한한다. */
export const softDeleteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    await assertMyMember(context as never, data.memberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context.userId,
        deleted_reason: "trainer",
      })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    // 인증 계정은 삭제·차단하지 않는다 (같은 이메일로 다시 로그인 가능).
    return { ok: true as const };
  });

/** 이용 재개(복구): 종료 표시를 해제하고, 종료 처리로 차단된 계정이면 차단도 해제한다. */
export const restoreMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseInput)
  .handler(async ({ data, context }) => {
    await assertMyMember(context as never, data.memberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ deleted_at: null, deleted_by: null, deleted_reason: null })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.memberId, {
      ban_duration: "none",
    });
    if (banError) throw new Error(banError.message);

    return { ok: true as const };
  });

/**
 * 재이용 승인: 회원-트레이너 관계를 다시 활성화한다.
 * - 같은 회원 계정(동일 ID)을 계속 사용하며 새 계정을 만들지 않는다.
 * - keepCredits=false 면 보류된 횟수를 0으로 정리하는 기록을 남긴다(이력 보존).
 */
export const reactivateMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseReactivate)
  .handler(async ({ data, context }) => {
    await assertMyMember(context as never, data.memberId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const { data: credits, error: creditError } = await supabaseAdmin
      .from("credit_entries")
      .select("delta")
      .eq("member_id", data.memberId);
    if (creditError) throw new Error(creditError.message);
    const held = (credits ?? []).reduce((sum, row) => sum + (row.delta as number), 0);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        deleted_at: null,
        deleted_by: null,
        deleted_reason: null,
        trainer_id: context.userId,
        suspended: false,
      })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);

    if (!data.keepCredits && held !== 0) {
      const { error: resetError } = await supabaseAdmin.from("credit_entries").insert({
        member_id: data.memberId,
        trainer_id: context.userId,
        delta: -held,
        kind: "adjust",
        note: "재이용 시작 — 보류 횟수 정리 (0회부터 시작)",
      });
      if (resetError) throw new Error(resetError.message);
    }

    if (data.requestId) {
      const { error: requestError } = await supabaseAdmin
        .from("join_requests")
        .update({ status: "approved" })
        .eq("id", data.requestId)
        .eq("trainer_id", context.userId);
      if (requestError) throw new Error(requestError.message);
    }

    // 과거 종료 처리로 차단된 계정이 남아 있으면 함께 해제한다.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(data.memberId, {
      ban_duration: "none",
    });
    if (banError) throw new Error(banError.message);

    await supabaseAdmin.from("notifications").insert({
      user_id: data.memberId,
      title: "재이용이 승인되었습니다",
      body: data.keepCredits
        ? `보류된 PT ${held}회가 복구되었습니다. 다시 예약할 수 있어요.`
        : "PT 횟수는 0회부터 시작합니다. 트레이너와 등록을 확인해 주세요.",
    });

    return { ok: true as const, held, restored: data.keepCredits, at: nowIso };
  });

/**
 * 이용 종료/탈퇴 승인 때문에 인증이 차단된 담당 회원 계정을 확인하고, apply=true 일 때만 차단을 해제한다.
 * - 이용 종료 상태(deleted_at) 자체는 유지한다.
 * - 종료 상태가 아닌 회원(보안 목적 등으로 별도 차단된 계정)은 건드리지 않는다.
 */
export const unblockEndedAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(parseApply)
  .handler(async ({ data, context }) => {
    await assertTrainer(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: members, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, deleted_at, deleted_reason")
      .eq("trainer_id", context.userId)
      .not("deleted_at", "is", null);
    if (error) throw new Error(error.message);

    const targets: {
      id: string;
      full_name: string;
      email: string | null;
      blockedUntil: string | null;
      unblocked: boolean;
    }[] = [];

    for (const m of members ?? []) {
      const { data: user } = await supabaseAdmin.auth.admin.getUserById(m.id as string);
      const blockedUntil =
        (user?.user as unknown as { banned_until?: string | null } | undefined)?.banned_until ??
        null;
      if (!blockedUntil) continue;
      let unblocked = false;
      if (data.apply) {
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(m.id as string, {
          ban_duration: "none",
        });
        if (banError) throw new Error(banError.message);
        unblocked = true;
      }
      targets.push({
        id: m.id as string,
        full_name: (m.full_name as string) ?? "",
        email: user?.user?.email ?? null,
        blockedUntil,
        unblocked,
      });
    }

    return { applied: data.apply, count: targets.length, targets };
  });
