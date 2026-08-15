import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, Field, ListSkeleton, Section, StatCard, StatusPill } from "@/components/pt/kit";
import { supabase } from "@/integrations/supabase/client";
import { fetchRemaining, fmtDateTime, type Booking } from "@/lib/pt";
import {
  OPEN_WITHDRAWAL_STATUSES,
  WITHDRAWAL_NOTICE,
  WITHDRAWAL_REASONS,
  WITHDRAWAL_STATUS_LABEL,
  WITHDRAWAL_STATUS_TONE,
  reasonSummary,
  useMyWithdrawal,
} from "@/lib/withdrawal";

export const Route = createFileRoute("/_authenticated/withdraw")({
  head: () => ({
    meta: [
      { title: "회원 탈퇴 요청 — FORMFIT" },
      {
        name: "description",
        content: "남은 PT 횟수와 예정된 예약을 확인한 뒤 트레이너에게 회원 탈퇴 요청을 보냅니다.",
      },
      { property: "og:title", content: "회원 탈퇴 요청 — FORMFIT" },
      { property: "og:description", content: "탈퇴 전 확인 사항과 탈퇴 요청 진행 상태." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: WithdrawPage,
});

function WithdrawPage() {
  const me = useRoleGate("member");
  const memberId = me.data?.user.id;
  const email = me.data?.email ?? "";
  const trainerId = me.data?.profile?.trainer_id ?? null;
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<string>("");
  const [reasonText, setReasonText] = useState("");
  const [password, setPassword] = useState("");
  const [passwordOk, setPasswordOk] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");

  const request = useMyWithdrawal(memberId);
  const open =
    request.data && OPEN_WITHDRAWAL_STATUSES.includes(request.data.status) ? request.data : null;

  const remaining = useQuery({
    queryKey: ["remaining", memberId],
    queryFn: () => fetchRemaining(memberId!),
    enabled: !!memberId,
  });

  const bookings = useQuery({
    queryKey: ["my-upcoming-bookings", memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("member_id", memberId!)
        .in("status", ["pending", "confirmed"])
        .gt("start_at", new Date().toISOString())
        .order("start_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    enabled: !!memberId,
  });

  const renewal = useQuery({
    queryKey: ["my-open-renewal", memberId],
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
      return data ?? null;
    },
    enabled: !!memberId,
  });

  const verifyPassword = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error("비밀번호가 일치하지 않습니다");
    },
    onSuccess: () => {
      setPasswordOk(true);
      setStep(3);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!memberId || !trainerId) throw new Error("연결된 트레이너가 없습니다");
      if (!passwordOk) throw new Error("비밀번호 확인이 필요합니다");
      const custom = reason === "직접 작성";
      const { error } = await supabase.from("withdrawal_requests").insert({
        member_id: memberId,
        trainer_id: trainerId,
        reason_code: reason && !custom ? reason : null,
        reason_text: custom ? reasonText.trim() || null : null,
        remaining_at_request: remaining.data ?? 0,
        upcoming_at_request: bookings.data?.length ?? 0,
        status: "requested",
      });
      if (error) {
        if (error.code === "23505" || error.message.includes("duplicate")) {
          throw new Error("이미 처리 중인 탈퇴 요청이 있습니다");
        }
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      setConfirmOpen(false);
      setConfirmWord("");
      setPassword("");
      setPasswordOk(false);
      setStep(0);
      queryClient.invalidateQueries({ queryKey: ["my-withdrawal"] });
      toast.success("탈퇴 요청을 보냈습니다");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelRequest = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({ status: "cancelled", resolved_at: new Date().toISOString() })
        .eq("id", open!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-withdrawal"] });
      toast.success("탈퇴 요청을 취소했습니다");
    },
    onError: () => toast.error("취소에 실패했습니다"),
  });

  const loading = remaining.isLoading || bookings.isLoading || request.isLoading;

  return (
    <AppShell title="회원 탈퇴 요청" subtitle="탈퇴 전 아래 내용을 확인해 주세요" role="member">
      {loading ? (
        <ListSkeleton rows={3} />
      ) : (
        <>
          <Section title="지금 내 이용 현황">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="남은 PT" value={remaining.data ?? 0} unit="회" />
              <StatCard label="예정 예약" value={bookings.data?.length ?? 0} unit="건" />
            </div>
            <Card className="space-y-2">
              <p className="text-sm font-extrabold">예정된 예약</p>
              {(bookings.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">예정된 예약이 없습니다.</p>
              ) : (
                <ul className="space-y-1.5">
                  {(bookings.data ?? []).map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-bold">{fmtDateTime(b.start_at)}</span>
                      <StatusPill tone={b.status === "confirmed" ? "lime" : "warn"}>
                        {b.status === "confirmed" ? "확정" : "승인대기"}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-sm font-extrabold pt-2">처리 중인 재등록 상담</p>
              <p className="text-sm text-muted-foreground">
                {renewal.data
                  ? `${renewal.data.status === "contacted" ? "연락 완료" : "상담 요청"} 상태의 요청이 1건 있습니다.`
                  : "처리 중인 재등록 상담 요청이 없습니다."}
              </p>
              <p className="text-sm font-extrabold pt-2">탈퇴 시 이용할 수 없는 기능</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>로그인 및 앱 접속</li>
                <li>수업 예약 및 예약 취소</li>
                <li>운동기록·이용권 조회</li>
                <li>재등록 상담 요청</li>
              </ul>
            </Card>
            <Card className="border-2 border-destructive/40 bg-destructive/5">
              <p className="flex gap-2 text-sm font-bold leading-relaxed text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>{WITHDRAWAL_NOTICE}</span>
              </p>
            </Card>
          </Section>

          {open ? (
            <Section title="요청 진행 상태">
              <Card className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <StatusPill tone={WITHDRAWAL_STATUS_TONE[open.status]}>
                    {WITHDRAWAL_STATUS_LABEL[open.status]}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground">
                    {fmtDateTime(open.created_at)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">사유: {reasonSummary(open)}</p>
                {open.status === "needs_info" && (
                  <p className="text-sm font-bold text-warn-foreground">
                    트레이너가 확인이 필요하다고 표시했어요. 트레이너와 연락해 주세요.
                    {open.trainer_note ? ` (${open.trainer_note})` : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  트레이너가 최종 처리하기 전까지는 언제든 취소할 수 있고, 요청만으로 PT
                  횟수·예약·결제 내용이 변경되지는 않습니다.
                </p>
                <Button
                  variant="outline"
                  className="w-full rounded-2xl border-2"
                  disabled={cancelRequest.isPending}
                  onClick={() => cancelRequest.mutate()}
                >
                  탈퇴 요청 취소
                </Button>
              </Card>
            </Section>
          ) : !trainerId ? (
            <Section title="탈퇴 요청">
              <Card className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  연결된 트레이너가 없어 탈퇴 요청을 보낼 수 없습니다. 트레이너와 연결한 뒤 다시
                  시도해 주세요.
                </p>
                <Button asChild variant="outline" className="w-full rounded-2xl border-2">
                  <Link to="/connect" search={{ tab: "code" }}>
                    트레이너 연결하기
                  </Link>
                </Button>
              </Card>
            </Section>
          ) : (
            <Section title="탈퇴 요청">
              {request.data && request.data.status === "rejected" && (
                <Card className="border-2 border-destructive/40">
                  <p className="text-sm font-bold text-destructive">
                    이전 탈퇴 요청이 반려되었습니다. 계정과 기능은 그대로 유지됩니다.
                    {request.data.trainer_note ? ` (${request.data.trainer_note})` : ""}
                  </p>
                </Card>
              )}
              <Card className="space-y-4">
                {step === 0 && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      위 내용을 모두 확인했다면 탈퇴 요청을 시작할 수 있습니다.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full rounded-2xl border-2 border-destructive text-destructive"
                      onClick={() => setStep(1)}
                    >
                      탈퇴 요청 시작
                    </Button>
                  </>
                )}

                {step === 1 && (
                  <>
                    <Field label="탈퇴 사유 (선택)">
                      <div className="space-y-2">
                        {WITHDRAWAL_REASONS.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setReason(r)}
                            className={`w-full rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold ${
                              reason === r
                                ? "border-lime bg-lime/20"
                                : "border-border-strong bg-card"
                            }`}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </Field>
                    {reason === "직접 작성" && (
                      <Field label="사유 직접 작성">
                        <Textarea
                          value={reasonText}
                          onChange={(e) => setReasonText(e.target.value)}
                          placeholder="트레이너에게 전달할 내용을 적어 주세요"
                        />
                      </Field>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 rounded-2xl"
                        onClick={() => setStep(0)}
                      >
                        이전
                      </Button>
                      <Button className="flex-1 rounded-2xl" onClick={() => setStep(2)}>
                        다음
                      </Button>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <Field
                      label="현재 비밀번호"
                      htmlFor="withdraw-password"
                      hint="본인 확인을 위해 다시 입력해 주세요."
                    >
                      <Input
                        id="withdraw-password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="flex-1 rounded-2xl"
                        onClick={() => setStep(1)}
                      >
                        이전
                      </Button>
                      <Button
                        className="flex-1 rounded-2xl"
                        disabled={!password || verifyPassword.isPending}
                        onClick={() => verifyPassword.mutate()}
                      >
                        {verifyPassword.isPending ? "확인 중..." : "비밀번호 확인"}
                      </Button>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <p className="text-sm font-bold">본인 확인이 완료되었습니다.</p>
                    <p className="text-sm text-muted-foreground">
                      사유:{" "}
                      {reasonSummary({
                        reason_code: reason === "직접 작성" ? null : reason || null,
                        reason_text: reason === "직접 작성" ? reasonText.trim() || null : null,
                      })}
                    </p>
                    <Button
                      className="w-full rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => setConfirmOpen(true)}
                    >
                      탈퇴 요청 보내기
                    </Button>
                  </>
                )}
              </Card>
            </Section>
          )}
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={(next) => !submit.isPending && setConfirmOpen(next)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>정말 탈퇴를 요청할까요?</DialogTitle>
            <DialogDescription className="leading-relaxed">{WITHDRAWAL_NOTICE}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              남은 PT {remaining.data ?? 0}회 · 예정 예약 {bookings.data?.length ?? 0}건
            </p>
            <Field label='확인을 위해 "탈퇴"를 입력해 주세요' htmlFor="withdraw-word">
              <Input
                id="withdraw-word"
                value={confirmWord}
                onChange={(e) => setConfirmWord(e.target.value)}
                placeholder="탈퇴"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-2xl border-2"
              disabled={submit.isPending}
              onClick={() => setConfirmOpen(false)}
            >
              취소
            </Button>
            <Button
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={confirmWord.trim() !== "탈퇴" || submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? "전송 중..." : "탈퇴 요청 보내기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
