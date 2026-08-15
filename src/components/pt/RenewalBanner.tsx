import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/** 남은 횟수가 1회 이하일 때 재등록 상담을 요청할 수 있는 배너 */
export function RenewalBanner({
  memberId,
  trainerId,
  remaining,
}: {
  memberId?: string | undefined;
  trainerId?: string | null | undefined;
  remaining: number;
}) {
  const queryClient = useQueryClient();

  const open = useQuery({
    queryKey: ["my-renewal", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renewal_requests")
        .select("id, status, created_at")
        .eq("member_id", memberId!)
        .in("status", ["requested", "contacted"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!memberId && !!trainerId && remaining <= 1,
  });

  const request = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("renewal_requests").insert({
        member_id: memberId!,
        trainer_id: trainerId!,
        remaining_at_request: remaining,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-renewal"] });
      toast.success("트레이너에게 재등록 상담을 요청했습니다");
    },
    onError: () => toast.error("요청에 실패했습니다"),
  });

  if (!memberId || !trainerId || remaining > 1) return null;

  const pending = open.data;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {pending ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alert" />
        )}
        <div>
          <p className="text-sm font-extrabold">
            {remaining <= 0 ? "남은 PT가 없어요" : "남은 PT가 1회예요"}
          </p>
          <p className="text-xs text-muted-foreground">
            {pending
              ? pending.status === "contacted"
                ? "트레이너가 연락을 시작했어요. 곧 안내받을 수 있어요."
                : "재등록 상담 요청이 접수되었어요."
              : "재등록 상담을 요청하면 트레이너가 연락드립니다."}
          </p>
        </div>
      </div>
      {!pending && (
        <Button
          className="shrink-0 rounded-2xl"
          onClick={() => request.mutate()}
          disabled={request.isPending || open.isLoading}
        >
          재등록 상담 요청
        </Button>
      )}
    </div>
  );
}
