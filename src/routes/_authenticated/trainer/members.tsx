import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  MoreVertical,
  PauseCircle,
  Pencil,
  Phone,
  RotateCcw,
  StickyNote,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlertDialogTrigger,
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
import { MemberAvatar } from "@/components/pt/MemberAvatar";
import { Card, EmptyState, Field, ListSkeleton, Section, StatusPill } from "@/components/pt/kit";
import {
  MEMBER_STATE_LABEL,
  MEMBER_STATE_TONE,
  dayKey,
  memberState,
  useMemberCredits,
  useMyMembers,
  type Profile,
} from "@/lib/pt";
import { saveTrainerNote, useTrainerNotes } from "@/lib/trainerNotes";
import { restoreMember, softDeleteMember } from "@/lib/members.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trainer/members")({
  head: () => ({
    meta: [
      { title: "회원 관리 — FORMFIT 트레이너" },
      { name: "description", content: "회원별 남은 횟수와 연락처, 이용 현황을 확인하고 PT 횟수를 조정하세요." },
      { property: "og:title", content: "회원 관리 — FORMFIT 트레이너" },
      { property: "og:description", content: "요약형 카드와 아코디언으로 간소화된 회원 관리." },
    ],
  }),
  component: MembersPage,
});

type SortKey = "recent" | "name" | "remaining";

