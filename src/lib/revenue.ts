import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RevenueEntry = {
  id: string;
  trainer_id: string;
  member_id: string | null;
  amount: number;
  entry_date: string;
  note: string | null;
};

export function formatKRW(amount: number) {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

export function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(y!, (m ?? 1) - 1, 1);
  const end = new Date(y!, m ?? 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(start), to: fmt(end) };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, (m ?? 1) - 1 + delta, 1);
  return monthKey(d);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** 선택한 달의 매출 기록 (트레이너 본인 것만 RLS 로 조회된다) */
export function useRevenue(trainerId: string | undefined, month: string) {
  return useQuery({
    queryKey: ["revenue", trainerId, month],
    queryFn: async () => {
      const { from, to } = monthRange(month);
      const { data, error } = await supabase
        .from("revenue_entries")
        .select("id, trainer_id, member_id, amount, entry_date, note")
        .eq("trainer_id", trainerId!)
        .gte("entry_date", from)
        .lte("entry_date", to)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RevenueEntry[];
    },
    enabled: !!trainerId,
  });
}

export async function upsertRevenue(input: {
  id?: string | null;
  trainerId: string;
  amount: number;
  entryDate: string;
  memberId: string | null;
  note: string | null;
}) {
  const row = {
    trainer_id: input.trainerId,
    amount: input.amount,
    entry_date: input.entryDate,
    member_id: input.memberId,
    note: input.note,
  };
  if (input.id) {
    const { error } = await supabase.from("revenue_entries").update(row).eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("revenue_entries").insert(row);
  if (error) throw error;
}

export async function deleteRevenue(id: string) {
  const { error } = await supabase.from("revenue_entries").delete().eq("id", id);
  if (error) throw error;
}
