import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthenticated } from "../supabase";

export default defineTool({
  name: "update_booking_status",
  title: "예약 상태 변경",
  description:
    "트레이너가 담당 예약을 승인(confirmed), 취소(cancelled), 수업완료(completed), 노쇼(no_show)로 변경합니다. 다른 트레이너의 예약은 변경되지 않습니다.",
  inputSchema: {
    booking_id: z.string().uuid().describe("변경할 예약 ID"),
    status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).describe("변경할 상태"),
  },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: async ({ booking_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("bookings")
      .update({ status, ...(status === "cancelled" ? { cancel_requested: false } : {}) })
      .eq("id", booking_id)
      .eq("trainer_id", ctx.getUserId()!)
      .select("id, start_at, status")
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return {
        content: [{ type: "text", text: "해당 예약을 찾을 수 없거나 변경 권한이 없습니다." }],
        isError: true,
      };
    }

    return {
      content: [{ type: "text", text: `예약 상태를 ${status}로 변경했습니다: ${JSON.stringify(data)}` }],
      structuredContent: { booking: data },
    };
  },
});
