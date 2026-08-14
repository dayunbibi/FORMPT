import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "request_booking",
  title: "예약 신청",
  description:
    "회원 본인 이름으로 담당 트레이너에게 예약을 신청합니다. 신청 상태(pending)로 접수되고 트레이너 승인 후 확정됩니다.",
  inputSchema: {
    start_at: z.string().describe("수업 시작 시각 (ISO 8601, 예: 2026-08-20T10:00:00Z)"),
    note: z.string().trim().max(200).optional().describe("트레이너에게 남길 메모"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ start_at, note }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const start = new Date(start_at);
    if (Number.isNaN(start.getTime())) {
      return { content: [{ type: "text", text: "start_at 형식이 올바르지 않습니다." }], isError: true };
    }
    if (start.getTime() <= Date.now()) {
      return { content: [{ type: "text", text: "지난 시각으로는 예약할 수 없습니다." }], isError: true };
    }

    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const { data: profile } = await supabase
      .from("profiles")
      .select("trainer_id, suspended")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.trainer_id) {
      return {
        content: [{ type: "text", text: "연결된 트레이너가 없습니다. 앱에서 트레이너 가입 요청을 먼저 완료해 주세요." }],
        isError: true,
      };
    }
    if (profile.suspended) {
      return { content: [{ type: "text", text: "이용이 정지된 상태입니다. 트레이너에게 문의해 주세요." }], isError: true };
    }

    const { data: settings } = await supabase
      .from("trainer_settings")
      .select("session_minutes")
      .eq("trainer_id", profile.trainer_id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("bookings")
      .insert({
        member_id: userId,
        trainer_id: profile.trainer_id,
        start_at: start.toISOString(),
        duration_min: settings?.session_minutes ?? 50,
        member_note: note ?? null,
      })
      .select("id, start_at, duration_min, status")
      .single();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: `예약 신청이 접수되었습니다 (승인 대기): ${JSON.stringify(data)}` }],
      structuredContent: { booking: data },
    };
  },
});
