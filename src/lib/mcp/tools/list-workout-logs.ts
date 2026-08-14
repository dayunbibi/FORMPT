import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_workout_logs",
  title: "운동기록 조회",
  description:
    "접근 권한이 있는 운동기록을 날짜 역순으로 조회합니다. 운동 종목, 무게, 횟수, 세트, 트레이너 피드백이 포함됩니다.",
  inputSchema: {
    member_id: z.string().uuid().optional().describe("트레이너가 특정 회원의 기록만 볼 때 사용"),
    limit: z.number().int().min(1).max(30).default(10).describe("최대 기록 수"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ member_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    let query = supabase
      .from("workout_logs")
      .select("id, member_id, trainer_id, log_date, feedback, workout_items(exercise, weight_kg, reps, sets, position)")
      .order("log_date", { ascending: false })
      .limit(limit);
    if (member_id) query = query.eq("member_id", member_id);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { logs: data ?? [] },
    };
  },
});
