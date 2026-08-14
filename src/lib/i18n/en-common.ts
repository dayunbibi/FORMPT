/** 공통 UI 문구 (네비게이션, 로그인, 상태 배지, 에러 화면) */
export const EN_COMMON: Record<string, string> = {
  // 언어 토글
  "언어 선택": "Language",

  // 네비게이션
  홈: "Home",
  예약하기: "Book",
  예약목록: "Bookings",
  운동기록: "Workouts",
  이용권: "Pass",
  오늘: "Today",
  캘린더: "Calendar",
  회원: "Members",
  기록작성: "Log",
  현황: "Insights",
  설정: "Settings",
  로그아웃: "Sign out",

  // 상태 배지
  승인대기: "Pending",
  확정: "Confirmed",
  취소완료: "Cancelled",
  수업완료: "Completed",
  노쇼: "No-show",
  취소요청: "Cancel requested",

  // 로그인 / 가입
  로그인: "Sign in",
  회원가입: "Sign up",
  이름: "Name",
  이메일: "Email",
  비밀번호: "Password",
  홍길동: "Jane Doe",
  "6자 이상": "At least 6 characters",
  "잠시만요...": "One moment...",
  "가입하고 시작하기": "Create account",
  "다른 계정으로 시도": "Use another account",
  "메일함을 확인해 주세요": "Check your inbox",
  "{email} 으로 인증 메일을 보냈습니다. 링크를 누르면 가입이 완료되고 바로 로그인됩니다.":
    "We sent a confirmation email to {email}. Tap the link to finish signing up and log in.",
  "이메일 형식을 확인해 주세요": "Please enter a valid email address",
  "비밀번호는 6자 이상이어야 합니다": "Password must be at least 6 characters",
  "입력값을 확인해 주세요": "Please check your input",
  "잠시 후 다시 시도해 주세요": "Please try again in a moment",

  // 회원 로그인 화면
  "personal training": "personal training",
  "남은 PT 횟수, 다음 예약, 오늘의 피드백까지 한 화면에서 확인하세요.":
    "Sessions left, your next booking and today's feedback — all on one screen.",
  "초대코드가 없어도 괜찮아요": "No invite code needed",
  "가입 후 트레이너를 이름으로 검색해 가입 요청을 보낼 수 있고, 트레이너가 보내준 초대 링크로 바로 요청할 수도 있습니다.":
    "After signing up you can search for a trainer by name and send a join request, or use an invite link your trainer shared.",
  "트레이너이신가요? →": "Are you a trainer? →",

  // 트레이너 로그인 화면
  "trainer console": "trainer console",
  "트레이너 로그인": "Trainer sign in",
  "승인 대기, 오늘 수업, 회원 이용권을 한 화면에서 처리하세요.":
    "Handle approvals, today's sessions and member passes in one place.",
  "트레이너 계정은 서비스 설정 시 1회 발급됩니다. 별도의 트레이너 회원가입은 제공하지 않습니다.":
    "Trainer accounts are issued once during setup. There is no separate trainer sign-up.",
  "회원이세요?": "Are you a member?",
  "회원 로그인으로 이동": "Go to member sign in",

  // 에러 / 404
  "페이지를 찾을 수 없습니다": "Page not found",
  "주소가 변경되었거나 삭제된 페이지입니다.": "This page was moved or removed.",
  홈으로: "Go home",
  "화면을 불러오지 못했습니다": "We couldn't load this screen",
  "잠시 후 다시 시도해 주세요.": "Please try again in a moment.",
  "다시 시도": "Try again",

  // 공통 액션 / 단어
  닫기: "Close",
  취소: "Cancel",
  저장: "Save",
  "저장 중...": "Saving...",
  확인: "Confirm",
  회: "sessions",
  건: "booked",
  분: "min",
  세트: "sets",
  없음: "None",
  "통화 (Currency)": "Currency",
  "기본 통화": "Default currency",
  "원 (KRW)": "Korean won (KRW)",
  "캐나다달러 (CAD)": "Canadian dollar (CAD)",
  // 에이전트 연결 동의
  "연결 요청을 불러올 수 없어요": "We couldn't load this connection request",
  "외부 앱": "External app",
  "인증 서버가 이동할 주소를 반환하지 않았습니다.": "The authorization server did not return a redirect address.",
  "{app}을(를) 내 계정에 연결할까요?": "Connect {app} to your account?",
  "연결하면 {app}이(가) 내 계정 권한으로 FORMFIT 데이터를 읽고 쓸 수 있습니다. 회원은 본인 데이터, 트레이너는 담당 회원 데이터까지만 접근됩니다.":
    "Once connected, {app} can read and write your FORMFIT data with your permissions. Members can only access their own data; trainers only their own members' data.",
  "연결 허용": "Allow",
  거절: "Deny",
};
