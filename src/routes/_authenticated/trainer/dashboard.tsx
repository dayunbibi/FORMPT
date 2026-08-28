import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import {
  Card,
  EmptyState,
  Field,
  ListSkeleton,
  Section,
  StatCard,
  StatSkeleton,
  StatusPill,
} from "@/components/pt/kit";
import { dayKey, nameMap, useMyMembers } from "@/lib/pt";
import {
  deleteRevenue,
  formatKRW,
  monthKey,
  monthLabel,
  shiftMonth,
  upsertRevenue,
  useRevenue,
  type RevenueEntry,
} from "@/lib/revenue";
import { useTrainerBookings } from "./home";

export const Route = createFileRoute("/_authenticated/trainer/dashboard")({
  head: () => ({
    meta: [
      { title: "운영 현황 · 매출 장부 — FORMPT 트레이너" },
      {
        name: "description",
        content: "이번 달 수업 수와 매출 합계를 확인하고, 회원별 매출 기록을 직접 추가·수정하세요.",
      },
      { property: "og:title", content: "운영 현황 · 매출 장부 — FORMPT 트레이너" },
      { property: "og:description", content: "수업량·월 매출·재등록 임박 회원 요약." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const bookings = useTrainerBookings(trainerId);
  const members = useMyMembers(trainerId);
  const memberIds = (members.data ?? []).map((m) => m.id);
  const names = nameMap(members.data);

  const [month, setMonth] = useState(() => monthKey(new Date()));
  const revenue = useRevenue(trainerId, month);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<RevenueEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<RevenueEntry | null>(null);

  const save = useMutation({
    mutationFn: async (input: {
      id?: string | null;
      amount: number;
      entryDate: string;
      memberId: string | null;
      note: string | null;
    }) => upsertRevenue({ ...input, trainerId: trainerId! }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue"] });
      toast.success("매출 기록을 저장했습니다");
      setFormOpen(false);
      setEditing(null);
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => deleteRevenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["revenue"] });
      toast.success("매출 기록을 삭제했습니다");
      setRemoving(null);
    },
    onError: () => toast.error("삭제에 실패했습니다"),
  });

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
      (data ?? []).forEach((row) => map.set(row.member_id, (map.get(row.member_id) ?? 0) + row.delta));
      return map;
    },
    enabled: !!trainerId && memberIds.length > 0,
  });

  const [year, mon] = month.split("-").map(Number);
  const all = bookings.data ?? [];
  const selectedMonth = all.filter((b) => {
    const d = new Date(b.start_at);
    return d.getFullYear() === year && d.getMonth() + 1 === mon;
  });
  const done = selectedMonth.filter((b) => b.status === "completed").length;

  const total = (revenue.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  const renewSoon = (members.data ?? [])
    .map((m) => ({ member: m, remaining: credits.data?.get(m.id) ?? 0 }))
    .filter((row) => row.remaining < 3)
    .sort((a, b) => a.remaining - b.remaining);

  return (
    <AppShell title="현황" subtitle={`${monthLabel(month)} 운영 · 매출`} role="trainer">
      <div className="flex items-center justify-between gap-2">
        <Button
          size="icon"
          variant="outline"
          className="size-10 rounded-2xl border-2"
          aria-label="이전 달"
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-base font-extrabold">{monthLabel(month)}</p>
        <Button
          size="icon"
          variant="outline"
          className="size-10 rounded-2xl border-2"
          aria-label="다음 달"
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {bookings.isLoading ? (
        <StatSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="이번 달 수업" value={done} unit="회" hint={`예약 ${selectedMonth.length}건`} />
            <StatCard
              label="이번 달 매출"
              value={total.toLocaleString("ko-KR")}
              unit="원"
              valueClassName="text-2xl sm:text-3xl"
              hint={`${revenue.data?.length ?? 0}건 기록`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="담당 회원" value={members.data?.length ?? 0} unit="명" />
            <StatCard label="재등록 임박" value={renewSoon.length} unit="명" hint="남은 3회 미만" />
          </div>
        </>
      )}

      <Section
        title="매출 장부"
        action={
          <Button
            size="sm"
            className="rounded-2xl"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" /> 매출 추가
          </Button>
        }
      >
        {revenue.isLoading ? (
          <ListSkeleton rows={2} />
        ) : (revenue.data ?? []).length === 0 ? (
          <EmptyState
            title="이번 달 매출 기록이 없어요"
            description="오프라인으로 받은 결제 금액을 직접 기록해 월 매출을 관리하세요."
            action={
              <Button
                className="rounded-2xl"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                첫 매출 기록하기
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {(revenue.data ?? []).map((row) => (
              <Card key={row.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-base font-extrabold">{formatKRW(Number(row.amount))}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {row.entry_date} ·{" "}
                    {row.member_id ? (names.get(row.member_id) ?? "회원") : "회원 미지정"}
                  </p>
                  {row.note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.note}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 rounded-2xl"
                    aria-label="매출 수정"
                    onClick={() => {
                      setEditing(row);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 rounded-2xl text-destructive"
                    aria-label="매출 삭제"
                    onClick={() => setRemoving(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section title="재등록 임박 회원">
        {members.isLoading || credits.isLoading ? (
          <ListSkeleton rows={2} />
        ) : renewSoon.length === 0 ? (
          <EmptyState title="임박한 회원이 없어요" description="남은 횟수가 3회 미만이 되면 여기에 표시됩니다." />
        ) : (
          <div className="space-y-2">
            {renewSoon.map((row) => (
              <Card key={row.member.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-bold">{names.get(row.member.id) ?? row.member.full_name}</p>
                  <p className="text-sm text-muted-foreground">{row.member.phone ?? "연락처 미등록"}</p>
                </div>
                <StatusPill tone={row.remaining <= 0 ? "danger" : "warn"}>
                  남은 {row.remaining}회
                </StatusPill>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <RevenueDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        entry={editing}
        members={(members.data ?? []).map((m) => ({ id: m.id, name: m.full_name }))}
        busy={save.isPending}
        onSubmit={(values) => save.mutate({ id: editing?.id ?? null, ...values })}
      />

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">매출 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing ? `${removing.entry_date} · ${formatKRW(Number(removing.amount))} 기록이 삭제됩니다.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-2">취소</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => removing && remove.mutate(removing.id)}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function RevenueDialog({
  open,
  onOpenChange,
  entry,
  members,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: RevenueEntry | null;
  members: { id: string; name: string }[];
  busy: boolean;
  onSubmit: (values: {
    amount: number;
    entryDate: string;
    memberId: string | null;
    note: string | null;
  }) => void;
}) {
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [date, setDate] = useState(entry?.entry_date ?? dayKey(new Date()));
  const [memberId, setMemberId] = useState(entry?.member_id ?? "none");
  const [note, setNote] = useState(entry?.note ?? "");

  const value = Number(amount.replace(/[^0-9]/g, ""));
  const invalid = !amount.trim() || !Number.isFinite(value) || value <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? "매출 기록 수정" : "매출 기록 추가"}</DialogTitle>
          <DialogDescription>오프라인으로 받은 결제 금액을 원(₩) 단위로 기록합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Field label="금액 (원)" htmlFor="revenue-amount">
            <Input
              id="revenue-amount"
              inputMode="numeric"
              placeholder="예: 600000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="날짜" htmlFor="revenue-date">
            <Input id="revenue-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="회원 (선택)" htmlFor="revenue-member">
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger id="revenue-member" className="rounded-2xl border-2">
                <SelectValue placeholder="회원 선택" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="none">회원 미지정</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="메모 (선택)" htmlFor="revenue-note">
            <Textarea
              id="revenue-note"
              rows={3}
              placeholder="예: 10회권 재등록, 현금 결제"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-2xl border-2" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            className="rounded-2xl"
            disabled={busy || invalid}
            onClick={() =>
              onSubmit({
                amount: value,
                entryDate: date,
                memberId: memberId === "none" ? null : memberId,
                note: note.trim() || null,
              })
            }
          >
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
