import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TrainerNote = { member_id: string; body: string };

/** 트레이너 전용 회원 메모 (회원 본인은 RLS 로 조회할 수 없다) */
export function useTrainerNotes(trainerId?: string) {
  return useQuery({
    queryKey: ["trainer-notes", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainer_member_notes")
        .select("member_id, body")
        .eq("trainer_id", trainerId!);
      if (error) throw error;
      const map = new Map<string, string>();
      (data ?? []).forEach((row) => map.set(row.member_id, row.body ?? ""));
      return map;
    },
    enabled: !!trainerId,
  });
}

export async function saveTrainerNote(input: { trainerId: string; memberId: string; body: string }) {
  const { error } = await supabase
    .from("trainer_member_notes")
    .upsert(
      { trainer_id: input.trainerId, member_id: input.memberId, body: input.body },
      { onConflict: "trainer_id,member_id" },
    );
  if (error) throw error;
}
