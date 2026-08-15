import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { MemberAvatar } from "@/components/pt/MemberAvatar";
import { Card, Section, StatusPill } from "@/components/pt/kit";
import {
  OPEN_WITHDRAWAL_STATUSES,
  WITHDRAWAL_STATUS_LABEL,
  WITHDRAWAL_STATUS_TONE,
  useMyWithdrawal,
} from "@/lib/withdrawal";
import { removeMemberPhoto, uploadMemberPhoto, validatePhoto } from "@/lib/memberPhoto";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "내 정보 — FORMFIT 회원" },
      {
        name: "description",
        content: "프로필 사진과 내 기본 정보를 확인하고 얼굴 사진을 직접 등록하거나 삭제하세요.",
      },
      { property: "og:title", content: "내 정보 — FORMFIT 회원" },
      { property: "og:description", content: "프로필 사진 등록·삭제와 기본 정보 확인." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const me = useRoleGate("member");
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [editing, setEditing] = useState(false);

  const profile = me.data?.profile ?? null;
  const withdrawal = useMyWithdrawal(profile?.id).data ?? null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["member-photo"] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) =>
      uploadMemberPhoto(profile!.id, file, profile!.photo_path),
    onSuccess: () => {
      refresh();
      toast.success("프로필 사진을 저장했습니다");
    },
    onError: (error: Error) => toast.error(error.message || "사진 업로드에 실패했습니다"),
  });

  const remove = useMutation({
    mutationFn: async () => removeMemberPhoto(profile!.id, profile!.photo_path),
    onSuccess: () => {
      refresh();
      toast.success("프로필 사진을 삭제했습니다");
    },
    onError: () => toast.error("사진 삭제에 실패했습니다"),
  });

  const updateProfile = useMutation({
    mutationFn: async (values: ProfileForm) => {
      if (!profile) throw new Error("프로필 정보를 불러오지 못했습니다");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: values.full_name.trim(),
          phone: values.phone.trim() || null,
          goal: values.goal.trim() || null,
          injuries: values.injuries.trim() || null,
          preferred_time: values.preferred_time.trim() || null,
        })
        .eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["me"] });
      setEditing(false);
      toast.success("기본 정보를 저장했습니다");
    },
    onError: (error: Error) => toast.error(error.message || "정보 저장에 실패했습니다"),
  });

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const invalid = validatePhoto(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    upload.mutate(file);
  }

  const busy = upload.isPending || remove.isPending;

  return (
    <AppShell title="내 정보" subtitle="프로필 사진과 기본 정보" role="member">
      <Section title="프로필 사진">
        <Card className="flex flex-col items-center gap-4 py-6 sm:flex-row sm:items-center sm:gap-6">
          <MemberAvatar
            name={profile?.full_name ?? "회원"}
            photoPath={profile?.photo_path}
            size="lg"
            className="size-28 rounded-3xl text-3xl"
          />
          <div className="flex w-full flex-1 flex-col gap-2 sm:w-auto">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={pick}
            />
            <Button
              className="rounded-2xl"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="mr-2 size-4" />
              {profile?.photo_path ? "사진 변경" : "사진 등록"}
            </Button>
            {profile?.photo_path && (
              <Button
                variant="outline"
                className="rounded-2xl border-2 text-destructive"
                disabled={busy}
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 className="mr-2 size-4" /> 사진 삭제
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              등록한 사진은 나와 담당 트레이너만 볼 수 있어요.
            </p>
          </div>
        </Card>
      </Section>

      <Section
        title="기본 정보"
        action={
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-2"
            disabled={!profile}
            onClick={() => setEditing(true)}
          >
            <Pencil className="mr-1.5 size-3.5" /> 편집
          </Button>
        }
      >
        <Card className="space-y-3">
          <Row label="이름" value={profile?.full_name ?? "-"} />
          <Row label="이메일" value={me.data?.email ?? "-"} />
          <Row label="연락처" value={profile?.phone ?? "미등록"} />
          <Row label="운동 목표" value={profile?.goal ?? "미등록"} />
          <Row label="부상 이력" value={profile?.injuries ?? "없음"} />
          <Row label="선호 시간대" value={profile?.preferred_time ?? "미등록"} />
        </Card>
      </Section>

      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        {withdrawal && OPEN_WITHDRAWAL_STATUSES.includes(withdrawal.status) && (
          <StatusPill tone={WITHDRAWAL_STATUS_TONE[withdrawal.status]}>
            {WITHDRAWAL_STATUS_LABEL[withdrawal.status]}
          </StatusPill>
        )}
        <Link
          to="/withdraw"
          className="text-xs font-bold text-destructive underline underline-offset-4"
        >
          회원 탈퇴 요청
        </Link>
      </div>

      {profile && (
        <EditProfileDialog
          key={`${profile.id}-${editing}`}
          open={editing}
          onOpenChange={setEditing}
          initialValues={{
            full_name: profile.full_name,
            phone: profile.phone ?? "",
            goal: profile.goal ?? "",
            injuries: profile.injuries ?? "",
            preferred_time: profile.preferred_time ?? "",
          }}
          saving={updateProfile.isPending}
          onSave={(values) => updateProfile.mutate(values)}
        />
      )}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>프로필 사진을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              삭제하면 사진이 완전히 지워지고, 이름 첫 글자가 표시됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-2">취소</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => remove.mutate()}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

type ProfileForm = {
  full_name: string;
  phone: string;
  goal: string;
  injuries: string;
  preferred_time: string;
};

function EditProfileDialog({
  open,
  onOpenChange,
  initialValues,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues: ProfileForm;
  saving: boolean;
  onSave: (values: ProfileForm) => void;
}) {
  const [form, setForm] = useState(initialValues);

  const field = (key: keyof ProfileForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>기본 정보 편집</DialogTitle>
          <DialogDescription>변경할 내용을 입력한 뒤 저장해 주세요.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <EditField label="이름" htmlFor="profile-name">
            <Input
              id="profile-name"
              value={form.full_name}
              onChange={(e) => field("full_name", e.target.value)}
            />
          </EditField>
          <EditField label="연락처" htmlFor="profile-phone">
            <Input
              id="profile-phone"
              type="tel"
              placeholder="010-0000-0000"
              value={form.phone}
              onChange={(e) => field("phone", e.target.value)}
            />
          </EditField>
          <EditField label="운동 목표" htmlFor="profile-goal">
            <Input
              id="profile-goal"
              placeholder="예: 체력 향상, 근력 증가"
              value={form.goal}
              onChange={(e) => field("goal", e.target.value)}
            />
          </EditField>
          <EditField label="부상 이력" htmlFor="profile-injuries">
            <Textarea
              id="profile-injuries"
              placeholder="없으면 비워 두세요"
              value={form.injuries}
              onChange={(e) => field("injuries", e.target.value)}
            />
          </EditField>
          <EditField label="선호 시간대" htmlFor="profile-preferred-time">
            <Input
              id="profile-preferred-time"
              placeholder="예: 평일 저녁 7시 이후"
              value={form.preferred_time}
              onChange={(e) => field("preferred_time", e.target.value)}
            />
          </EditField>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-2xl border-2"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button
            className="rounded-2xl"
            disabled={saving || !form.full_name.trim()}
            onClick={() => onSave(form)}
          >
            {saving ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-bold">{value}</span>
    </div>
  );
}
