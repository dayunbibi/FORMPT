import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldLabel } from "@/components/pt/kit";
import { getMe, type Role } from "@/lib/pt";

const schema = z.object({
  email: z.string().trim().email({ message: "이메일 형식을 확인해 주세요" }).max(255),
  password: z.string().min(6, { message: "비밀번호는 6자 이상이어야 합니다" }).max(72),
  full_name: z.string().trim().max(40).optional(),
});

export function AuthCard({ role }: { role: Role }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentMail, setSentMail] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive || !data.session) return;
      queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate({ to: role === "trainer" ? "/trainer/home" : "/home", replace: true });
    });
    return () => {
      alive = false;
    };
  }, [navigate, queryClient, role]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, full_name: fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: parsed.data.full_name || parsed.data.email.split("@")[0], role },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSentMail(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      await queryClient.invalidateQueries();
      navigate({ to: role === "trainer" ? "/trainer/home" : "/home", replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }

  if (sentMail) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-xl">메일함을 확인해 주세요</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {email} 으로 인증 메일을 보냈습니다. 링크를 누르면 가입이 완료되고 바로 로그인됩니다.
        </p>
        <Button className="mt-5 w-full rounded-2xl" variant="outline" onClick={() => setSentMail(false)}>
          다른 계정으로 시도
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="mb-5 flex gap-2 rounded-2xl bg-secondary p-1">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={
              "flex-1 rounded-xl px-3 py-2 text-sm font-bold " +
              (mode === m ? "bg-ink text-ink-foreground" : "text-muted-foreground")
            }
          >
            {m === "login" ? "로그인" : "회원가입"}
          </button>
        ))}
      </div>

      {mode === "signup" && (
        <div className="mb-4">
          <FieldLabel htmlFor="full_name">이름</FieldLabel>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="홍길동"
            className="rounded-2xl"
          />
        </div>
      )}

      <div className="mb-4">
        <FieldLabel htmlFor="email">이메일</FieldLabel>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-2xl"
        />
      </div>

      <div className="mb-6">
        <FieldLabel htmlFor="password">비밀번호</FieldLabel>
        <Input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6자 이상"
          className="rounded-2xl"
        />
      </div>

      <Button type="submit" disabled={busy} className="w-full rounded-2xl py-6 text-base font-extrabold">
        {busy ? "잠시만요..." : mode === "login" ? "로그인" : "가입하고 시작하기"}
      </Button>
    </form>
  );
}
