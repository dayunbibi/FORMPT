import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "list_bookings",
  title: "예약 목록 조회",
  description:
    "접근 권한이 있는 예약을 조회합니다. 회원은 자신의 예약, 트레이너는 담당 예약만 보입니다. 범위(upcoming/past/all)와 상태로 필터링할 수 있습니다.",
  inputSchema: {
    scope: z.enum(["upcoming", "past", "all"]).default("upcoming").describe("조회 범위"),
    status: z
      .enum(["pending", "confirmed", "cancelled", "completed", "no_show"])
      .optional()
      .describe("예약 상태 필터"),
    limit: z.number().int().min(1).max(50).default(20).describe("최대 개수"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ scope, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const nowIso = new Date().toISOString();

    let query = supabase
      .from("bookings")
      .select("id, member_id, trainer_id, start_at, duration_min, status, cancel_requested, member_note")
      .limit(limit);

    if (scope === "upcoming") query = query.gte("start_at", nowIso).order("start_at", { ascending: true });
    else if (scope === "past") query = query.lt("start_at", nowIso).order("start_at", { ascending: false });
    else query = query.order("start_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { bookings: data ?? [] },
    };
  },
});
