import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, EmptyState, FieldLabel, ListSkeleton, StatusPill } from "@/components/pt/kit";
import { useMe } from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "시작 설문 — FORMFIT" },
      { name: "description", content: "운동 목표와 부상 이력, 선호 시간대를 남기면 트레이너가 참고합니다." },
      { property: "og:title", content: "시작 설문 — FORMFIT" },
      { property: "og:description", content: "PT 시작 전 목표와 컨디션을 트레이너에게 공유하세요." },
    ],
  }),
  component: OnboardingPage,
});

const TIME_OPTIONS = ["새벽 (6-9시)", "오전 (9-12시)", "오후 (12-18시)", "저녁 (18-22시)"];

function OnboardingPage() {
  const me = useMe();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState("");
  const [injuries, setInjuries] = useState("");
  const [preferred, setPreferred] = useState("");
  const [phone, setPhone] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    if (me.data?.role === "trainer") navigate({ to: "/trainer/home", replace: true });
  }, [me.data?.role, navigate]);

  useEffect(() => {
    const linked = typeof window !== "undefined" ? window.sessionStorage.getItem("pt_trainer") : null;
    if (linked) setTerm("");
    void linked;
  }, []);

  const trainers = useQuery({
    queryKey: ["trainer-directory"],
    queryFn: async () => {
      // 이름만 반환하는 전용 함수 사용 (다른 트레이너의 연락처·부상이력은 노출되지 않음)
      const { data, error } = await supabase.rpc("list_trainers");
      if (error) throw error;
      return (data ?? []).filter((t) => t.id !== me.data?.user.id);
    },
    enabled: !!me.data,
  });

  const myRequests = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, trainer_id, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me.data,
  });

  const saveSurvey = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          goal: goal.trim().slice(0, 300) || null,
          injuries: injuries.trim().slice(0, 300) || null,
          preferred_time: preferred || null,
          phone: phone.trim().slice(0, 20) || null,
          onboarded: true,
        })
        .eq("id", me.data!.user.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("설문이 저장되었습니다");
      navigate({ to: "/home", replace: true });
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const request = useMutation({
    mutationFn: async (trainerId: string) => {
      const { error } = await supabase.from("join_requests").insert({
        member_id: me.data!.user.id,
        trainer_id: trainerId,
        message: goal.trim().slice(0, 200) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-join-requests"] });
      toast.success("가입 요청을 보냈습니다");
    },
    onError: () => toast.error("요청을 보내지 못했습니다"),
  });

  const filtered = (trainers.data ?? []).filter((t) =>
    term.trim() ? t.full_name.includes(term.trim()) : true,
  );
  const requestFor = (id: string) => myRequests.data?.find((r) => r.trainer_id === id);

  return (
    <div className="min-h-screen bg-background px-5 py-10">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <p className="display-xl text-xs uppercase tracking-[0.4em] text-muted-foreground">
            step 1
          </p>
          <h1 className="display-xl mt-2 text-4xl">시작 설문</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            트레이너가 첫 수업을 설계할 때 참고합니다. 나중에 수정할 수 있어요.
          </p>
        </div>

        <Card className="space-y-4">
          <div>
            <FieldLabel htmlFor="goal">운동 목표</FieldLabel>
            <Textarea
              id="goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="체지방 5kg 감량, 데드리프트 100kg 등"
              className="rounded-2xl"
            />
          </div>
          <div>
            <FieldLabel htmlFor="injuries">부상 이력 / 주의사항</FieldLabel>
            <Textarea
              id="injuries"
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              placeholder="오른쪽 무릎 십자인대 수술 (2022)"
              className="rounded-2xl"
            />
          </div>
          <div>
            <FieldLabel>선호 운동 시간대</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TIME_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPreferred(option)}
                  className={
                    "rounded-full border-2 px-4 py-2 text-sm font-bold " +
                    (preferred === option
                      ? "border-ink bg-ink text-ink-foreground"
                      : "border-border-strong bg-card text-muted-foreground")
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="phone">연락처</FieldLabel>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="rounded-2xl"
            />
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-extrabold">초대 코드로 연결하기</h2>
          {linkedTrainerId ? (
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">담당 트레이너와 연결되어 있습니다</p>
                <p className="text-xs text-muted-foreground">
                  다른 트레이너로 재연결하려면 담당 트레이너에게 문의해 주세요.
                </p>
              </div>
              <StatusPill tone="lime">연결됨</StatusPill>
            </Card>
          ) : (
            <Card className="space-y-3">
              <p className="text-sm text-muted-foreground">
                이미 오프라인에서 함께 운동하는 트레이너가 있다면, 받은 초대 코드를 입력하면 승인
                절차 없이 바로 연결됩니다.
              </p>
              <div className="flex gap-2">
                <Input
                  id="invite"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="예: A7KQ2M9X"
                  maxLength={12}
                  className="rounded-2xl tracking-[0.25em]"
                />
                <Button
                  className="rounded-2xl"
                  disabled={redeem.isPending || code.trim().length < 4}
                  onClick={() => redeem.mutate()}
                >
                  {redeem.isPending ? "연결 중..." : "연결"}
                </Button>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-extrabold">트레이너 찾기</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="트레이너 이름 검색"
              className="rounded-2xl pl-9"
            />
          </div>
          {trainers.isLoading ? (
            <ListSkeleton rows={2} />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="트레이너를 찾지 못했어요"
              description="이름을 다시 확인하거나, 트레이너에게 초대 링크를 요청해 주세요. 설문만 먼저 저장해도 됩니다."
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((t) => {
                const req = requestFor(t.id);
                return (
                  <Card key={t.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{t.full_name}</p>
                      <p className="text-xs text-muted-foreground">퍼스널 트레이너</p>
                    </div>
                    {req ? (
                      <StatusPill tone={req.status === "approved" ? "lime" : req.status === "rejected" ? "danger" : "warn"}>
                        {req.status === "approved" ? "승인됨" : req.status === "rejected" ? "거절" : "요청 대기"}
                      </StatusPill>
                    ) : (
                      <Button
                        variant="outline"
                        className="rounded-2xl border-2"
                        disabled={request.isPending}
                        onClick={() => request.mutate(t.id)}
                      >
                        가입 요청
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Button
          className="w-full rounded-2xl py-6 text-base font-extrabold"
          disabled={saveSurvey.isPending}
          onClick={() => saveSurvey.mutate()}
        >
          저장하고 홈으로
        </Button>
      </div>
    </div>
  );
}
