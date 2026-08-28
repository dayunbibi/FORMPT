import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, Field, ListSkeleton, Section } from "@/components/pt/kit";
import { dayKey, useMyMembers } from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/trainer/logs")({
  head: () => ({
    meta: [
      { title: "운동기록 작성 — FORMPT 트레이너" },
      { name: "description", content: "회원을 선택해 운동 종목, 무게, 횟수, 세트와 피드백을 기록하세요." },
      { property: "og:title", content: "운동기록 작성 — FORMPT 트레이너" },
      { property: "og:description", content: "여러 종목을 한 번에 추가하고 피드백까지 저장." },
    ],
  }),
  component: LogsPage,
});

type Row = { exercise: string; weight: string; reps: string; sets: string };
const emptyRow: Row = { exercise: "", weight: "", reps: "", sets: "" };

function LogsPage() {
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const members = useMyMembers(trainerId);
  const queryClient = useQueryClient();

  const [memberId, setMemberId] = useState("");
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [feedback, setFeedback] = useState("");
  const [rows, setRows] = useState<Row[]>([{ ...emptyRow }]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: log, error } = await supabase
        .from("workout_logs")
        .insert({
          member_id: memberId,
          trainer_id: trainerId!,
          log_date: date,
          feedback: feedback.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      const items = rows
        .filter((r) => r.exercise.trim())
        .map((r) => ({
          log_id: log.id,
          exercise: r.exercise.trim(),
          weight_kg: r.weight ? Number(r.weight) : null,
          reps: r.reps ? Number(r.reps) : null,
          sets: r.sets ? Number(r.sets) : null,
        }));
      if (items.length > 0) {
        const { error: itemError } = await supabase.from("workout_items").insert(items);
        if (itemError) throw itemError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-logs"] });
      setRows([{ ...emptyRow }]);
      setFeedback("");
      toast.success("운동기록을 저장했습니다");
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  const list = members.data ?? [];
  const canSave = !!memberId && rows.some((r) => r.exercise.trim()) && !save.isPending;

  if (members.isLoading) {
    return (
      <AppShell title="운동기록 작성" role="trainer">
        <ListSkeleton rows={3} />
      </AppShell>
    );
  }

  if (list.length === 0) {
    return (
      <AppShell title="운동기록 작성" role="trainer">
        <EmptyState
          title="기록할 회원이 없어요"
          description="가입 요청을 승인해 회원을 연결하면 기록을 작성할 수 있습니다."
          action={
            <Button asChild className="rounded-2xl">
              <Link to="/trainer/home">가입 요청 확인</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="운동기록 작성" subtitle="회원 선택 후 종목을 추가하세요" role="trainer">
      <Card className="space-y-4">
        <Field label="회원">
          <Select value={memberId} onValueChange={setMemberId}>
            <SelectTrigger className="rounded-2xl border-2">
              <SelectValue placeholder="회원을 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {list.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="운동 날짜" htmlFor="log-date">
          <Input id="log-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </Card>

      <Section
        title={`운동 항목 (${rows.length})`}
        action={
          <Button
            size="sm"
            variant="outline"
            className="rounded-2xl border-2"
            onClick={() => setRows((prev) => [...prev, { ...emptyRow }])}
          >
            <Plus className="size-4" /> 추가
          </Button>
        }
      >
        <div className="space-y-3">
          {rows.map((row, i) => (
            <Card key={i} className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-extrabold">항목 {i + 1}</p>
                {rows.length > 1 && (
                  <button
                    aria-label="항목 삭제"
                    onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <Field label="운동 이름" htmlFor={`ex-${i}`}>
                <Input
                  id={`ex-${i}`}
                  placeholder="벤치프레스"
                  value={row.exercise}
                  onChange={(e) => update(i, { exercise: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="무게(kg)" htmlFor={`w-${i}`}>
                  <Input
                    id={`w-${i}`}
                    type="number"
                    value={row.weight}
                    onChange={(e) => update(i, { weight: e.target.value })}
                  />
                </Field>
                <Field label="횟수" htmlFor={`r-${i}`}>
                  <Input
                    id={`r-${i}`}
                    type="number"
                    value={row.reps}
                    onChange={(e) => update(i, { reps: e.target.value })}
                  />
                </Field>
                <Field label="세트" htmlFor={`s-${i}`}>
                  <Input
                    id={`s-${i}`}
                    type="number"
                    value={row.sets}
                    onChange={(e) => update(i, { sets: e.target.value })}
                  />
                </Field>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <Card className="space-y-4">
        <Field label="트레이너 피드백" htmlFor="feedback">
          <Textarea
            id="feedback"
            rows={4}
            placeholder="자세와 다음 목표를 적어주세요"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </Field>
        <Button className="w-full rounded-2xl" disabled={!canSave} onClick={() => save.mutate()}>
          {save.isPending ? "저장 중..." : "기록 저장"}
        </Button>
      </Card>
    </AppShell>
  );
}
