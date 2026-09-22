# Review 지침 — 포모도로 타이머 (apps/pomodoro)

당신은 검증 담당이다. Build 를 한 에이전트와 다른 사람이라고 생각하고, 코드를 믿지 말고 브라우저에서 실측하라. 산출물은 `apps/pomodoro/review.md` 이며, 발견한 문제는 `apps/pomodoro/` 안에서 직접 고친 뒤 재확인한다.

## 먼저 읽을 것

1. `apps/pomodoro/spec.md` — 특히 **12절 검증 체크리스트**. 이것이 기준이다. 머리말의 "재현 불가 항목은 시뮬레이션 + 코드 확인, 판정은 DOM 값으로" 원칙을 따른다.
2. 루트 `CLAUDE.md`, 그리고 첫 앱의 `apps/sudoku/review.md`(형식·수준 참고)
3. `apps/pomodoro/` 소스 전체

## Build 가 명세와 다르게 한 것 (각각 타당한지 판정해서 review.md 에 적는다)

- `applySettings`·`complete` 가 `cyclePos` 를 `interval` 로 잘라 내림 (저장 상태가 `isValidState` 에 걸려 버려지는 것을 막기 위해)
- `normalizeSettings` 빈 값·NaN → 기본값, "이전 값 복원" 은 `app.js` `onSettingChange` 가 담당
- 설정 변경 시 `pomodoro:state` 도 저장, 로드 시 idle 이면 `applySettings` 한 번 적용
- `isValidState` 가 `durationMs === 0` 거부
- 정각 안내는 분 값이 줄어들 때만
- `dateKey` 가 `new Date(0); d.setTime(now)` 사용 (grep 오탐 회피)

타당하면 "명세 보완" 으로, 부적절하면 고치고 "수정" 으로.

## Build 가 미확인·집중 요청한 곳 (반드시)

- `render()` 의 정각/10초 안내: 시작·건너뛰기·리셋·완료 직후 첫 렌더에서 정각 안내가 새지 않는지 `MutationObserver` 로 라이브 영역 변경 로그를 남겨 확인.
- `finish()` 가 `tick` / 단발 `setTimeout` / `visibilitychange` / `storage` 네 경로에서 불려도 한 번만 처리되는지 — `Date.now` 를 앞으로 덮고 네 경로를 연달아 트리거해 `completed` 가 1만 증가하는지.
- `onStorage` 동기화: 블로그 `/` 카드 iframe(300×480 삽입)과 앱 탭을 함께 열고 한쪽에서 시작/일시정지/건너뛰기 → 다른 쪽이 따라가는지, 인터벌이 새거나 멎지 않는지.
- 대비 실측(`getComputedStyle` → WCAG 상대 휘도 직접 계산): spec 12절 「테마·대비」 5조합 × 양쪽 테마.
- 탭 숨김·reduced-motion 은 시뮬레이션 + 코드 확인으로, 그렇게 표시.
- `Storage.prototype.setItem` spy 로 running 10초 동안 저장 0회.

## 코드 리뷰 관점

- `timer.js`: `grep -n "document\|localStorage\|Date.now" apps/pomodoro/timer.js` 결과가 `window.Pomodoro =` 외에 없음. 입력 객체를 변형하지 않는지(새 객체 반환).
- `app.js`: `localStorage` 접근이 `readJSON`/`writeJSON` 두 곳에만 있고 try/catch 인지. `AudioContext` 생성이 제스처 핸들러 안에서만 일어나는지. 이벤트 리스너 중복 등록 없음(새로고침 없이 10세션 반복 후 리스너 수). 단발 `setTimeout` 이 일시정지·리셋·건너뛰기·완료 때 전부 `clearTimeout` 되는지.
- `theme.js`: head 동기 실행에서 DOM 을 만지지 않는지. `storage` 이벤트에서 `key === 'theme'` 만 반응.
- 접근성: `.digits`·SVG `aria-hidden`, `role="timer"` 라벨, `role="status"` 라이브 영역, 버튼 라벨, `:focus-visible`.
- 하드코딩 색상값: `grep -n "#[0-9a-fA-F]\{3,6\}" apps/pomodoro/style.css` 가 변수 블록 밖에서 걸리면 문제.
- 절대 경로·외부 요청 없음.

## 문제를 찾았을 때

- `apps/pomodoro/` 안의 파일만 고친다. `spec.md` 와 `agent/` 는 고치지 않는다. 밖의 파일은 절대.
- 고치면 재실측하고 review.md 에 "발견 → 원인(파일:줄) → 수정 → 재확인" 을 남긴다.
- 명세 자체가 잘못됐다고 판단되면 고치지 말고 「명세에 대한 의견」 에 적는다.
- 취향 차이는 고치지 않는다. 동작·접근성·안전·명세 위반만.
- 테스트로 바꾼 `localStorage`(`pomodoro:*`, `theme`) 는 끝나면 원래대로.

## review.md 형식

스도쿠 `review.md` 와 같은 구성:

```
# 포모도로 타이머 Review
날짜, 검증 환경
## 요약 — 통과 n / 전체, 수정 m건, 시뮬레이션·코드 확인 k건
## 체크리스트 결과 — spec 12절 항목 그대로 + ✅/❌/⚠️ + 실측값 한 줄
## Build 의 명세 이탈 판정 — 6건 각각 타당/수정
## 발견한 문제와 수정
## 명세에 대한 의견
## 남은 위험 — Embed 단계와 다음 스터디용
```

## 최종 보고

review.md 경로, 요약 줄, 수정한 파일 목록(무엇을 왜, 한 줄씩).
