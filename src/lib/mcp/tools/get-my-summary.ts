import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "get_my_summary",
  title: "내 요약 정보",
  description:
    "로그인한 사용자의 역할(회원/트레이너), 프로필, 남은 PT 횟수, 다음 예약을 한 번에 조회합니다.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [{ data: roles }, { data: profile }, { data: credits }, { data: next }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId!),
      supabase.from("profiles").select("full_name, goal, injuries, preferred_time, onboarded, trainer_id").eq("id", userId!).maybeSingle(),
      supabase.from("credit_entries").select("delta").eq("member_id", userId!),
      supabase
        .from("bookings")
        .select("id, start_at, duration_min, status")
        .gte("start_at", new Date().toISOString())
        .neq("status", "cancelled")
        .order("start_at", { ascending: true })
        .limit(1),
    ]);

    const summary = {
      role: roles?.[0]?.role ?? "member",
      profile: profile ?? null,
      remaining_sessions: (credits ?? []).reduce((sum, row) => sum + row.delta, 0),
      next_booking: next?.[0] ?? null,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
      structuredContent: summary,
    };
  },
});
