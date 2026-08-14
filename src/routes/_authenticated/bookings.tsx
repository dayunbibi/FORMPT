import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Card, EmptyState, ListSkeleton, Section, StatusPill } from "@/components/pt/kit";
import { fetchSettings, fmtDateTime, statusLabel, statusTone, type Booking } from "@/lib/pt";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "내 예약 목록 — FORMFIT" },
      { name: "description", content: "예정된 예약과 지난 예약을 시간 기준으로 나눠서 확인하고 취소하세요." },
      { property: "og:title", content: "내 예약 목록 — FORMFIT" },
      { property: "og:description", content: "예정·지난 예약과 취소/노쇼 상태를 한눈에." },
    ],
  }),
  component: BookingsPage,
});

function BookingsPage() {
  const { t } = useI18n();
  const me = useRoleGate("member");
  const queryClient = useQueryClient();
  const trainerId = me.data?.profile?.trainer_id ?? null;

  const bookings = useQuery({
    queryKey: ["my-bookings", me.data?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Booking[];
    },
    enabled: !!me.data,
  });

  const settings = useQuery({
    queryKey: ["settings", trainerId],
    queryFn: () => fetchSettings(trainerId!),
    enabled: !!trainerId,
  });

  const cancel = useMutation({
    mutationFn: async (booking: Booking) => {
      const patch =
        booking.status === "pending"
          ? { status: "cancelled" as const }
          : { cancel_requested: true };
      const { error } = await supabase.from("bookings").update(patch).eq("id", booking.id);
      if (error) throw error;
      return booking.status === "pending";
    },
    onSuccess: (instant) => {
      queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success(instant ? t("예약이 취소되었습니다") : t("취소 요청을 보냈습니다"));
    },
    onError: () => toast.error(t("처리에 실패했습니다")),
  });

  const now = Date.now();
  const all = bookings.data ?? [];
  const upcoming = all
    .filter((b) => new Date(b.start_at).getTime() >= now)
    .sort((a, b) => +new Date(a.start_at) - +new Date(b.start_at));
  const past = all.filter((b) => new Date(b.start_at).getTime() < now);
  const cancelCutoff = (settings.data?.cancel_cutoff_hours ?? 12) * 3600 * 1000;

  function canCancel(b: Booking) {
    if (b.status === "cancelled" || b.status === "completed" || b.status === "no_show") return false;
    if (b.cancel_requested) return false;
    return new Date(b.start_at).getTime() - now > cancelCutoff;
  }

  function Row({ b }: { b: Booking }) {
    return (
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-extrabold">{fmtDateTime(b.start_at)}</p>
            <p className="text-sm text-muted-foreground">{t("{n}분 수업", { n: b.duration_min })}</p>
          </div>
          <StatusPill tone={statusTone(b)}>{statusLabel(b)}</StatusPill>
        </div>
        {canCancel(b) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full rounded-2xl border-2">
                {t("예약 취소")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("예약을 취소할까요?")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("{time} 수업입니다. 확정된 예약은 트레이너 확인 후 최종 취소됩니다.", { time: fmtDateTime(b.start_at) })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl">{t("닫기")}</AlertDialogCancel>
                <AlertDialogAction className="rounded-2xl" onClick={() => cancel.mutate(b)}>
                  {t("취소하기")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        {!canCancel(b) && b.status === "confirmed" && !b.cancel_requested && (
          <p className="text-xs text-muted-foreground">
            {t("취소 마감({hours}시간 전)이 지나 직접 취소할 수 없어요.", { hours: settings.data?.cancel_cutoff_hours ?? 12 })}
          </p>
        )}
      </Card>
    );
  }

  return (
    <AppShell title={t("예약 목록")} subtitle={t("예약 시간 기준으로 구분됩니다")} role="member">
      <Section title={t("예정된 예약 ({n})", { n: upcoming.length })}>
        {bookings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : upcoming.length === 0 ? (
          <EmptyState
            title={t("예정된 예약이 없어요")}
            description={t("캘린더에서 원하는 시간에 수업을 잡아보세요.")}
            action={
              <Button asChild className="rounded-2xl">
                <Link to="/book">{t("예약하기")}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {upcoming.map((b) => (
              <Row key={b.id} b={b} />
            ))}
          </div>
        )}
      </Section>

      <Section title={t("지난 예약 ({n})", { n: past.length })}>
        {bookings.isLoading ? (
          <ListSkeleton rows={1} />
        ) : past.length === 0 ? (
          <EmptyState title={t("지난 예약이 없어요")} description={t("수업을 진행하면 이곳에 기록이 쌓입니다.")} />
        ) : (
          <div className="space-y-3">
            {past.map((b) => (
              <Row key={b.id} b={b} />
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
