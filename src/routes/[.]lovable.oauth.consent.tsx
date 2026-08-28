import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/pt/kit";

type OAuthResult = {
  data?: { redirect_url?: string; redirect_to?: string; client?: { name?: string } | null } | null;
  error?: { message: string } | null;
};

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

// supabase.auth.oauth 는 베타 네임스페이스라 타입이 노출되지 않는다.
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  // 브라우저 전용: Supabase 세션은 localStorage 에 있으므로 SSR 단계에서는 읽을 수 없다.
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("authorization_id 가 없습니다");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ href: `/?next=${encodeURIComponent(next)}` });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data ?? null;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <Card className="space-y-2">
        <h1 className="display-xl text-2xl">연결 요청을 불러올 수 없어요</h1>
        <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
      </Card>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "외부 앱";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error: err } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("인증 서버가 이동할 주소를 반환하지 않았습니다.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <p className="display-xl text-xs uppercase tracking-[0.4em] text-muted-foreground">connect</p>
      <h1 className="display-xl mt-3 text-3xl">
        {clientName}을(를) 내 계정에 연결할까요?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        연결하면 {clientName}이(가) 내 계정 권한으로 FORMPT 데이터를 읽고 쓸 수 있습니다. 회원은 본인 데이터,
        트레이너는 담당 회원 데이터까지만 접근됩니다.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-sm font-bold text-destructive">
          {error}
        </p>
      )}

      <div className="mt-8 flex gap-2">
        <Button className="flex-1 rounded-2xl" disabled={busy} onClick={() => decide(true)}>
          연결 허용
        </Button>
        <Button
          variant="outline"
          className="flex-1 rounded-2xl border-2"
          disabled={busy}
          onClick={() => decide(false)}
        >
          거절
        </Button>
      </div>
    </main>
  );
}
