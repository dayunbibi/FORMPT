import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "member" | "trainer";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  goal: string | null;
  injuries: string | null;
  preferred_time: string | null;
  onboarded: boolean;
  suspended: boolean;
  trainer_id: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  member_id: string;
  trainer_id: string;
  start_at: string;
  duration_min: number;
  status: BookingStatus;
  cancel_requested: boolean;
  member_note: string | null;
};

export type Settings = {
  trainer_id: string;
  session_minutes: number;
  open_hour: number;
  close_hour: number;
  booking_cutoff_hours: number;
  cancel_cutoff_hours: number;
  closed_weekdays: number[];
  holidays: string[];
};

export const DEFAULT_SETTINGS: Omit<Settings, "trainer_id"> = {
  session_minutes: 50,
  open_hour: 8,
  close_hour: 21,
  booking_cutoff_hours: 3,
  cancel_cutoff_hours: 12,
  closed_weekdays: [0],
  holidays: [],
};

/** 로그인 사용자 + 프로필 + 역할. 최초 로그인 시 프로필/역할 행을 자동 생성한다. */
export async function getMe() {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const meta = (user.user_metadata ?? {}) as { full_name?: string; role?: Role };

  let { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
  if (!roles || roles.length === 0) {
    await supabase.from("user_roles").insert({ user_id: user.id, role: meta.role ?? "member" });
    roles = [{ role: meta.role ?? "member" }];
  }
  const role = (roles[0]?.role ?? "member") as Role;

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: meta.full_name ?? (user.email?.split("@")[0] ?? "회원"),
        onboarded: role === "trainer",
      })
      .select("*")
      .maybeSingle();
    profile = created;
  }

  // 승인된 가입 요청이 있으면 트레이너 연결을 반영한다.
  if (role === "member" && profile && !profile.trainer_id) {
    const { data: approved } = await supabase
      .from("join_requests")
      .select("trainer_id")
      .eq("member_id", user.id)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (approved?.trainer_id) {
      const { data: linked } = await supabase
        .from("profiles")
        .update({ trainer_id: approved.trainer_id })
        .eq("id", user.id)
        .select("*")
        .maybeSingle();
      if (linked) profile = linked;
    }
  }

  return { user, profile: profile as Profile | null, role, email: user.email ?? "" };
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: getMe, staleTime: 30_000 });
}

export async function fetchSettings(trainerId: string): Promise<Settings> {
  const { data } = await supabase
    .from("trainer_settings")
    .select("*")
    .eq("trainer_id", trainerId)
    .maybeSingle();
  return (data as Settings) ?? { trainer_id: trainerId, ...DEFAULT_SETTINGS };
}

export async function fetchRemaining(memberId: string) {
  const { data } = await supabase.from("credit_entries").select("delta").eq("member_id", memberId);
  return (data ?? []).reduce((sum, row) => sum + (row.delta as number), 0);
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function statusLabel(b: Pick<Booking, "status" | "cancel_requested">) {
  if (b.cancel_requested && b.status === "confirmed") return "취소요청";
  return {
    pending: "승인대기",
    confirmed: "확정",
    cancelled: "취소완료",
    completed: "수업완료",
    no_show: "노쇼",
  }[b.status];
}

export function statusTone(b: Pick<Booking, "status" | "cancel_requested">) {
  if (b.cancel_requested && b.status === "confirmed") return "warn" as const;
  return (
    {
      pending: "warn",
      confirmed: "lime",
      cancelled: "muted",
      completed: "ink",
      no_show: "danger",
    } as const
  )[b.status];
}

export function isUpcoming(b: Booking) {
  return new Date(b.start_at).getTime() > Date.now() && b.status !== "cancelled";
}

/** 트레이너의 회원 목록 (프로필 전체) */
export function useMyMembers(trainerId?: string) {
  return useQuery({
    queryKey: ["trainer-members", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("trainer_id", trainerId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!trainerId,
  });
}

export function nameMap(profiles: Profile[] | undefined) {
  const map = new Map<string, string>();
  (profiles ?? []).forEach((p) => map.set(p.id, p.full_name));
  return map;
}
