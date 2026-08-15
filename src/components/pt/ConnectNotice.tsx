import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/pt/kit";

/** 미연결 회원에게 보여주는 홈 안내 카드 */
export function ConnectPrompt() {
  return (
    <Card className="space-y-4 border-2 border-ink bg-card">
      <div>
        <p className="text-base font-extrabold">아직 연결된 트레이너가 없어요</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          초대코드를 입력하거나 트레이너를 찾아 연결을 요청해 보세요.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="flex-1 rounded-2xl">
          <Link to="/connect" search={{ tab: "code" }}>
            초대코드 입력
          </Link>
        </Button>
        <Button asChild variant="outline" className="flex-1 rounded-2xl border-2">
          <Link to="/connect" search={{ tab: "search" }}>
            트레이너 찾기
          </Link>
        </Button>
      </div>
    </Card>
  );
}

/** 예약·이용권·운동기록 등 트레이너가 필요한 화면의 안내 */
export function ConnectRequired({ description }: { description: string }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-border-strong bg-card/60 px-6 py-10 text-center">
      <p className="text-base font-extrabold">담당 트레이너 연결이 먼저 필요해요</p>
      <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button asChild className="rounded-2xl">
          <Link to="/connect" search={{ tab: "code" }}>
            초대코드 입력
          </Link>
        </Button>
        <Button asChild variant="outline" className="rounded-2xl border-2">
          <Link to="/connect" search={{ tab: "search" }}>
            트레이너 찾기
          </Link>
        </Button>
      </div>
    </div>
  );
}
