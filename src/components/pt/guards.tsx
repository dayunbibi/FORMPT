import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMe, isEndedMember, type Role } from "@/lib/pt";

/**
 * 역할이 맞지 않으면 해당 역할의 첫 화면으로 보낸다.
 * 회원 온보딩 미완료 시 설문으로, 이용이 종료된 회원은 제한 화면(/ended)으로 보낸다.
 */
export function useRoleGate(
  expected: Role,
  options?: { skipOnboarding?: boolean; allowEnded?: boolean },
) {
  const me = useMe();
  const navigate = useNavigate();
  const role = me.data?.role;
  const profile = me.data?.profile;
  const onboarded = profile?.onboarded;
  const ended = isEndedMember(profile);

  useEffect(() => {
    if (me.isLoading || !me.data) return;
    if (role && role !== expected) {
      navigate({ to: role === "trainer" ? "/trainer/home" : "/home", replace: true });
      return;
    }
    if (expected === "member" && ended && !options?.allowEnded) {
      navigate({ to: "/ended", replace: true });
      return;
    }
    if (expected === "member" && !options?.skipOnboarding && onboarded === false) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [
    me.isLoading,
    me.data,
    role,
    onboarded,
    ended,
    expected,
    navigate,
    options?.skipOnboarding,
    options?.allowEnded,
  ]);

  return me;
}
