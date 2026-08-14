import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, Field, ListSkeleton, Section, StatusPill } from "@/components/pt/kit";
import { fetchSettings, useMyMembers, type Profile } from "@/lib/pt";
import { asCurrency, CURRENCIES, CURRENCY_LABEL, formatMoney, type CurrencyCode } from "@/lib/money";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/trainer/members")({
  head: () => ({
    meta: [
      { title: "회원 관리 — FORMFIT 트레이너" },
      { name: "description", content: "회원별 남은 횟수와 연락처, 이용 현황을 확인하고 이용권을 조정하세요." },
      { property: "og:title", content: "회원 관리 — FORMFIT 트레이너" },
      { property: "og:description", content: "충전·조정과 이용 정지를 명확히 구분한 회원 관리." },
    ],
  }),
  component: MembersPage,
});

function MembersPage() {
  const { t } = useI18n();
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const queryClient = useQueryClient();
  const members = useMyMembers(trainerId);
  const memberIds = (members.data ?? []).map((m) => m.id);

  const settings = useQuery({
    queryKey: ["settings", trainerId],
    queryFn: () => fetchSettings(trainerId!),
    enabled: !!trainerId,
  });
  const defaultCurrency = asCurrency(settings.data?.default_currency);

  const credits = useQuery({
    queryKey: ["trainer-credits", trainerId, memberIds],
    queryFn: async () => {
      // 내 담당 회원의 이용권 내역만 조회한다.
      const { data, error } = await supabase
        .from("credit_entries")
        .select("member_id, delta, amount_paid, currency")
        .in("member_id", memberIds);
      if (error) throw error;
      const map = new Map<string, number>();
      (data ?? []).forEach((row) => {
        map.set(row.member_id, (map.get(row.member_id) ?? 0) + row.delta);
      });
      return map;
    },
    enabled: !!trainerId && memberIds.length > 0,
  });

  const charge = useMutation({
    mutationFn: async (input: {
      memberId: string;
      delta: number;
      amount: number | null;
      currency: CurrencyCode;
      kind: string;
    }) => {
      const { error } = await supabase.from("credit_entries").insert({
        member_id: input.memberId,
        trainer_id: trainerId!,
        delta: input.delta,
        kind: input.kind,
        amount_paid: input.amount,
        currency: input.currency,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-credits"] });
      toast.success(t("이용권을 조정했습니다"));
    },
    onError: () => toast.error(t("조정에 실패했습니다")),
  });

  const suspend = useMutation({
    mutationFn: async (input: { memberId: string; suspended: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ suspended: input.suspended })
        .eq("id", input.memberId);
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ["trainer-members"] });
      toast.success(input.suspended ? t("이용을 정지했습니다") : t("정지를 해제했습니다"));
    },
    onError: () => toast.error(t("변경에 실패했습니다")),
  });

  const list = members.data ?? [];

  return (
    <AppShell title={t("회원 관리")} subtitle={t("총 {n}명", { n: list.length })} role="trainer">
      <Section title={t("회원 목록")}>
        {members.isLoading ? (
          <ListSkeleton rows={3} />
        ) : list.length === 0 ? (
          <EmptyState
            title={t("연결된 회원이 없어요")}
            description={t("회원이 보낸 가입 요청을 승인하면 목록에 추가됩니다.")}
            action={
              <Button asChild className="rounded-2xl">
                <Link to="/trainer/home">{t("가입 요청 확인")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {list.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                remaining={credits.data?.get(m.id) ?? 0}
                defaultCurrency={defaultCurrency}
                onCharge={(delta, amount, currency, kind) =>
                  charge.mutate({ memberId: m.id, delta, amount, currency, kind })
                }
                onSuspend={(suspended) => suspend.mutate({ memberId: m.id, suspended })}
              />
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}

function MemberCard({
  member,
  remaining,
  defaultCurrency,
  onCharge,
  onSuspend,
}: {
  member: Profile;
  remaining: number;
  defaultCurrency: CurrencyCode;
  onCharge: (delta: number, amount: number | null, currency: CurrencyCode, kind: string) => void;
  onSuspend: (suspended: boolean) => void;
}) {
  const { t } = useI18n();
  const [count, setCount] = useState("10");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(defaultCurrency);

  useEffect(() => {
    setCurrency(defaultCurrency);
  }, [defaultCurrency]);

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold">{member.full_name}</p>
          <p className="text-sm text-muted-foreground">{member.phone ?? t("연락처 미등록")}</p>
          <p className="text-xs text-muted-foreground">
            {t("목표 {goal} · 선호 시간 {time}", {
              goal: member.goal || t("미입력"),
              time: member.preferred_time || t("미입력"),
            })}
          </p>
        </div>
        <div className="text-right">
          <StatusPill tone={member.suspended ? "danger" : remaining <= 2 ? "warn" : "lime"}>
            {member.suspended ? t("이용정지") : t("남은 {n}회", { n: remaining })}
          </StatusPill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("충전/조정 횟수")} htmlFor={`count-${member.id}`}>
          <Input
            id={`count-${member.id}`}
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        <Field label={t("결제 금액(선택)")} htmlFor={`amount-${member.id}`}>
          <Input
            id={`amount-${member.id}`}
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>

      <Field label={t("통화 (Currency)")} htmlFor={`currency-${member.id}`}>
        <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
          <SelectTrigger id={`currency-${member.id}`} className="rounded-2xl border-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(CURRENCY_LABEL[c])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {amount && Number(amount) > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("결제 금액")}: {formatMoney(Number(amount), currency)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          className="flex-1 rounded-2xl"
          onClick={() =>
            onCharge(Math.abs(Number(count) || 0), Number(amount) || null, currency, "charge")
          }
        >
          {t("충전")}
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-2xl border-2"
          onClick={() => onCharge(-Math.abs(Number(count) || 0), null, currency, "adjust")}
        >
          {t("횟수 차감")}
        </Button>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full rounded-2xl">
            {member.suspended ? t("이용 정지 해제") : t("이용 정지")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {member.suspended ? t("정지를 해제할까요?") : t("이용을 정지할까요?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {member.suspended
                ? t("{name} 회원이 다시 예약할 수 있게 됩니다.", { name: member.full_name })
                : t(
                    "{name} 회원은 정지 해제까지 예약할 수 없습니다. 되돌리기 어려운 작업이니 확인해 주세요.",
                    { name: member.full_name },
                  )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">{t("닫기")}</AlertDialogCancel>
            <AlertDialogAction className="rounded-2xl" onClick={() => onSuspend(!member.suspended)}>
              {t("확인")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
