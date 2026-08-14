import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard } from "@/components/pt/AuthCard";

export const Route = createFileRoute("/trainer-login")({
  head: () => ({
    meta: [
      { title: "트레이너 로그인 — FORMFIT" },
      {
        name: "description",
        content: "회원 예약 승인, 이용권 관리, 운동기록 작성을 위한 트레이너 전용 로그인.",
      },
      { property: "og:title", content: "트레이너 로그인 — FORMFIT" },
      {
        property: "og:description",
        content: "예약 승인과 회원 관리를 한 화면에서 처리하는 트레이너 콘솔.",
      },
    ],
  }),
  component: TrainerAuthPage,
});

function TrainerAuthPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <p className="display-xl text-xs uppercase tracking-[0.4em] text-muted-foreground">
          trainer console
        </p>
        <h1 className="display-xl mt-3 text-5xl">트레이너 로그인</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          승인 대기, 오늘 수업, 회원 이용권을 한 화면에서 처리하세요.
        </p>

        <div className="mt-8">
          <AuthCard role="trainer" allowSignup={false} />
        </div>

        <p className="mt-4 rounded-2xl border-2 border-dashed border-border-strong px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          트레이너 계정은 서비스 설정 시 1회 발급됩니다. 별도의 트레이너 회원가입은 제공하지 않습니다.
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          회원이세요?{" "}
          <Link to="/" className="font-bold text-foreground underline">
            회원 로그인으로 이동
          </Link>
        </p>
      </div>
    </div>
  );
}