function MembersPage() {
  const me = useRoleGate("trainer");
  const trainerId = me.data?.user.id;
  const queryClient = useQueryClient();

  const all = useMyMembers(trainerId, { includeDeleted: true });
  const memberIds = useMemo(() => (all.data ?? []).map((m) => m.id), [all.data]);
  const credits = useMemberCredits(trainerId, memberIds);

  const renewals = useQuery({
    queryKey: ["renewal-requests", trainerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("renewal_requests")
        .select("id, member_id, status")
        .eq("trainer_id", trainerId!)
        .in("status", ["requested", "contacted"]);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!trainerId,
  });

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [showDeleted, setShowDeleted] = useState(false);

  const renewalByMember = useMemo(() => {
    const map = new Map<string, string>();
    (renewals.data ?? []).forEach((r) => map.set(r.member_id, r.id));
    return map;
  }, [renewals.data]);

  function remainingOf(id: string) {
    return credits.data?.get(id) ?? 0;
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["trainer-members"] });
    queryClient.invalidateQueries({ queryKey: ["trainer-credits"] });
    queryClient.invalidateQueries({ queryKey: ["renewal-requests"] });
  }

  const adjust = useMutation({
    mutationFn: async (input: {
      memberId: string;
      delta: number;
      note: string;
      appliedAt: string;
      renewalId?: string | null | undefined;
    }) => {
      const { error } = await supabase.from("credit_entries").insert({
        member_id: input.memberId,
        trainer_id: trainerId!,
        delta: input.delta,
        kind: input.delta > 0 ? "charge" : "adjust",
        note: input.note || null,
        created_at: new Date(`${input.appliedAt}T12:00:00`).toISOString(),
      });
      if (error) throw error;
      if (input.renewalId) {
        const { error: renewalError } = await supabase
          .from("renewal_requests")
          .update({ status: "renewed", resolved_at: new Date().toISOString() })
          .eq("id", input.renewalId);
        if (renewalError) throw renewalError;
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("PT 횟수를 조정했습니다");
    },
    onError: () => toast.error("조정에 실패했습니다"),
  });

  const saveInfo = useMutation({
    mutationFn: async (input: { memberId: string; patch: Partial<Profile> }) => {
      const { error } = await supabase.from("profiles").update(input.patch).eq("id", input.memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("회원 정보를 저장했습니다");
    },
    onError: () => toast.error("저장에 실패했습니다"),
  });

  const remove = useMutation({
    mutationFn: async (memberId: string) => softDeleteMember({ data: { memberId } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("PT 이용을 종료했습니다. 기록은 보존됩니다.");
    },
    onError: (error: Error) => toast.error(error.message || "이용 종료 처리에 실패했습니다"),
  });

  const notes = useTrainerNotes(trainerId);

  const note = useMutation({
    mutationFn: async (input: { memberId: string; body: string }) =>
      saveTrainerNote({ trainerId: trainerId!, memberId: input.memberId, body: input.body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trainer-notes"] });
      toast.success("메모를 저장했습니다");
    },
    onError: () => toast.error("메모 저장에 실패했습니다"),
  });

  const restore = useMutation({
    mutationFn: async (memberId: string) => restoreMember({ data: { memberId } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("회원 이용을 다시 시작했습니다");
    },
    onError: (error: Error) => toast.error(error.message || "복구에 실패했습니다"),
  });

  const list = all.data ?? [];
  const active = list.filter((m) => !m.deleted_at);
  const deleted = list.filter((m) => m.deleted_at);

  const summary = {
    total: active.length,
    normal: active.filter((m) => remainingOf(m.id) >= 3).length,
    low: active.filter((m) => remainingOf(m.id) < 3).length,
  };

  const visible = active
    .filter((m) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        m.full_name.toLowerCase().includes(q) || (m.phone ?? "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === "name") return a.full_name.localeCompare(b.full_name, "ko");
      if (sort === "remaining") return remainingOf(a.id) - remainingOf(b.id);
      return +new Date(b.created_at) - +new Date(a.created_at);
    });

  return (
    <AppShell title="회원 관리" subtitle={`활동 회원 ${active.length}명`} role="trainer">
      <div className="grid grid-cols-3 gap-2">
        <SummaryTile label="전체 회원" value={summary.total} />
        <SummaryTile label="정상 이용 중" value={summary.normal} tone="lime" />
        <SummaryTile label="소진 임박" value={summary.low} tone="warn" />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="이름 또는 전화번호 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:flex-1"
        />
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="rounded-2xl border-2 sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">최근 등록순</SelectItem>
            <SelectItem value="name">이름순</SelectItem>
            <SelectItem value="remaining">남은 횟수 적은순</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Section title={`회원 목록 (${visible.length})`}>
        {all.isLoading ? (
          <ListSkeleton rows={3} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={active.length === 0 ? "연결된 회원이 없어요" : "검색 결과가 없어요"}
            description={
              active.length === 0
                ? "회원이 보낸 가입 요청을 승인하거나 초대 코드를 공유해 보세요."
                : "다른 이름이나 전화번호로 검색해 보세요."
            }
            action={
              active.length === 0 ? (
                <Button asChild className="rounded-2xl">
                  <Link to="/trainer/home">가입 요청 확인</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {visible.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                remaining={remainingOf(m.id)}
                busy={adjust.isPending || remove.isPending}
                renewalId={renewalByMember.get(m.id) ?? null}
                onAdjust={(delta, note, appliedAt, renewalId) =>
                  adjust.mutate({ memberId: m.id, delta, note, appliedAt, renewalId })
                }
                onSaveInfo={(patch) => saveInfo.mutate({ memberId: m.id, patch })}
                trainerNote={notes.data?.get(m.id) ?? ""}
                onSaveNote={(body) => note.mutate({ memberId: m.id, body })}
                noteSaving={note.isPending}
                onDelete={() => remove.mutate(m.id)}
              />
            ))}
          </div>
        )}
      </Section>

      <Section
        title={`이용 종료 회원 (${deleted.length})`}
        action={
          <Button
            variant="outline"
            size="sm"
            className="rounded-2xl border-2"
            onClick={() => setShowDeleted((v) => !v)}
          >
            {showDeleted ? "숨기기" : "보기"}
          </Button>
        }
      >
        {showDeleted &&
          (deleted.length === 0 ? (
            <EmptyState
              title="이용 종료 회원이 없어요"
              description="이용을 종료한 회원은 이곳에서 다시 시작할 수 있어요."
            />
          ) : (
            <div className="space-y-2">
              {deleted.map((m) => (
                <Card key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MemberAvatar name={m.full_name} photoPath={m.photo_path} size="sm" dimmed />
                    <div className="min-w-0">
                      <p className="truncate font-bold">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.phone ?? "연락처 미등록"} · 남은 {remainingOf(m.id)}회
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill tone="muted">이용 종료</StatusPill>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-2xl border-2"
                      onClick={() => restore.mutate(m.id)}
                      disabled={restore.isPending}
                    >
                      <RotateCcw className="mr-1 size-3" />
                      이용 재개
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ))}
      </Section>
    </AppShell>
  );
}

function SummaryTile({
  label,
  value,
  tone = "muted",
}: {
  label: string;
  value: number;
  tone?: "muted" | "lime" | "warn" | "alert" | "danger" | "ink";
}) {
  const dot: Record<string, string> = {
    muted: "bg-border-strong",
    lime: "bg-lime",
    warn: "bg-warn",
    alert: "bg-alert",
    danger: "bg-destructive",
    ink: "bg-ink",
  };
  return (
    <div className="rounded-2xl border border-border bg-card px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        <span className={cn("size-2 rounded-full", dot[tone])} />
        {label}
      </span>
      <p className="text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function MemberCard({
  member,
  remaining,
  busy,
  renewalId,
  onAdjust,
  onSaveInfo,
  trainerNote,
  onSaveNote,
  noteSaving,
  onDelete,
}: {
  member: Profile;
  remaining: number;
  busy: boolean;
  renewalId: string | null;
  onAdjust: (delta: number, note: string, appliedAt: string, renewalId?: string | null) => void;
  onSaveInfo: (patch: Partial<Profile>) => void;
  trainerNote: string;
  onSaveNote: (body: string) => void;
  noteSaving: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "sub">("add");
  const [count, setCount] = useState("1");
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [note, setNote] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteStep, setDeleteStep] = useState(false);
  const [renewalAsk, setRenewalAsk] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState(trainerNote);

  useEffect(() => {
    if (noteOpen) setNoteDraft(trainerNote);
  }, [noteOpen, trainerNote]);

  const state = memberState(member, remaining);
  const n = Math.abs(Math.trunc(Number(count) || 0));
  const delta = mode === "add" ? n : -n;
  const nextRemaining = remaining + delta;
  const invalid = n <= 0 ? "조정 횟수를 1 이상으로 입력해 주세요." : nextRemaining < 0 ? "차감 후 남은 횟수가 0회보다 작아질 수 없어요." : null;

  function apply(renewal: string | null) {
    onAdjust(delta, note.trim(), date, renewal);
    setNote("");
    setCount("1");
  }

  const phone = member.phone?.trim() || "";

  async function copyPhone() {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success("전화번호가 복사되었습니다");
    } catch {
      toast.error("복사에 실패했습니다");
    }
  }

  return (
    <Card className="space-y-3">
      {/* 1줄: 사진 · 이름 · 관리 · 더보기 */}
      <div className="flex items-center gap-2">
        <MemberAvatar name={member.full_name} photoPath={member.photo_path} size="md" />
        <p className="min-w-0 flex-1 truncate text-base font-extrabold">{member.full_name}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="relative size-9 rounded-2xl"
            aria-label={trainerNote ? "트레이너 메모 보기 (작성됨)" : "트레이너 메모 작성"}
            title={trainerNote || "트레이너 전용 메모"}
            onClick={() => setNoteOpen(true)}
          >
            <StickyNote className="size-4" />
            {!!trainerNote && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-lime ring-2 ring-card" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-2xl border-2 px-2.5"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            관리
            <ChevronDown className={cn("ml-1 size-3 transition-transform", open && "rotate-180")} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-9 rounded-2xl" aria-label="더보기">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil className="mr-2 size-4" /> 회원 정보 수정
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
                <StickyNote className="mr-2 size-4" /> 트레이너 메모
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  setDeleteStep(true);
                  setConfirmName("");
                }}
              >
                <PauseCircle className="mr-2 size-4" /> PT 이용 종료
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2줄: 전체 전화번호 · 전화 · 복사 */}
      <div className="flex items-center gap-2">
        {phone ? (
          <>
            <a
              href={`tel:${phone.replace(/[^0-9+]/g, "")}`}
              className="min-w-0 flex-1 text-sm font-bold tabular-nums underline-offset-4 hover:underline"
            >
              {phone}
            </a>
            <Button
              asChild
              size="icon"
              variant="outline"
              className="size-9 shrink-0 rounded-2xl border-2"
            >
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} aria-label={`${phone} 전화 걸기`}>
                <Phone className="size-4" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="size-9 shrink-0 rounded-2xl border-2"
              aria-label="전화번호 복사"
              onClick={copyPhone}
            >
              <Copy className="size-4" />
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">전화번호 없음</p>
        )}
      </div>

      {/* 3줄: 상태 · 남은 횟수 */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill tone={MEMBER_STATE_TONE[state]}>{MEMBER_STATE_LABEL[state]}</StatusPill>
        <span className="text-sm font-bold">남은 {remaining}회</span>
      </div>

      {!!trainerNote && (
        <p className="truncate text-xs text-muted-foreground">
          <StickyNote className="mr-1 inline size-3" />
          {trainerNote.split("\n")[0]}
        </p>
      )}


      <div
        className={cn(
          "grid overflow-hidden transition-all duration-300",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0">
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "add" ? "default" : "outline"}
                className={cn("flex-1 rounded-2xl", mode !== "add" && "border-2")}
                onClick={() => setMode("add")}
              >
                추가 +
              </Button>
              <Button
                type="button"
                variant={mode === "sub" ? "default" : "outline"}
                className={cn("flex-1 rounded-2xl", mode !== "sub" && "border-2")}
                onClick={() => setMode("sub")}
              >
                차감 −
              </Button>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="조정 횟수" htmlFor={`count-${member.id}`}>
                <Input
                  id={`count-${member.id}`}
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
              </Field>
              <Field label="적용 날짜" htmlFor={`date-${member.id}`}>
                <Input
                  id={`date-${member.id}`}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
            </div>

            <Field label="관리자 메모 (선택)" htmlFor={`note-${member.id}`}>
              <Input
                id={`note-${member.id}`}
                placeholder="예: 10회권 오프라인 결제"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>

            <p className="text-sm font-bold">
              {invalid ? (
                <span className="text-destructive">{invalid}</span>
              ) : (
                <>
                  {n}회 {mode === "add" ? "추가" : "차감"} · 적용 후 남은 {nextRemaining}회
                </>
              )}
            </p>

            <Button
              className="w-full rounded-2xl"
              disabled={!!invalid || busy}
              onClick={() => {
                if (delta > 0 && renewalId) {
                  setRenewalAsk(true);
                  return;
                }
                apply(null);
              }}
            >
              적용
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>{member.full_name} 회원 메모</DialogTitle>
            <DialogDescription>
              트레이너만 볼 수 있는 메모입니다. 회원에게는 표시되지 않아요.
            </DialogDescription>
          </DialogHeader>
          <Field label="트레이너 전용 메모" htmlFor={`note-memo-${member.id}`}>
            <Textarea
              id={`note-memo-${member.id}`}
              rows={6}
              placeholder={"예: 허리 부상 주의\n하체 운동 선호\n평일 저녁 가능"}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-2xl border-2"
              onClick={() => setNoteOpen(false)}
            >
              취소
            </Button>
            <Button
              className="rounded-2xl"
              disabled={noteSaving}
              onClick={() => {
                onSaveNote(noteDraft.trim());
                setNoteOpen(false);
              }}
            >
              메모 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditMemberDialog
        member={member}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(patch) => {
          onSaveInfo(patch);
          setEditOpen(false);
        }}
      />

      <AlertDialog open={renewalAsk} onOpenChange={setRenewalAsk}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>재등록 완료로 처리할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {member.full_name} 회원의 재등록 상담 요청이 열려 있어요. PT {n}회를 추가하면서 요청을
              재등록 완료로 함께 정리할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="rounded-2xl"
              onClick={() => {
                setRenewalAsk(false);
                apply(null);
              }}
            >
              충전만 하기
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl"
              onClick={() => {
                setRenewalAsk(false);
                apply(renewalId);
              }}
            >
              재등록 완료 처리
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteStep} onOpenChange={setDeleteStep}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              {member.full_name} 회원의 PT 이용을 종료할까요?
            </AlertDialogTitle>
            <AlertDialogDescription>
              예약, PT 사용 이력, 운동 기록, 프로필과 사진은 모두 보존됩니다. 계정은 차단되지 않고 신규 예약과 PT 이용만 제한되며, 남은 횟수는 보류됩니다.
              확인을 위해 회원 이름 <b>{member.full_name}</b> 을 입력해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={member.full_name}
            aria-label="회원 이름 확인"
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl">닫기</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={confirmName.trim() !== member.full_name}
              onClick={() => {
                if (confirmName.trim() !== member.full_name) return;
                onDelete();
                setDeleteStep(false);
              }}
            >
              이용 종료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function EditMemberDialog({
  member,
  open,
  onOpenChange,
  onSave,
}: {
  member: Profile;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<Profile>) => void;
}) {
  const [form, setForm] = useState({
    full_name: member.full_name,
    phone: member.phone ?? "",
    goal: member.goal ?? "",
    injuries: member.injuries ?? "",
    preferred_time: member.preferred_time ?? "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>회원 정보 수정</DialogTitle>
          <DialogDescription>이름과 연락처, 운동 정보를 수정할 수 있어요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="이름" htmlFor={`name-${member.id}`}>
            <Input
              id={`name-${member.id}`}
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </Field>
          <Field label="전화번호" htmlFor={`phone-${member.id}`}>
            <Input
              id={`phone-${member.id}`}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
          <Field label="운동 목표" htmlFor={`goal-${member.id}`}>
            <Input
              id={`goal-${member.id}`}
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
            />
          </Field>
          <Field label="선호 시간대" htmlFor={`pref-${member.id}`}>
            <Input
              id={`pref-${member.id}`}
              value={form.preferred_time}
              onChange={(e) => setForm({ ...form, preferred_time: e.target.value })}
            />
          </Field>
          <Field label="부상 이력" htmlFor={`inj-${member.id}`}>
            <Textarea
              id={`inj-${member.id}`}
              value={form.injuries}
              onChange={(e) => setForm({ ...form, injuries: e.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-2xl border-2" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            className="rounded-2xl"
            disabled={!form.full_name.trim()}
            onClick={() =>
              onSave({
                full_name: form.full_name.trim(),
                phone: form.phone.trim() || null,
                goal: form.goal.trim() || null,
                injuries: form.injuries.trim() || null,
                preferred_time: form.preferred_time.trim() || null,
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
