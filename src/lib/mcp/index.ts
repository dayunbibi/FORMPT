import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getMySummary from "./tools/get-my-summary";
import listBookings from "./tools/list-bookings";
import listMyMembers from "./tools/list-my-members";
import listWorkoutLogs from "./tools/list-workout-logs";
import requestBooking from "./tools/request-booking";
import updateBookingStatus from "./tools/update-booking-status";

// OAuth 발급자는 반드시 Supabase 직접 호스트여야 한다 (프록시 URL은 issuer 불일치로 거부됨).
const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "fit-coach-hub",
  title: "Fit Coach Hub",
  version: "0.1.0",
  instructions:
    "퍼스널 트레이닝(PT) 예약·기록 앱의 도구입니다. 로그인한 사용자로 동작하며 회원은 자신의 데이터만, 트레이너는 담당 회원의 데이터만 볼 수 있습니다. 먼저 get_my_summary로 역할과 상태를 확인한 뒤, 회원은 list_bookings·list_workout_logs·request_booking을, 트레이너는 list_my_members·list_bookings·update_booking_status를 사용하세요.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getMySummary, listBookings, listWorkoutLogs, requestBooking, listMyMembers, updateBookingStatus],
});
