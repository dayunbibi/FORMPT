import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useMyMembers, type Profile } from "@/lib/pt";

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
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const queryClient = useQueryClient();
  const members = useMyMembers(trainerId);
  const memberIds = (members.data ?? []).map((m) => m.id);

  const credits = useQuery({
    queryKey: ["trainer-credits", trainerId, memberIds],
    queryFn: async () => {
      // 내 담당 회원의 이용권 내역만 조회한다.
      const { data, error } = await supabase
        .from("credit_entries")
        .select("member_id, delta")
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
    mutationFn: async (input: { memberId: string; delta: number; amount: number | null; kind: string }) => {
      const { error } = await supabase.from("credit_entries").insert({
        member_id: input.memberId,
        trainer_id: trainerId!,
        delta: input.delta,
        kind: input.kind,
        amount_paid: input.amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-credits"] });
      toast.success("이용권을 조정했습니다");
    },
    onError: () => toast.error("조정에 실패했습니다"),
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
      toast.success(input.suspended ? "이용을 정지했습니다" : "정지를 해제했습니다");
    },
    onError: () => toast.error("변경에 실패했습니다"),
  });

  const list = members.data ?? [];

  return (
    <AppShell title="회원 관리" subtitle={`총 ${list.length}명`} role="trainer">
      <Section title="회원 목록">
        {members.isLoading ? (
          <ListSkeleton rows={3} />
        ) : list.length === 0 ? (
          <EmptyState
            title="연결된 회원이 없어요"
            description="회원이 보낸 가입 요청을 승인하면 목록에 추가됩니다."
            action={
              <Button asChild className="rounded-2xl">
                <Link to="/trainer/home">가입 요청 확인</Link>
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
                onCharge={(delta, amount, kind) =>
                  charge.mutate({ memberId: m.id, delta, amount, kind })
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
  onCharge,
  onSuspend,
}: {
  member: Profile;
  remaining: number;
  onCharge: (delta: number, amount: number | null, kind: string) => void;
  onSuspend: (suspended: boolean) => void;
}) {
  const [count, setCount] = useState("10");
  const [amount, setAmount] = useState("");

  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold">{member.full_name}</p>
          <p className="text-sm text-muted-foreground">{member.phone ?? "연락처 미등록"}</p>
          <p className="text-xs text-muted-foreground">
            목표 {member.goal || "미입력"} · 선호 시간 {member.preferred_time || "미입력"}
          </p>
        </div>
        <div className="text-right">
          <StatusPill tone={member.suspended ? "danger" : remaining <= 2 ? "warn" : "lime"}>
            {member.suspended ? "이용정지" : `남은 ${remaining}회`}
          </StatusPill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="충전/조정 횟수" htmlFor={`count-${member.id}`}>
          <Input
            id={`count-${member.id}`}
            type="number"
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        </Field>
        <Field label="결제 금액(원, 선택)" htmlFor={`amount-${member.id}`}>
          <Input
            id={`amount-${member.id}`}
            type="number"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          className="flex-1 rounded-2xl"
          onClick={() => onCharge(Math.abs(Number(count) || 0), Number(amount) || null, "charge")}
        >
          충전
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-2xl border-2"
          onClick={() => onCharge(-Math.abs(Number(count) || 0), null, "adjust")}
        >
          횟수 차감
        </Button>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" className="w-full rounded-2xl">
            {member.suspended ? "이용 정지 해제" : "이용 정지"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {member.suspended ? "정지를 해제할까요?" : "이용을 정지할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {member.suspended
                ? `${member.full_name} 회원이 다시 예약할 수 있게 됩니다.`
                : `${member.full_name} 회원은 정지 해제까지 예약할 수 없습니다. 되돌리기 어려운 작업이니 확인해 주세요.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">닫기</AlertDialogCancel>
            <AlertDialogAction className="rounded-2xl" onClick={() => onSuspend(!member.suspended)}>
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
