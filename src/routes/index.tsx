import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthCard } from "@/components/pt/AuthCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FORMFIT — PT 예약하고 기록하기" },
      {
        name: "description",
        content: "남은 PT 횟수, 예약, 운동기록을 한 곳에서. 트레이너를 검색해 바로 가입 요청하세요.",
      },
      { property: "og:title", content: "FORMFIT — PT 예약하고 기록하기" },
      {
        property: "og:description",
        content: "남은 PT 횟수, 예약, 운동기록을 한 곳에서 관리하는 퍼스널 트레이닝 앱.",
      },
    ],
  }),
  component: MemberAuthPage,
});

function MemberAuthPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center bg-background px-5 py-12">
      <div className="mx-auto w-full max-w-md">
        <p className="display-xl text-xs uppercase tracking-[0.4em] text-muted-foreground">
          personal training
        </p>
        <h1 className="display-xl mt-3 text-6xl">
          FORM
          <span className="text-lime">FIT</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          남은 PT 횟수, 다음 예약, 오늘의 피드백까지 한 화면에서 확인하세요.
        </p>

        <div className="mt-8">
          <AuthCard role="member" />
        </div>

        <div className="mt-5 rounded-2xl border-2 border-dashed border-border-strong px-4 py-4 text-sm">
          <p className="font-bold">초대코드가 없어도 괜찮아요</p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            가입 후 트레이너를 이름으로 검색해 가입 요청을 보낼 수 있고, 트레이너가 보내준 초대 링크로
            바로 요청할 수도 있습니다.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          트레이너세요?{" "}
          <Link to="/trainer-login" className="font-bold text-foreground underline">
            트레이너로 로그인
          </Link>
        </p>
      </div>
    </div>
  );
}
