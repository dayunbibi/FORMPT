# Fit Coach Hub

퍼스널 트레이닝(PT) 예약/관리 앱을 만들어줘. 트레이너 1명과 회원 여러 명이 함께 쓰는 서비스로, 트레이너용 화면과 회원용 화면이 분리되어 있어야 해.

디자인 스타일
크림색(#F5F3EB 톤) 배경에 블랙과 라임그린(#C4E538 톤) 포인트 컬러를 쓰는 미니멀하고 스포티한 스타일로 만들어줘. 카드와 버튼은 둥근 모서리(rounded-2xl 정도)를 쓰고, 로고/헤딩은 굵고 큰 산세리프 타이포로, 본문은 절제된 회색톤 텍스트로 위계를 명확히 해줘. 다크 카드(예: 남은 PT 횟수, 통계 카드) 안에 라임그린 숫자를 강조해서 핵심 정보가 한눈에 들어오게 해줘. 모든 입력창은 기본 상태에서도 테두리가 배경과 뚜렷이 구분되도록 하고, 포커스 시 라임그린 링으로 강조해줘.

회원용 화면
로그인은 이메일/비밀번호 기본에 더해, 초대코드가 없어도 트레이너를 검색하거나 링크로 가입 요청을 보낼 수 있는 방식도 옵션으로 추가해줘. 온보딩 시 운동 목표, 부상 이력, 선호 운동 시간대 같은 간단한 설문을 받아서 트레이너가 참고할 수 있게 해줘. 홈 화면에는 남은 PT 횟수, 다음 예약, 오늘의 운동/피드백 요약을 카드로 보여주고, 예약하기는 캘린더에서 날짜와 가능한 시간을 선택하는 방식으로 만들어줘. 예약 목록은 "예정된 예약"과 "지난 예약"을 예약 시간 기준으로 정확히 나누고, 취소 가능한 버튼과 취소완료/노쇼 같은 상태 배지는 서로 다른 스타일(버튼은 테두리형, 배지는 채워진 pill형)로 명확히 구분해줘. 운동기록 화면은 날짜별로 운동 종목, 무게, 횟수, 세트, 트레이너 피드백을 타임라인 형태로 보여주고, 이전 기록과 비교해서 무게나 횟수가 늘었으면 작은 증가 표시를 해줘. 이용권 화면은 남은 횟수와 사용 이력이 항상 일치하도록 하고, 결제/충전 이력도 함께 보여줘. 예약일이 다가오면 알림(푸시 또는 인앱 배너)으로 리마인드해주는 기능도 넣어줘.

트레이너용(관리자) 화면
첫 화면은 오늘 처리해야 할 승인 대기/취소 요청과 오늘 예약된 수업을 가장 먼저 보여줘. 캘린더는 월간 뷰에서 날짜별로 예약 상태를 색상 점으로만 표시하고, 날짜를 탭하면 그날의 예약 리스트가 펼쳐지는 방식으로 만들어줘. 회원 관리 화면에서는 회원별 남은 횟수, 연락처, 이용 현황을 카드로 보여주고, 횟수 조정이나 충전 같은 가벼운 액션과 이용 정지처럼 되돌리기 어려운 액션은 색상과 확인 팝업으로 명확히 구분해줘. 운동기록 작성 화면은 회원 선택 후 운동 항목을 여러 개 추가할 수 있게 하고, 각 입력칸(운동 이름/무게/횟수/세트)에는 항상 보이는 라벨을 붙여줘. 운영시간과 예약 정책(수업 시간, 예약/취소 마감 시간, 휴무일 설정)을 관리하는 설정 화면도 포함해줘. 간단한 대시보드(이번 달 수업 수, 노쇼율, 회원별 재등록 임박 알림)를 추가해서 트레이너가 운영 현황을 한눈에 파악할 수 있게 해줘.

전반적으로
빈 상태(데이터 없을 때)에는 안내 문구와 함께 다음 행동을 유도하는 버튼을 넣어줘. 로딩 중에는 스켈레톤 UI를 써줘. 모바일 화면을 기준으로 최적화하되, 데스크톱에서는 콘텐츠가 중앙 정렬되고 여백이 자연스럽게 채워지도록 반응형으로 만들어줘.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bd1e4d4a-a48a-4364-84d1-4a6d27544601).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
