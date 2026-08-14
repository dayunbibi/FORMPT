import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated } from "../supabase";


export default defineTool({
  name: "list_my_members",
  title: "담당 회원 조회",
  description:
    "트레이너가 담당하는 회원 목록과 각 회원의 남은 PT 횟수, 연락처, 목표를 조회합니다. 다른 트레이너의 회원은 포함되지 않습니다.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const trainerId = ctx.getUserId()!;

    const { data: members, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, goal, injuries, preferred_time, suspended")
      .eq("trainer_id", trainerId)
      .order("created_at", { ascending: false });
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const ids = (members ?? []).map((m) => m.id);
    const remaining = new Map<string, number>();
    if (ids.length > 0) {
      const { data: credits } = await supabase
        .from("credit_entries")
        .select("member_id, delta")
        .in("member_id", ids);
      (credits ?? []).forEach((row) =>
        remaining.set(row.member_id, (remaining.get(row.member_id) ?? 0) + row.delta),
      );
    }

    const rows = (members ?? []).map((m) => ({ ...m, remaining_sessions: remaining.get(m.id) ?? 0 }));

    return {
      content: [{ type: "text", text: JSON.stringify(rows, null, 2) }],
      structuredContent: { members: rows },
    };
  },
});
