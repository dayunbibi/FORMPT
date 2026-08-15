import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppShell } from "@/components/pt/AppShell";
import { useRoleGate } from "@/components/pt/guards";
import { Card, EmptyState, FieldLabel, ListSkeleton, Section, StatusPill } from "@/components/pt/kit";
import {
  REQUEST_STATUS_LABEL,
  inviteErrorMessage,
  joinRequestErrorMessage,
  requestStatusTone,
} from "@/lib/connect";

type Tab = "code" | "search";

export const Route = createFileRoute("/_authenticated/connect")({
  validateSearch: (search: Record<string, unknown>): { tab: Tab } => ({
    tab: search["tab"] === "search" ? "search" : "code",
  }),
  head: () => ({
    meta: [
      { title: "트레이너 연결 — FORMFIT" },
      {
        name: "description",
        content: "초대코드를 입력하거나 트레이너를 검색해 연결 요청을 보내세요.",
      },
      { property: "og:title", content: "트레이너 연결 — FORMFIT" },
      { property: "og:description", content: "초대코드 또는 검색으로 담당 트레이너와 연결하기." },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const me = useRoleGate("member", { skipOnboarding: true, allowEnded: true });
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<{ trainer_id: string; trainer_name: string } | null>(null);
  const [term, setTerm] = useState("");

  const linked = !!me.data?.profile?.trainer_id;
  const myName = (me.data?.profile?.full_name ?? "").trim();

  const check = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("preview_invite_code", { _code: code.trim() });
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) throw new Error("invalid code");
      return row;
    },
    onSuccess: (row) => setPreview(row),
    onError: (error: { message?: string }) => toast.error(inviteErrorMessage(error)),
  });

  const redeem = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("redeem_invite_code", { _code: code.trim() });
      if (error) throw error;
      const row = (data ?? [])[0];
      if (!row) throw new Error("invalid code");
      return row;
    },
    onSuccess: async (row) => {
      setCode("");
      setPreview(null);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["my-join-requests"] });
      toast.success(`${row.trainer_name} 트레이너와 연결되었습니다`);
      navigate({ to: "/home" });
    },
    onError: (error: { message?: string }) => toast.error(inviteErrorMessage(error)),
  });

  const trimmed = term.trim();
  const results = useQuery({
    queryKey: ["trainer-search", trimmed],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_trainers", { _term: trimmed });
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string }[];
    },
    enabled: !!me.data && trimmed.length >= 2,
  });

  const myRequests = useQuery({
    queryKey: ["my-join-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("join_requests")
        .select("id, trainer_id, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!me.data,
  });

  const request = useMutation({
    mutationFn: async (trainerId: string) => {
      if (!myName) throw new Error("no name");
      const { error } = await supabase.from("join_requests").insert({
        member_id: me.data!.user.id,
        trainer_id: trainerId,
        message: (me.data?.profile?.goal ?? "").trim().slice(0, 200) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-join-requests"] });
      toast.success("연결 요청을 보냈습니다. 트레이너 승인을 기다려 주세요.");
    },
    onError: (error: { message?: string; code?: string }) => {
      if (error?.message === "no name") {
        toast.error("먼저 내 정보에서 이름을 입력해 주세요.");
        return;
      }
      toast.error(joinRequestErrorMessage(error));
    },
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("join_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-join-requests"] });
      toast.success("요청을 취소했습니다");
    },
    onError: () => toast.error("취소하지 못했어요. 잠시 후 다시 시도해 주세요."),
  });

  const requestFor = (id: string) => myRequests.data?.find((r) => r.trainer_id === id);

  if (linked) {
    return (
      <AppShell title="트레이너 연결" subtitle="담당 트레이너와 연결되어 있어요" role="member">
        <EmptyState
          title="이미 담당 트레이너와 연결되어 있어요"
          description="트레이너 변경이 필요하면 담당 트레이너에게 문의해 주세요."
          action={
            <Button asChild className="rounded-2xl">
              <Link to="/home">홈으로</Link>
            </Button>
          }
        />
      </AppShell>
    );
  }

  return (
    <AppShell title="트레이너 연결" subtitle="초대코드 또는 이름 검색으로 연결해요" role="member">
      <div className="flex gap-2">
        <Button
          variant={tab === "code" ? "default" : "outline"}
          className="flex-1 rounded-2xl border-2"
          onClick={() => navigate({ to: "/connect", search: { tab: "code" } })}
        >
          초대코드
        </Button>
        <Button
          variant={tab === "search" ? "default" : "outline"}
          className="flex-1 rounded-2xl border-2"
          onClick={() => navigate({ to: "/connect", search: { tab: "search" } })}
        >
          트레이너 찾기
        </Button>
      </div>

      {tab === "code" ? (
        <Section title="초대코드로 연결하기">
          {preview ? (
            <Card className="space-y-3">
              <p className="text-sm text-muted-foreground">아래 트레이너와 연결할까요?</p>
              <p className="text-2xl font-extrabold">{preview.trainer_name}</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 rounded-2xl"
                  disabled={redeem.isPending}
                  onClick={() => redeem.mutate()}
                >
                  {redeem.isPending ? "연결 중..." : "연결하기"}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 rounded-2xl border-2"
                  onClick={() => setPreview(null)}
                >
                  다시 입력
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="space-y-3">
              <p className="text-sm leading-relaxed text-muted-foreground">
                트레이너에게 받은 초대코드를 입력하면 대상 트레이너를 확인한 뒤 바로 연결됩니다.
              </p>
              <div>
                <FieldLabel htmlFor="invite">초대코드</FieldLabel>
                <Input
                  id="invite"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="예: A7KQ2M9X"
                  maxLength={12}
                  className="rounded-2xl tracking-[0.25em]"
                />
              </div>
              <Button
                className="w-full rounded-2xl"
                disabled={check.isPending || code.trim().length < 4}
                onClick={() => check.mutate()}
              >
                {check.isPending ? "확인 중..." : "초대코드로 연결하기"}
              </Button>
            </Card>
          )}
        </Section>
      ) : (
        <Section title="트레이너 찾기">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="트레이너 이름 2글자 이상 입력"
              className="rounded-2xl pl-9"
            />
          </div>
          {trimmed.length < 2 ? (
            <EmptyState
              title="이름을 2글자 이상 입력해 주세요"
              description="트레이너 이름을 검색해 연결 요청을 보낼 수 있어요. 전체 목록은 공개되지 않습니다."
            />
          ) : results.isLoading ? (
            <ListSkeleton rows={2} />
          ) : (results.data ?? []).length === 0 ? (
            <EmptyState
              title="검색 결과가 없어요"
              description="이름을 다시 확인하거나, 트레이너에게 초대코드를 요청해 주세요."
            />
          ) : (
            <div className="space-y-2">
              {(results.data ?? []).map((t) => {
                const req = requestFor(t.id);
                return (
                  <Card key={t.id} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold">{t.full_name}</p>
                      <p className="text-xs text-muted-foreground">퍼스널 트레이너</p>
                    </div>
                    {req ? (
                      <div className="flex items-center gap-2">
                        <StatusPill tone={requestStatusTone(req.status)}>
                          {REQUEST_STATUS_LABEL[req.status] ?? req.status}
                        </StatusPill>
                        {req.status === "pending" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="rounded-2xl"
                            disabled={cancel.isPending}
                            onClick={() => cancel.mutate(req.id)}
                          >
                            요청 취소
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="rounded-2xl border-2"
                        disabled={request.isPending}
                        onClick={() => request.mutate(t.id)}
                      >
                        연결 요청
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      )}
    </AppShell>
  );
}
