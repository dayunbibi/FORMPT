import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Trash2 } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { MemberAvatar } from "@/components/pt/MemberAvatar";
import { Card, Section } from "@/components/pt/kit";
import { removeMemberPhoto, uploadMemberPhoto, validatePhoto } from "@/lib/memberPhoto";

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

  const profile = me.data?.profile ?? null;

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

      <Section title="기본 정보">
        <Card className="space-y-3">
          <Row label="이름" value={profile?.full_name ?? "-"} />
          <Row label="이메일" value={me.data?.email ?? "-"} />
          <Row label="연락처" value={profile?.phone ?? "미등록"} />
          <Row label="운동 목표" value={profile?.goal ?? "미등록"} />
          <Row label="부상 이력" value={profile?.injuries ?? "없음"} />
          <Row label="선호 시간대" value={profile?.preferred_time ?? "미등록"} />
        </Card>
      </Section>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-bold">{value}</span>
    </div>
  );
}
