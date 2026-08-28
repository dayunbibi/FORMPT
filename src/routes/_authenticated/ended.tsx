import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, Field, ListSkeleton, Section, StatCard, StatusPill } from "@/components/pt/kit";
import { supabase } from "@/integrations/supabase/client";
import { fetchRemaining, fmtDate, fmtDateTime } from "@/lib/pt";
import { REQUEST_STATUS_LABEL, joinRequestErrorMessage, requestStatusTone } from "@/lib/connect";

export const Route = createFileRoute("/_authenticated/ended")({
  head: () => ({
    meta: [
      { title: "PT 이용 종료 안내 — FORMPT" },
      {
        name: "description",
        content:
          "PT 이용이 종료된 계정입니다. 과거 운동 기록과 PT 사용 이력을 확인하고 재이용을 신청할 수 있습니다.",
      },
      { property: "og:title", content: "PT 이용 종료 안내 — FORMPT" },
      { property: "og:description", content: "과거 기록 조회와 재이용 신청 안내." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EndedPage,
});

function EndedPage() {
  const me = useRoleGate("member", { allowEnded: true, skipOnboarding: true });
  const profile = me.data?.profile ?? null;
  const memberId = profile?.id;
  const trainerId = profile?.trainer_id ?? null;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");

  const held = useQuery({
    queryKey: ["remaining", memberId],
    queryFn: () => fetchRemaining(memberId!),
    enabled: !!memberId,
  });

  const reuse = useQuery({
    queryKey: ["my-reuse-request", memberId, trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, status, created_at, message")
        .eq("member_id", memberId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
    enabled: !!memberId,
  });

  const pending = reuse.data?.status === "pending" ? reuse.data : null;

  const sendRequest = useMutation({
    mutationFn: async () => {
      if (!memberId || !trainerId) throw new Error("이전 트레이너 정보를 찾을 수 없습니다");
      const { error } = await supabase.from("join_requests").insert({
        member_id: memberId,
        trainer_id: trainerId,
        message: message.trim() || null,
        status: "pending",
      });
      if (error) throw new Error(joinRequestErrorMessage(error));
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["my-reuse-request"] });
      toast.success("재이용 신청을 보냈습니다");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("join_requests").delete().eq("id", pending!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-reuse-request"] });
      toast.success("재이용 신청을 취소했습니다");
    },
    onError: () => toast.error("취소에 실패했습니다"),
  });

  return (
    <AppShell title="PT 이용 종료" subtitle="계정은 그대로 유지됩니다" role="member">
      {me.isLoading ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <Section title="계정 상태">
            <Card className="space-y-3 border-2 border-destructive/40 bg-destructive/5">
              <p className="flex gap-2 text-sm font-bold leading-relaxed text-destructive">
                <PauseCircle className="mt-0.5 size-4 shrink-0" />
                <span>현재 PT 이용이 종료된 계정입니다.</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {profile?.deleted_at ? `${fmtDate(profile.deleted_at)} 이용 종료 · ` : ""}
                과거 운동 기록과 PT 사용 이력은 계속 확인할 수 있어요. 예약과 운동기록 작성, PT
                이용은 트레이너와 다시 연결된 뒤에 사용할 수 있습니다.
              </p>
            </Card>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="보류된 PT" value={held.data ?? 0} unit="회" />
              <StatCard label="상태" value="이용 종료" />
            </div>
          </Section>

          <Section title="내 기록 보기">
            <div className="grid gap-2">
              <Button asChild variant="outline" className="w-full rounded-2xl border-2">
                <Link to="/records">과거 운동 기록 보기</Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-2xl border-2">
                <Link to="/pass">PT 사용 이력 보기</Link>
              </Button>
            </div>
          </Section>

          <Section title="다시 이용하기">
            {pending ? (
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill tone={requestStatusTone(pending.status)}>
                    {REQUEST_STATUS_LABEL[pending.status]}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateTime(pending.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  트레이너가 확인하면 예약 기능이 다시 열립니다. 보류된 PT 횟수를 이어서 사용할지는
                  트레이너가 확인 후 결정해요.
                </p>
                <Button
                  variant="outline"
                  className="w-full rounded-2xl border-2"
                  disabled={cancelRequest.isPending}
                  onClick={() => cancelRequest.mutate()}
                >
                  신청 취소
                </Button>
              </Card>
            ) : (
              <Card className="space-y-3">
                {reuse.data?.status === "rejected" && (
                  <p className="text-sm font-bold text-destructive">
                    이전 재이용 신청이 거절되었습니다. 트레이너와 상담 후 다시 신청해 주세요.
                  </p>
                )}
                <Field label="트레이너에게 전달할 내용 (선택)" htmlFor="reuse-message">
                  <Textarea
                    id="reuse-message"
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="예: 다음 달부터 다시 시작하고 싶어요."
                  />
                </Field>
                <Button
                  className="w-full rounded-2xl"
                  disabled={!trainerId || sendRequest.isPending}
                  onClick={() => sendRequest.mutate()}
                >
                  다시 이용 신청하기
                </Button>
                {!trainerId && (
                  <p className="text-sm text-muted-foreground">
                    이전 트레이너 정보가 없어요. 초대코드를 입력하거나 트레이너를 찾아 연결해
                    주세요.
                  </p>
                )}
                <div className="grid gap-2">
                  <Button asChild variant="outline" className="w-full rounded-2xl border-2">
                    <Link to="/connect" search={{ tab: "code" }}>
                      초대코드로 연결하기
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full rounded-2xl border-2">
                    <Link to="/connect" search={{ tab: "search" }}>
                      트레이너 찾기
                    </Link>
                  </Button>
                </div>
              </Card>
            )}
          </Section>
        </>
      )}
    </AppShell>
  );
}
