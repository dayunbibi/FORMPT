import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, FieldLabel, StatusPill } from "@/components/pt/kit";
import { inviteErrorMessage } from "@/lib/connect";
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
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [injuries, setInjuries] = useState("");
  const [preferred, setPreferred] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ trainer_id: string; trainer_name: string } | null>(null);
  const [nameError, setNameError] = useState("");
  const linkedTrainerId = me.data?.profile?.trainer_id ?? null;

  useEffect(() => {
    if (me.data?.role === "trainer") navigate({ to: "/trainer/home", replace: true });
  }, [me.data?.role, navigate]);

  useEffect(() => {
    const current = me.data?.profile;
    if (!current) return;
    setName((prev) => (prev ? prev : current.full_name ?? ""));
    setGoal((prev) => (prev ? prev : current.goal ?? ""));
    setInjuries((prev) => (prev ? prev : current.injuries ?? ""));
    setPreferred((prev) => (prev ? prev : current.preferred_time ?? ""));
    setPhone((prev) => (prev ? prev : current.phone ?? ""));
  }, [me.data?.profile]);

  /** 이름은 트레이너가 요청함에서 확인하는 정보라 필수로 받는다. */
  function requireName() {
    if (!name.trim()) {
      setNameError("이름을 입력해 주세요.");
      toast.error("이름을 먼저 입력해 주세요.");
      return false;
    }
    setNameError("");
    return true;
  }

  const saveSurvey = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim().slice(0, 40),
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
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const check = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("preview_invite_code", { _code: code.trim() });
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) throw new Error("invalid code");
      return row;
    },
    onSuccess: (row) => setPreview(row),
    onError: (error: { message?: string }) => toast.error(inviteErrorMessage(error)),
  });

  const redeem = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("redeem_invite_code", { _code: code.trim() });
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) throw new Error("invalid code");
      return row;
    },
    onSuccess: async (row) => {
      setCode("");
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["my-join-requests"] });
      toast.success(`${row.trainer_name} 트레이너와 연결되었습니다`);
    },
    onError: (error: { message?: string }) => toast.error(inviteErrorMessage(error)),
  });

  async function finish() {
    if (!requireName()) return;
    await saveSurvey.mutateAsync();
    toast.success("설문이 저장되었습니다");
    navigate({ to: "/home", replace: true });
  }

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
            <FieldLabel htmlFor="name">이름 (필수)</FieldLabel>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              placeholder="실명을 입력해 주세요"
              maxLength={40}
              className="rounded-2xl"
            />
            {nameError && <p className="mt-1 text-xs font-bold text-destructive">{nameError}</p>}
          </div>
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
          <h2 className="text-lg font-extrabold">트레이너 연결</h2>
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
          ) : preview ? (
            <Card className="space-y-3">
              <p className="text-sm text-muted-foreground">아래 트레이너와 연결할까요?</p>
              <p className="text-2xl font-extrabold">{preview.trainer_name}</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-2xl"
                  disabled={redeem.isPending}
                  onClick={() => {
                    if (!requireName()) return;
                    redeem.mutate();
                  }}
                >
                  {redeem.isPending ? "연결 중..." : "연결하기"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl border-2"
                  onClick={() => setPreview(null)}
                >
                  다시 입력
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                트레이너에게 받은 초대코드를 입력하면 대상 트레이너를 확인한 뒤 연결됩니다. 코드가
                없다면 나중에 홈에서 트레이너를 찾아 연결 요청을 보낼 수 있어요.
              </p>
              <div>
                <FieldLabel htmlFor="invite">초대코드</FieldLabel>
                <Input
                  id="invite"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="예: A7KQ2M9X"
                  maxLength={12}
                  className="rounded-2xl tracking-[0.25em]"
                />
              </div>
              <Button
                className="w-full rounded-2xl"
                disabled={check.isPending || code.trim().length < 4}
                onClick={() => {
                  if (!requireName()) return;
                  check.mutate();
                }}
              >
                {check.isPending ? "확인 중..." : "초대코드로 연결하기"}
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-2xl border-2"
                disabled={saveSurvey.isPending}
                onClick={() => void finish()}
              >
                나중에 연결하기
              </Button>
            </Card>
          )}
        </div>

        <Button
          className="w-full rounded-2xl py-6 text-base font-extrabold"
          disabled={saveSurvey.isPending}
          onClick={() => void finish()}
        >
          저장하고 홈으로
        </Button>
      </div>
    </div>
  );
}
