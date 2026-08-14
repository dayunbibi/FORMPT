import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, Field, ListSkeleton, Section } from "@/components/pt/kit";
import { cn } from "@/lib/utils";
import { DEFAULT_SETTINGS, fetchSettings } from "@/lib/pt";

export const Route = createFileRoute("/_authenticated/trainer/settings")({
  head: () => ({
    meta: [
      { title: "운영시간 · 예약 정책 — FORMFIT 트레이너" },
      { name: "description", content: "수업 시간, 예약·취소 마감 시간, 휴무일을 설정해 예약 가능 시간을 관리하세요." },
      { property: "og:title", content: "운영시간 · 예약 정책 — FORMFIT 트레이너" },
      { property: "og:description", content: "예약 가능 시간에 즉시 반영되는 운영 정책." },
    ],
  }),
  component: SettingsPage,
});

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function SettingsPage() {
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const queryClient = useQueryClient();

  const settings = useQuery({
    queryKey: ["settings", trainerId],
    queryFn: () => fetchSettings(trainerId!),
    enabled: !!trainerId,
  });

  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [holiday, setHoliday] = useState("");

  useEffect(() => {
    if (settings.data) {
      const { trainer_id: _ignored, ...rest } = settings.data;
      setForm(rest);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("trainer_settings")
        .upsert({ trainer_id: trainerId!, ...form }, { onConflict: "trainer_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("설정을 저장했습니다");
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  if (settings.isLoading) {
    return (
      <AppShell title="설정" role="trainer">
        <ListSkeleton rows={3} />
      </AppShell>
    );
  }

  return (
    <AppShell title="설정" subtitle="운영시간과 예약 정책" role="trainer">
      <Section title="회원 초대 코드">
        <Card className="space-y-3">
          <p className="text-sm text-muted-foreground">
            오프라인에서 이미 알고 있는 회원에게 이 코드를 알려주세요. 회원이 온보딩 화면에서 코드를
            입력하면 승인 절차 없이 바로 연결됩니다.
          </p>
          {inviteCode.isLoading ? (
            <ListSkeleton rows={1} />
          ) : (
            <div className="rounded-2xl border-2 border-ink bg-ink px-4 py-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink-foreground/60">
                invite code
              </p>
              <p className="display-xl mt-1 text-3xl tracking-[0.25em] text-lime">
                {inviteCode.data ?? "--------"}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl border-2"
              disabled={!inviteCode.data}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteCode.data!);
                  toast.success("코드를 복사했습니다");
                } catch {
                  toast.error("복사에 실패했습니다");
                }
              }}
            >
              코드 복사
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-2xl border-2 border-destructive text-destructive"
              disabled={regenerate.isPending}
              onClick={() => {
                if (!window.confirm("코드를 재발급하면 기존 코드는 더 이상 사용할 수 없습니다. 계속할까요?"))
                  return;
                regenerate.mutate();
              }}
            >
              {regenerate.isPending ? "재발급 중..." : "코드 재발급"}
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="수업 · 운영시간">
        <Card className="space-y-4">
          <Field label="수업 시간(분)" htmlFor="session">
            <Input
              id="session"
              type="number"
              value={form.session_minutes}
              onChange={(e) => setForm({ ...form, session_minutes: Number(e.target.value) })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="오픈 시각(시)" htmlFor="open">
              <Input
                id="open"
                type="number"
                value={form.open_hour}
                onChange={(e) => setForm({ ...form, open_hour: Number(e.target.value) })}
              />
            </Field>
            <Field label="마감 시각(시)" htmlFor="close">
              <Input
                id="close"
                type="number"
                value={form.close_hour}
                onChange={(e) => setForm({ ...form, close_hour: Number(e.target.value) })}
              />
            </Field>
          </div>
        </Card>
      </Section>

      <Section title="예약 정책">
        <Card className="grid grid-cols-2 gap-3">
          <Field label="예약 마감(시간 전)" htmlFor="bcut">
            <Input
              id="bcut"
              type="number"
              value={form.booking_cutoff_hours}
              onChange={(e) => setForm({ ...form, booking_cutoff_hours: Number(e.target.value) })}
            />
          </Field>
          <Field label="취소 마감(시간 전)" htmlFor="ccut">
            <Input
              id="ccut"
              type="number"
              value={form.cancel_cutoff_hours}
              onChange={(e) => setForm({ ...form, cancel_cutoff_hours: Number(e.target.value) })}
            />
          </Field>
        </Card>
      </Section>

      <Section title="휴무일">
        <Card className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-bold text-muted-foreground">휴무 요일</p>
            <div className="flex gap-2">
              {WEEK.map((label, index) => {
                const on = form.closed_weekdays.includes(index);
                return (
                  <button
                    key={label}
                    onClick={() =>
                      setForm({
                        ...form,
                        closed_weekdays: on
                          ? form.closed_weekdays.filter((w) => w !== index)
                          : [...form.closed_weekdays, index],
                      })
                    }
                    className={cn(
                      "size-10 rounded-2xl border-2 text-sm font-bold",
                      on ? "border-ink bg-ink text-lime" : "border-border-strong bg-card",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="특정 휴무일 추가" htmlFor="holiday">
            <div className="flex gap-2">
              <Input
                id="holiday"
                type="date"
                value={holiday}
                onChange={(e) => setHoliday(e.target.value)}
              />
              <Button
                variant="outline"
                className="rounded-2xl border-2"
                onClick={() => {
                  if (!holiday || form.holidays.includes(holiday)) return;
                  setForm({ ...form, holidays: [...form.holidays, holiday].sort() });
                  setHoliday("");
                }}
              >
                추가
              </Button>
            </div>
          </Field>

          {form.holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 휴무일이 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {form.holidays.map((h) => (
                <button
                  key={h}
                  onClick={() =>
                    setForm({ ...form, holidays: form.holidays.filter((x) => x !== h) })
                  }
                  className="rounded-full border-2 border-border-strong px-3 py-1 text-xs font-bold"
                >
                  {h} ✕
                </button>
              ))}
            </div>
          )}
        </Card>
      </Section>

      <Button
        className="w-full rounded-2xl"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "저장 중..." : "설정 저장"}
      </Button>
    </AppShell>
  );
}
