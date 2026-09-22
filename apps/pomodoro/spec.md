# 포모도로 타이머 — 구현 명세 (spec.md)

Plan 단계 산출물. Build 서브에이전트는 이 문서대로 만들고, Review 서브에이전트는 12절 체크리스트로 확인한다.
루트 `CLAUDE.md` 의 규칙(의존성 없음, 빌드 없음, 상대 경로, 다크 모드, 모바일 우선)과 첫 앱 `apps/sudoku/` 의 방식(`theme.js` 동기 로드, `data-embed` 임베드 모드, `앱이름:` 저장 키 접두사, classic script + 전역 네임스페이스)을 그대로 따른다. 파일은 복사하지 않고 `apps/pomodoro/` 안에 자체 완결로 둔다.

---

## 1. 한 줄 소개

- **제목**: `포모도로 타이머`
- **설명**(블로그 카드용, 40자 안팎): `25분 집중, 5분 휴식. 줄어드는 원을 보며 한 번에 하나만.`
- 경로: `apps/pomodoro/index.html` → 배포 주소 `https://asdfdsign.github.io/asdf-blog/apps/pomodoro/`
- 사용자 요구: "원형 그래픽의 직관적 디자인". 화면 한가운데 큰 원 하나, 남은 시간이 호(arc)로 줄어들고 숫자는 원 안에. 집중/휴식이 색과 문구로 즉시 구분된다. 버튼은 시작·건너뛰기·리셋 셋. 설정은 접어 둔다. 설명 없이 10초 안에 쓸 수 있어야 한다.

---

## 2. 타이머 모델

### 세션과 기본값

| 세션 `session` | 기본 길이 | 표시 문구 | 색 |
| --- | --- | --- | --- |
| `focus` | 25분 | `집중` | `--accent` (블로그 포인트 컬러) |
| `short` | 5분 | `짧은 휴식` | `--rest` (차분한 파랑, 4절) |
| `long` | 15분 | `긴 휴식` | `--rest` |

- 긴 휴식 간격 `interval` 기본 **4**. 집중을 4회 마치면 긴 휴식, 아니면 짧은 휴식. 휴식 뒤에는 항상 집중.
- 세션 순서는 `cyclePos`(이번 사이클에서 마친 집중 수, `0..interval`)로 정한다. 집중 완료 → `cyclePos + 1`, `cyclePos ≥ interval` 이면 `long` 아니면 `short`. 긴 휴식 완료 → `cyclePos = 0`, `focus`.

### 상태 기계

```
idle ──시작──▶ running ──일시정지──▶ paused ──계속──▶ running
  ▲                │                                    │
  │              끝남(endAt ≤ now)                      │
  └── 다음 세션(idle, 원 가득) ◀──────────────────────┘
        ▲
  건너뛰기·리셋(어느 상태에서든)
```

| 상태 `status` | 원 | 주 버튼 라벨 |
| --- | --- | --- |
| `idle` | 가득(100%), 세션 색 | `집중 시작` / `휴식 시작` |
| `running` | 줄어드는 중 | `일시정지` |
| `paused` | 멈춘 자리 | `계속` |

### 세션 전환은 **수동**

세션이 끝나면 다음 세션으로 **넘어가되 `idle` 로 멈춘다**(원은 새 색으로 가득 차고 숫자는 새 길이). 사용자가 `시작` 을 눌러야 시간이 간다. 자동 시작을 하지 않는 이유:

1. 자리를 비운 사이 다음 집중이 저절로 시작돼 흘러가면 그 25분은 기록만 남고 의미가 없다. 포모도로는 "시작을 결심하는" 기법이다.
2. 블로그 카드 iframe 안에서 사용자가 보지 않는데 소리가 반복 울리는 일을 막는다.
3. `건너뛰기` 가 있으므로 "휴식 안 할래" 는 한 번 누르면 된다.

자동 시작 옵션은 1차에 넣지 않는다(13절).

### 건너뛰기 · 리셋 · 완료 수

- **건너뛰기**: 현재 세션을 버리고 다음 세션 `idle` 로. 집중을 건너뛰면 **완료로 세지 않고** `cyclePos` 도 올리지 않는다(솔직한 기록). 긴 휴식을 건너뛰면 `cyclePos = 0`.
- **리셋**: 현재 세션을 처음(`idle`, 가득)으로. 세션 종류·완료 수는 건드리지 않는다. 확인 대화상자 없음(iframe 안 `confirm()` 은 흉하고, 잃는 것은 진행 중인 한 세션뿐).
- **완료 수** `completed`: 오늘 자연 완료한 집중 수. 원 아래에 **점으로 표시**한다 — 점 `interval` 개(기본 `●●○○`), 채운 개수 = `cyclePos`. 긴 휴식 중엔 전부 채워져 있고 긴 휴식이 끝나면 비워진다. 점 옆에 `오늘 3회` 를 `--text-muted` 작은 글씨로. 날짜가 바뀌면 `completed = 0`, `cyclePos = 0`(7절).

---

## 3. 정확도 — 종료 시각 기준

`setInterval` 로 초를 빼면 탭이 뒤로 가거나 절전에 들어갈 때 어긋난다. **남은 시간은 항상 타임스탬프로 계산**하고, 타이머 API 는 화면을 다시 그리는 데만 쓴다.

| 상태 | 저장하는 값 | 남은 ms |
| --- | --- | --- |
| `idle` | `durationMs` | `durationMs` |
| `running` | `endAt` (epoch ms) | `max(0, endAt − now)` |
| `paused` | `remainingMs` | `remainingMs` |

- 시작·계속: `endAt = now + (idle ? durationMs : remainingMs)`. 일시정지: `remainingMs = max(0, endAt − now)`.
- **화면 갱신**: `running` 동안만 `setInterval(tick, 250)`. `tick` 은 `Date.now()` 로 남은 ms 를 다시 계산해 숫자·호·탭 제목을 갱신한다. 250ms 로 잡는 이유: 초 표시가 최대 250ms 늦게 바뀌는 건 눈에 띄지 않고, 호는 CSS `transition: stroke-dashoffset 250ms linear` 와 맞물려 끊김 없이 흐른다. `requestAnimationFrame` 은 쓰지 않는다 — 60fps 로 다시 그릴 이유가 없고 배터리만 쓴다. `idle`·`paused` 에선 인터벌을 끈다.
- **종료 시각 알람**: 시작·계속 때 `setTimeout(onDeadline, remainingMs + 20)` 을 하나 더 걸어 둔다. 숨겨진 탭에서 `setInterval` 은 1초 이상으로 늦춰지고 5분이 지나면 1분에 한 번으로 조여지지만(Chrome intensive throttling 은 **연쇄** 타이머에 적용), 사용자 제스처에서 한 번 건 단발 `setTimeout` 은 그보다 정확히 온다. 일시정지·리셋·건너뛰기·완료 때 해제.
- **완료 판정**은 `tick` 과 `onDeadline` 둘 다에서 `Pomodoro.isDone(state, now)` 로 하고, `complete()` 는 `status === 'running'` 일 때만 동작해 두 번 불려도 한 번만 처리된다.
- **탭이 숨겨진 사이 끝났으면**: `visibilitychange`(visible) · `pageshow` · `focus` 때 즉시 `tick` 을 불러 완료 처리한다. 새로고침으로 돌아왔을 때도 같다 — 로드 시 `endAt ≤ now` 면 즉시 완료 처리(단 소리는 제스처가 없어 재생하지 않는다, 5절).
- 숫자는 `Math.ceil(ms / 1000)` 초로 표시한다. 시작 직후 `25:00` 이 보이고 `00:00` 은 정확히 끝났을 때만 보인다.

---

## 4. 원형 그래픽

### 선택: SVG `<circle>` 두 개 + `stroke-dasharray/offset`

| | SVG stroke | `conic-gradient` |
| --- | --- | --- |
| 끝 모양 둥글게 | `stroke-linecap: round` 한 줄 | 불가 |
| 가장자리 | 안티에일리어싱 됨 | 각도 경계가 계단진다 |
| 부드러운 변화 | `stroke-dashoffset` 은 transition 가능 | 각도 값을 애니메이션하려면 `@property` 등록 필요 |
| 다크 모드 | `stroke: var(--accent)` 그대로 | 가능 |
| 렌더 비용 | 원 두 개, 매우 낮음 | 낮음 |

→ **SVG**. 250ms 마다 `stroke-dashoffset` 하나만 바꾼다.

```html
<svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
  <circle class="ring__track"    cx="50" cy="50" r="45"/>
  <circle class="ring__progress" cx="50" cy="50" r="45" pathLength="100"/>
</svg>
```

- `pathLength="100"` 을 주면 둘레가 100 으로 정규화되어 **`stroke-dasharray: 100`, `stroke-dashoffset: −(100 − 남은 %)`** 로 끝난다. Review 가 실측하기 쉽다 (`-dashoffset === 100 − remaining%`, 오차 ±0.5).
- **진행 방향**: 진행 원에 `transform: rotate(-90deg)`(`transform-origin: 50% 50%`) 을 줘 12시에서 시작한다. 음수 offset 을 쓰면 대시가 `[경과 %, 100]` 구간을 덮으므로 **12시부터 시계 방향으로 비어 간다** — 시계 바늘이 12시에서 출발해 한 바퀴 돌며 지나간 자리가 비는 모양. 남은 호는 바늘 앞에서 12시까지.
- **선 굵기** `stroke-width: 6`(viewBox 기준 = 지름의 6%, 320px 원에서 약 19px). 트랙은 같은 굵기 `stroke: var(--border)`. 진행 원 `stroke-linecap: round`.
- **남은 시간 0** 에서는 진행 원에 `is-empty` 클래스 → `opacity: 0`. 길이 0 대시에 둥근 캡이 점으로 남는 현상을 피한다.
- **세션 색 전환**: 진행 원 `transition: stroke-dashoffset 250ms linear, stroke 400ms var(--ease)`. 완료·건너뛰기로 세션이 바뀌면 호가 가득 채워지며(offset 0) 색이 400ms 동안 넘어간다. 세션 라벨·숫자 색도 같은 400ms.
- **마지막 10초 강조**: **한다.** 남은 초 ≤ 10 이면 `.timer` 에 `is-ending` → 숫자 색이 `--text` 에서 세션 색으로 바뀌고, 진행 원에 1초 주기 `opacity 1 → 0.55 → 1` 펄스. 흘끗 봐도 "곧 끝난다" 가 보이게. `prefers-reduced-motion` 이면 펄스 없이 색만.

### 색 변수

블로그 팔레트엔 "휴식" 색이 없으므로 이 앱만의 변수 두 개를 `:root` / `[data-theme="dark"]` 블록에 **추가**한다(나머지 변수는 스도쿠 `style.css` 와 동일).

| 변수 | 라이트 | 다크 | 용도 |
| --- | --- | --- | --- |
| `--rest` | `#2b6f9e` | `#6fb3e0` | 휴식 세션 호·라벨·숫자(마지막 10초) |
| `--rest-soft` | `#e6f0f7` | `#1a2a36` | 휴식 세션 라벨 배경 |

`--rest` on `--bg` 예상 대비: 라이트 약 5.2:1, 다크 약 8.2:1. Review 가 실측한다. 컴포넌트 CSS 는 `--session` 변수 하나만 참조하고 `.timer[data-session="focus"] { --session: var(--accent); --session-soft: var(--accent-soft); }`, `[data-session="short"], [data-session="long"] { --session: var(--rest); … }` 로 바꾼다.

### 크기

- `.ring-wrap` 은 정사각형(`aspect-ratio: 1`), 한 변 = **`min(100%, 360px, 100dvh − 260px)`**. 폰 세로 375×667 → 343px(폭 기준). 데스크톱 → 360px.
- 임베드(`[data-embed]`): **`min(100%, 320px, 100dvh − 200px)`**. iframe 300×480 → 폭 284px(여백 8px×2). 480 − 200 = 280 이 걸려 **280px**. 라벨 줄 44 + 원 280 + 버튼 56 + 점 20 + 간격·여백 ≈ 460 < 480 → 스크롤 없이 원·시간·버튼·점이 보인다.
- 숫자는 SVG 밖 HTML(`<div class="digits">`)을 원 중앙에 절대 배치. `font-variant-numeric: tabular-nums`, `font-weight: 600`, `font-size: clamp(2rem, 22cqi, 4.5rem)`(`.ring-wrap` 에 `container-type: inline-size`) — 320px 원에서 약 70px. 90분 설정이면 `90:00` 처럼 분이 60을 넘어도 `mm:ss` 를 유지한다(시간 단위 없음).

---

## 5. 알림

| 수단 | 1차 | 결정 |
| --- | --- | --- |
| 소리 (Web Audio 합성) | **넣는다** | 파일 없음, 토글 있음 |
| 탭 제목 남은 시간 | **넣는다** | 임베드 모드에선 생략 |
| Notification API | **뺀다** | 권한 팝업이 첫인상을 망친다. iframe 안에선 더 그렇다 |
| 진동 (`navigator.vibrate`) | 뺀다 | 13절 |

### 소리

- `AudioContext` 는 **첫 사용자 제스처(시작 버튼 클릭 또는 Space) 때 만든다**(`ensureAudio()`). 이미 있고 `state === 'suspended'` 면 `resume()`. 제스처 없이 만들면 자동 재생 정책에 걸려 조용히 실패한다.
- 합성: `OscillatorNode`(sine) + `GainNode`, 게인 0.15 에서 지수 감쇠. 집중 끝 = 두 음 상승(880Hz 120ms → 1175Hz 180ms), 휴식 끝 = 한 음(660Hz 200ms). 전체 0.5초 안. 세션마다 소리가 달라 화면을 안 봐도 무엇이 끝났는지 안다.
- 재생 시점: `complete()` 안에서 `settings.sound && audioCtx` 일 때. 숨겨진 탭에서도 이미 만들어진 컨텍스트는 재생된다(3절의 단발 `setTimeout` 이 그 순간을 잡는다). 새로고침 뒤 로드 시 완료 처리에서는 컨텍스트가 없어 **재생하지 않는다** — 화면(가득 찬 새 색 원, 바뀐 라벨)만으로 알린다.
- **토글**: 세션 라벨 줄 오른쪽 아이콘 버튼(스피커 / 빗금 스피커 인라인 SVG, 44×44, `aria-pressed`, `aria-label="소리 켬"/"소리 끔"`). 기본 **켬**. 값은 `pomodoro:settings.sound`. 끄면 `complete()` 가 소리를 건너뛴다. 켤 때 확인용으로 짧은 한 음(660Hz 80ms)을 낸다 — 제스처 직후라 재생되고, 소리가 나는지 바로 안다. 임베드 모드에서도 보인다(카드에서 음소거할 방법이 있어야 한다).

### 탭 제목

- `running`: `(24:59) 집중 — 포모도로`, `paused`: `(일시정지 24:59) 집중 — 포모도로`, `idle`: `포모도로 타이머`. 세션 끝 직후 한 번 `(끝) 집중 끝 — 포모도로` 로 바꾸고 사용자가 다음 세션을 시작하면 갱신.
- 초 표시가 바뀔 때만 `document.title` 을 쓴다(250ms 마다 쓰지 않는다).
- **임베드 모드에선 건드리지 않는다** — iframe 문서 제목은 탭에 안 뜬다.

---

## 6. 설정

- 위치: 완료 점 아래 **`<details class="settings">`**, `<summary>설정</summary>`. 기본 접힘. 임베드 모드에선 숨김(`display: none`).
- 별도 화면을 만들지 않는 이유: 항목이 5개뿐이고, 접이식이면 코드 경로가 하나다.

| 항목 | 컨트롤 | 범위 | 기본 |
| --- | --- | --- | --- |
| 집중 (분) | `<input type="number" inputmode="numeric" min="1" max="90" step="1">` | 1~90 | 25 |
| 짧은 휴식 (분) | 같음 | 1~90 | 5 |
| 긴 휴식 (분) | 같음 | 1~90 | 15 |
| 긴 휴식 간격 (회) | 같음 | 1~8 | 4 |
| 기본값으로 | 텍스트 버튼 | | |
| 오늘 기록 지우기 | 텍스트 버튼 (`completed = 0`, `cyclePos = 0`) | | |

- `change` 때 `Pomodoro.normalizeSettings` 로 정수·범위로 자르고(`3.7 → 3`, `120 → 90`, 빈 값·NaN → 이전 값) 입력칸에 되써 넣은 뒤 `pomodoro:settings` 저장.
- **타이머 진행 중에 바꾸면**: 현재 세션이 `running`·`paused` 면 **다음 세션부터** 적용된다(`durationMs` 와 `endAt` 을 건드리지 않는다 — 진행 중인 호의 비율이 튀지 않는다). 현재 세션이 `idle` 이면 즉시 적용(원은 가득인 채 숫자만 바뀜). 간격 변경은 점 개수에 즉시 반영되고, `cyclePos ≥ 새 interval` 이면 다음 휴식이 긴 휴식.
- 설정 패널 안의 입력에 포커스가 있으면 단축키(8절)는 무시된다.

---

## 7. 상태 저장

`localStorage`, 접두사 **`pomodoro:`**. 블로그의 `theme`, 스도쿠의 `sudoku:*` 와 충돌하지 않는다.

| 키 | 내용 | 갱신 시점 |
| --- | --- | --- |
| `pomodoro:settings` | `{ "v": 1, "focus": 25, "short": 5, "long": 15, "interval": 4, "sound": true }` | 설정·소리 토글 바꿀 때 |
| `pomodoro:state` | 아래 | 시작·일시정지·계속·건너뛰기·리셋·완료·오늘 기록 지우기·날짜 넘김 직후, `pagehide`. **틱마다 저장하지 않는다** |

```json
{
  "v": 1,
  "session": "focus",          // "focus" | "short" | "long"
  "status": "running",         // "idle" | "running" | "paused"
  "durationMs": 1500000,       // 이 세션의 전체 길이 (설정이 바뀌어도 진행 중 세션은 유지)
  "endAt": 1758540000000,      // running 일 때만, 아니면 null
  "remainingMs": null,         // paused 일 때만, 아니면 null
  "completed": 3,              // 오늘 자연 완료한 집중 수
  "cyclePos": 3,               // 이번 사이클에서 마친 집중 수 (0..interval)
  "date": "2026-09-22"         // 로컬 날짜 YYYY-MM-DD
}
```

- **로드 순서**: `pomodoro:settings` → `normalizeSettings`(없거나 깨지면 기본값). `pomodoro:state` 가 있고 `Pomodoro.isValidState` 를 통과하면 이어한다. `running` 이면 인터벌·알람을 다시 걸고, `endAt ≤ now` 면 즉시 완료 처리(소리 없음). 아니면 `createState(settings, now)` 로 새 상태(`focus`, `idle`).
- **날짜 넘김**: 로드·시작·완료·visible 복귀 때 `rollDate(state, now)`. `state.date !== dateKey(now)` 면 `completed = 0`, `cyclePos = 0`, `date` 갱신. 진행 중인 타이머는 건드리지 않는다(자정에 걸친 세션은 그대로 이어진다).
- 파싱 실패·스키마 불일치는 조용히 버리고 새 상태. 콘솔 에러를 내지 않는다.
- `localStorage` 접근은 `readJSON`/`writeJSON` 두 함수에만, 둘 다 `try/catch`. 실패해도 타이머는 돈다.
- 카드 iframe 과 새 탭은 같은 출처라 같은 상태를 공유한다(스도쿠와 같은 성질). 두 문서가 동시에 `running` 이면 둘 다 같은 `endAt` 을 보고 각자 완료 처리·소리를 낸다 — 다른 탭에서 상태를 바꾸면 따라가도록 `storage` 이벤트(`e.key === 'pomodoro:state'`)에서 상태를 다시 읽어 렌더한다. 완료 소리의 중복(두 탭이 동시에 열려 있을 때)은 감수한다.

---

## 8. UI 흐름과 레이아웃

### 화면 구성 (모바일, 위에서 아래)

```
┌──────────────────────────────┐
│ ← 블로그  포모도로 타이머   ☾ │  header  (임베드 모드에선 숨김)
├──────────────────────────────┤
│ [● 집중]                  🔊 │  session-bar: 세션 라벨(pill) · 소리 토글
│                              │
│         ╭────────╮           │
│        ╱  24:59   ╲          │  ring-wrap: SVG 원 + 숫자
│        ╲          ╱          │
│         ╰────────╯           │
│                              │
│   [↺]  [  ▶ 집중 시작  ] [⏭] │  actions: 리셋 · 시작/일시정지 · 건너뛰기
│         ●●●○ · 오늘 3회       │  dots
├──────────────────────────────┤
│ ▸ 설정                        │  settings <details> (임베드 모드에선 숨김)
└──────────────────────────────┘
```

- **header**: 스도쿠와 같다. `← 블로그`(`../../`), 제목, 테마 토글(해/달 인라인 SVG, `aria-pressed`).
- **session-bar**: 왼쪽 라벨은 pill(`background: var(--session-soft); color: var(--session)`)에 아이콘 + 문구. 아이콘은 인라인 SVG 두 개 — 집중 = 동심원 타깃, 휴식 = 컵. 색을 못 봐도 문구·아이콘으로 구분된다. 오른쪽 소리 토글(5절).
- **ring-wrap**: 4절. 원 전체를 탭하면 시작/일시정지가 되게 하지 **않는다** — 실수 탭이 많고 버튼이 바로 아래 있다.
- **actions** 한 줄: `[리셋 ↺ 44×44]` `[주 버튼 flex:1, 높이 56, 최소 폭 140]` `[건너뛰기 ⏭ 44×44]`. 주 버튼은 `--session` 배경 + `--accent-contrast` 글자, 아이콘(▶ / ‖) + 라벨(2절 표). 리셋·건너뛰기는 아이콘 버튼(`aria-label`, `title`), 테두리 `--border`. 폭 284px(iframe 300 − 여백)에서 44 + 8 + 140 + 8 + 44 = 244 로 여유.
- **dots**: `<div class="dots" role="img" aria-label="오늘 3회 완료, 다음 긴 휴식까지 1회">` 안에 점 `interval` 개(`●` 채움 = `--session`, `○` 빈 = `--border`, 각 10px, 간격 8px) + `오늘 3회`.
- **settings**: 6절.

### 레이아웃 차이

| 폭 | 배치 |
| --- | --- |
| < 640px | 위 그림 한 열. 좌우 여백 16px |
| ≥ 640px | 같은 한 열, 전체 `max-width: 420px` 가운데 정렬. 원 360px. 2열은 하지 않는다 |

### 임베드 모드 (iframe)

- `theme.js` 가 `window.self !== window.top` 이면 `<html data-embed>` 를 붙인다(스도쿠와 동일 코드).
- `[data-embed]`: header 숨김, settings 숨김, `--gutter: 8px`, 원 크기 `min(100%, 320px, 100dvh − 200px)`, 탭 제목 갱신 안 함. 순서는 바꾸지 않는다(이미 원이 위).
- 블로그 카드 권장 iframe: `<iframe class="app-card__frame" src="./apps/pomodoro/" title="포모도로 타이머 미리보기" loading="lazy" height="480">` — 스도쿠 카드와 같은 형식.

### 입력

| 동작 | 터치/마우스 | 키보드 |
| --- | --- | --- |
| 시작 / 일시정지 / 계속 | 주 버튼 | `Space` |
| 건너뛰기 | ⏭ 버튼 | `S` (대소문자 무관) |
| 리셋 | ↺ 버튼 | `R` |
| 소리 토글 | 🔊 버튼 | 없음 (Tab 으로 찾는다) |
| 설정 | `<details>` 펼침 | Tab → Enter |

- 단축키는 `document` 의 `keydown` 에서 처리. **무시 조건**: `e.target.closest('input, textarea, select, [contenteditable]')` 이면 전부 무시. `Space` 는 추가로 `e.target` 이 `button`·`summary`·`a` 면 무시(그 요소의 기본 동작이 이미 클릭이라 두 번 토글되는 걸 막는다). `Space` 처리 시 `preventDefault()` 로 페이지 스크롤을 막는다. `Ctrl`/`Alt`/`Meta` 조합은 무시.
- 시작을 `Space` 로 눌러도 사용자 제스처이므로 `ensureAudio()` 가 된다.
- 모든 버튼 `min-width/min-height: 44px`, `touch-action: manipulation`.

---

## 9. 접근성

- 숫자(`.digits`)는 **`aria-hidden="true"`** — 250ms 마다 바뀌는 텍스트를 스크린리더가 읽으면 안 된다. SVG 도 `aria-hidden`.
- 대신 시각적으로 숨긴 `<p class="sr-only" role="status" aria-live="polite" aria-atomic="true">` 를 하나 두고 **다음 순간에만** 문구를 바꾼다:
  - 시작/계속: `집중 25분 시작` / `계속, 남은 시간 12분 30초`
  - 일시정지: `일시정지, 남은 시간 12분 30초`
  - 분이 바뀔 때(정각): `남은 시간 12분`
  - 10초: `10초 남음`
  - 완료: `집중 끝. 짧은 휴식 5분. 시작을 누르세요`
  - 건너뛰기·리셋: `건너뜀. 집중 25분` / `처음으로. 집중 25분`
  - 같은 문구를 연속으로 쓰지 않는다(정각 안내는 분 값이 바뀔 때만).
- 원 영역 `<div class="ring-wrap" role="timer" aria-label="집중, 남은 시간 12분">` — `aria-label` 은 분이 바뀔 때만 갱신(`role="timer"` 는 기본 live=off 라 조용하고, 포커스·탐색 때 읽힌다).
- 색 외 단서: 세션 라벨 문구 + 아이콘, 주 버튼 라벨이 상태에 따라 바뀜(`집중 시작` / `일시정지` / `계속`), 점은 `role="img"` 라벨.
- 버튼 라벨: 리셋 `aria-label="처음으로"`, 건너뛰기 `aria-label="다음 세션으로 건너뛰기"`, 소리 `aria-label="소리 켬"`/`"소리 끔"` + `aria-pressed`, 테마 토글은 스도쿠와 동일.
- 설정 입력은 `<label for>` 로 연결. 범위는 `min/max` + 안내 문구 `1~90분`.
- 포커스 링 `:focus-visible` 2px `--session` outline.
- `prefers-reduced-motion: reduce`: 진행 원 `transition: none`(초마다 계단식으로 줄어듦 — 틱은 그대로 250ms 지만 눈에 띄는 움직임은 초 단위), 색 전환 없음, 마지막 10초 펄스 없음, 버튼 hover transform 없음.
- 대비: 새 조합은 `--rest` on `--bg`, `--rest` on `--rest-soft`(휴식 pill), `--accent-contrast` on `--rest`(휴식 주 버튼 글자) 셋. Review 가 양쪽 테마에서 실측한다. `--accent-contrast`(`#fff`) on `--rest`(`#2b6f9e`) 라이트 예상 5.2:1, 다크 `#141214` on `#6fb3e0` 예상 8.2:1.

---

## 10. 파일 구조

```
apps/pomodoro/
  spec.md      # 이 문서
  agent/       # 서브에이전트 지침 (건드리지 않음)
  index.html   # 유일한 HTML. head 에 theme.js 동기 로드, body 끝에 timer.js → app.js 순서로 classic script
  style.css    # 전체 스타일. :root / [data-theme="dark"] 변수는 블로그 팔레트 + --rest/--rest-soft, [data-embed] 변형 포함
  theme.js     # 스도쿠 theme.js 와 같은 내용(블로그 theme.js + storage 동기화 + data-embed 판정). ../../js 를 참조하지 않는다
  timer.js     # 순수 타이머 로직. DOM·localStorage·Date.now 의존 없음(now 는 인자). window.Pomodoro 로 노출
  app.js       # UI: 렌더, 입력, 인터벌·알람, SVG 갱신, Web Audio, 저장/복원, 탭 제목, 테마 토글 바인딩
  test.html    # timer.js 테스트 페이지. 가짜 시계로 전이·시간 계산 검증
```

- classic script + 전역 네임스페이스(스도쿠와 같은 이유 — Review 가 콘솔에서 `Pomodoro.nextSession(...)` 을 바로 칠 수 있다).
- 외부 라이브러리·폰트·아이콘 CDN 없음. 인라인 SVG: 해·달(테마), 타깃·컵(세션), 재생·일시정지, 리셋, 건너뛰기, 스피커 켬·끔 — 총 9개.
- 모든 경로 상대(`./style.css`, `./timer.js`, `../../`).

---

## 11. `timer.js` 공개 함수

전부 `window.Pomodoro` 아래. **순수 함수** — 상태 객체를 변형하지 않고 새 객체를 돌려준다. 시간이 필요한 함수는 전부 `now`(epoch ms)를 **마지막 인자로 받는다**. `Date.now()` 를 내부에서 부르지 않는다.

| 함수 | 입력 | 출력 | 비고 |
| --- | --- | --- | --- |
| `DEFAULTS` | — | `{focus: 25, short: 5, long: 15, interval: 4, sound: true}` | 상수 |
| `LIMITS` | — | `{minutes: [1, 90], interval: [1, 8]}` | 상수 |
| `SESSIONS` | — | `['focus', 'short', 'long']` | |
| `normalizeSettings(raw)` | 아무 값 | settings | 정수화·범위 자르기, 누락은 기본값. `null`·문자열도 받는다 |
| `durationMs(settings, session)` | | `number` | 분 × 60000 |
| `dateKey(now)` | | `'YYYY-MM-DD'` | **로컬** 날짜 |
| `createState(settings, now)` | | state | `focus`/`idle`, `completed 0`, `cyclePos 0`, `date = dateKey(now)` |
| `isValidState(obj, settings)` | | `boolean` | `v === 1`, 세션·상태 열거값, 숫자 필드 유한·음수 아님, `running` 이면 `endAt` 숫자, `paused` 면 `remainingMs ≤ durationMs`, `cyclePos ≤ interval`. 저장 복원용 |
| `remaining(state, now)` | | ms | 3절 표. 항상 `0 ≤ r ≤ durationMs` |
| `fraction(state, now)` | | `0..1` | `remaining / durationMs` |
| `isDone(state, now)` | | `boolean` | `status === 'running' && endAt <= now` |
| `start(state, now)` | | state | `idle`·`paused` → `running`, `endAt` 계산. `running` 이면 그대로 |
| `pause(state, now)` | | state | `running` → `paused`, `remainingMs` 저장. 아니면 그대로 |
| `toggle(state, now)` | | state | `running` 이면 `pause`, 아니면 `start` |
| `nextSession(state, settings)` | | `'focus' \| 'short' \| 'long'` | 2절 규칙. `focus` → `cyclePos + 1 >= interval ? 'long' : 'short'`, 휴식 → `'focus'` |
| `complete(state, settings, now)` | | state | 자연 완료. `focus` 면 `completed + 1`, `cyclePos + 1`; `long` 이면 `cyclePos = 0`. 다음 세션 `idle`, `durationMs` 는 settings 에서. `status !== 'running'` 이면 그대로 |
| `skip(state, settings, now)` | | state | `complete` 와 같되 `completed`·`cyclePos` 는 올리지 않는다. `long` 건너뛰기는 `cyclePos = 0`. 어느 상태에서든 동작 |
| `reset(state, settings, now)` | | state | 현재 세션 `idle`, `durationMs` 는 settings 에서 |
| `applySettings(state, settings)` | | state | `idle` 이면 `durationMs` 갱신, 아니면 그대로 |
| `rollDate(state, now)` | | state | 날짜 다르면 `completed 0`, `cyclePos 0`, `date` 갱신 |
| `clearToday(state)` | | state | `completed 0`, `cyclePos 0` |
| `format(ms)` | | `'mm:ss'` | `Math.ceil(ms / 1000)`, 분은 두 자리 이상(`90:00` 허용), 음수는 `00:00` |
| `titleText(state, now)` | | `string` | 5절 규칙 |
| `sessionLabel(session)` | | `'집중' \| '짧은 휴식' \| '긴 휴식'` | |

### `test.html`

**둔다.** 스도쿠 `test.html` 과 같은 형식(요약 + 케이스 표: 이름 · 기대 · 실제 · 통과). 시계는 전부 가짜(`const T0 = 1_700_000_000_000` 같은 상수에서 더해 간다). 케이스:

1. `normalizeSettings`: `{}` → 기본값; `{focus: '3.7'}` → 3; `{focus: 120}` → 90; `{focus: 0}` → 1; `{interval: 9}` → 8; `null` → 기본값; `sound: 'no'` → `true` 유지(불리언만 받음)
2. `createState` → `focus`/`idle`/`durationMs 1500000`/`completed 0`/`date === dateKey(T0)`
3. `start(idle, T0)` → `endAt === T0 + 1500000`; `remaining(_, T0 + 60000) === 1440000`; `fraction === 0.96`
4. `pause(running, T0 + 60000)` → `remainingMs 1440000`, `endAt null`; 30초 뒤 `remaining` 이 그대로 1440000; `start(paused, T0 + 90000)` → `endAt === T0 + 90000 + 1440000`
5. `isDone`: `endAt − 1` false, `endAt` true, `endAt + 5000` true; `remaining(running, endAt + 5000) === 0`
6. 전이 시나리오 (interval 4): 집중 완료 ×3 → 매번 `short`, `cyclePos 1·2·3`; 4번째 완료 → `long`, `cyclePos 4`, `completed 4`; `long` 완료 → `focus`, `cyclePos 0`, `completed 4`
7. interval 2 로 같은 시나리오 → 2번째 완료가 `long`
8. `skip(focus running)` → `short`, `completed`·`cyclePos` 불변; `skip(long)` → `focus`, `cyclePos 0`; `skip(idle)` 도 동작
9. `complete(idle)` → 그대로(참조 동일 또는 deepEqual); `complete(paused)` → 그대로
10. `reset(running)` → `idle`, `endAt null`, `durationMs` 가 settings 값
11. `applySettings`: `idle` 에서 `focus 30` → `durationMs 1800000`; `running` 에선 불변
12. `rollDate`: 같은 날 불변; `T0 + 86400000 × 2` → `completed 0`, `cyclePos 0`, 세션·상태·`endAt` 불변
13. `format`: `1500000 → '25:00'`, `1499001 → '25:00'`, `1499000 → '24:59'`, `999 → '00:01'`, `0 → '00:00'`, `-5 → '00:00'`, `5400000 → '90:00'`
14. `isValidState`: 정상 `true`; `v 2`, `session 'nap'`, `running` 인데 `endAt null`, `remainingMs > durationMs`, `cyclePos 9` 각각 `false`
15. 불변성: 각 전이 함수 호출 뒤 입력 객체가 `JSON.stringify` 기준 동일
16. `titleText`: running → `(24:59) 집중 — 포모도로`, paused → `(일시정지 24:59) 집중 — 포모도로`, idle → `포모도로 타이머`

---

## 12. 검증 체크리스트 (Review 용)

로컬은 `python -m http.server 8000` 으로 띄우고 `http://localhost:8000/apps/pomodoro/` 에서 본다. 코드만 읽고 넘어가지 않는다. **Browser pane 에서 재현할 수 없는 항목(탭 숨김, reduced-motion)은 시뮬레이션 + 코드 확인으로 대체하고 그렇게 표시한다.** 스크린샷은 한 프레임 늦게 잡힐 수 있으니 판정은 DOM·`getComputedStyle` 값으로 한다.

**로직**
- [ ] `test.html` 전부 통과(경고 0)
- [ ] 콘솔에서 `Pomodoro.nextSession({session:'focus', cyclePos:3}, {interval:4})` → `'long'`, `cyclePos:2` → `'short'`

**정확도**
- [ ] 설정에서 집중 1분 → 시작. 시작 클릭 순간 `t0 = Date.now()` 를 콘솔에 기록하고, 완료(세션 라벨이 휴식으로 바뀌는 순간, `MutationObserver` 로 잡기) 시각 `t1` 을 기록 → `|t1 − t0 − 60000| < 200`
- [ ] 진행 중 `Date.now` 를 30초 앞으로 덮어쓰기(`const real = Date.now; Date.now = () => real() + 30000`) → 다음 틱에서 숫자가 30초 줄어 있다(경과 초를 세는 게 아니라 종료 시각으로 계산함을 확인). 복구
- [ ] 탭 숨김 시뮬레이션: `document.hidden` getter 를 `true` 로 덮고 `visibilitychange` 발송 → 20초 대기 → `Date.now` 를 남은 시간보다 크게 앞으로 덮고 `hidden=false` + `visibilitychange` → 즉시 완료 처리(라벨·색·점 변화). **시뮬레이션·코드 확인**
- [ ] 일시정지 20초 뒤 계속 → 남은 시간이 일시정지 시점과 같다(±1초)

**원 그래픽**
- [ ] 진행 원 `stroke-dasharray` 가 `100`, `stroke-dashoffset` 실측: 시작 직후 `0`(±0.5), 절반 지났을 때 `−50`(±1), 끝나기 직전 `−99` 부근. `−offset ≈ 100 × (1 − remaining/duration)`
- [ ] 12시에서 시작해 **시계 방향으로 비어 간다**(스크린샷: 1/4 지났을 때 12시~3시 구간이 트랙 색)
- [ ] `stroke-linecap: round`, 트랙 색 `--border`, 진행 색이 집중 `--accent` / 휴식 `--rest` (`getComputedStyle().stroke` 실측)
- [ ] 세션 전환 시 진행 원 `stroke` 가 400ms transition 으로 바뀜(`getComputedStyle().transitionDuration` 포함 확인), 완료 순간 offset 0 으로 가득 찬다
- [ ] 남은 10초 이하에서 `.timer.is-ending`, 숫자 색이 세션 색, 진행 원 펄스 animation 존재. 0 에서 `is-empty` → `opacity 0`
- [ ] 숫자가 원 중앙(`.digits` 중심 좌표와 `.ring` 중심 좌표 차이 < 2px), `tabular-nums`

**세션 흐름**
- [ ] 집중 1분·짧은 1분·긴 1분·간격 2 로 설정 → 집중 완료 → 라벨 `짧은 휴식`, 주 버튼 `휴식 시작`, 점 `●○`, `오늘 1회`, `idle`(숫자 멈춤) → 시작 → 완료 → `집중`, 점 `●○` 유지 → 집중 완료 → `긴 휴식`, 점 `●●`, `오늘 2회` → 긴 휴식 완료 → `집중`, 점 `○○`, `오늘 2회`
- [ ] 집중 건너뛰기 → 휴식으로 가지만 점·오늘 횟수 불변. 긴 휴식 건너뛰기 → 점 비움
- [ ] 리셋 → 현재 세션 `idle`, 원 가득, 숫자 전체 길이, 점 불변, 확인 대화상자 없음
- [ ] 세션이 끝나도 다음 세션이 **자동 시작되지 않음**(5초 대기 후 숫자 불변)

**소리**
- [ ] 페이지 로드 직후 `window.AudioContext` 인스턴스 없음(제스처 전 생성 금지 — app.js 에서 `audioCtx` 를 콘솔에 노출하거나 코드 확인)
- [ ] 시작 클릭 뒤 완료 시 소리 재생(`audioCtx.state === 'running'`, 완료 순간 `OscillatorNode.start` 호출 — 코드 확인 + 콘솔에서 `ensureAudio` 뒤 재생 함수 직접 호출해 들리는지)
- [ ] 소리 토글 끔 → `aria-pressed="false"`, `pomodoro:settings.sound === false`, 완료 시 재생 함수가 불리지 않음(재생 함수를 spy 로 감싸 확인). 다시 켬 → 확인음 1회
- [ ] 새로고침으로 돌아왔을 때 이미 끝난 세션 → 완료 처리되지만 콘솔에 AudioContext 자동재생 경고 없음

**탭 제목**
- [ ] 새 탭(비임베드)에서 running: `document.title` 이 `(mm:ss) 집중 — 포모도로` 형식이고 1초에 한 번만 바뀜(`MutationObserver` on `<title>` 로 5초 동안 변경 횟수 ≤ 6). paused: `(일시정지 mm:ss) …`. idle: `포모도로 타이머`
- [ ] 임베드 모드에서는 title 불변

**설정·저장**
- [ ] 집중 30 입력 → `pomodoro:settings` 갱신, `idle` 이면 숫자 `30:00` 즉시. running 중 바꾸면 현재 세션 불변, 다음 집중부터 30분
- [ ] `120` → `90`, `0` → `1`, `3.7` → `3`, 빈 값 → 이전 값 복원, 간격 `9` → `8`
- [ ] 기본값으로 → 25/5/15/4. 오늘 기록 지우기 → 점 비움, `오늘 0회`
- [ ] running 중 새로고침 → 같은 세션, 남은 시간이 이어짐(새로고침 전후 `remaining` 차이 ≈ 걸린 시간), 인터벌 재가동(숫자가 줄어든다). paused 중 새로고침 → 같은 남은 시간에 멈춤
- [ ] `localStorage.setItem('pomodoro:state', '{broken')` 후 새로고침 → 에러 없이 새 상태. `session: 'nap'` 같은 변조 → 새 상태
- [ ] `pomodoro:state.date` 를 어제로 바꾸고 새로고침 → `completed 0`, 점 비움
- [ ] 틱 중 `localStorage.setItem` 이 불리지 않음(`Storage.prototype.setItem` 을 spy 로 감싸 10초 동안 0회)

**레이아웃**
- [ ] 375px 폭에서 가로 스크롤 없음(`scrollWidth <= innerWidth`)
- [ ] 375px 에서 모든 버튼 44×44 이상(`button, summary, a` 전체 실측), 주 버튼 높이 ≥ 56
- [ ] 폭 300px·높이 480px iframe(블로그 `/` 문서 body 에 JS 로 삽입) 안에서 `data-embed` 붙음, header·settings `display: none`, 원 지름 ≈ 280px, 세션 라벨·원·숫자·버튼 줄·점이 스크롤 없이 보임(`.dots` 의 `bottom ≤ innerHeight`). 360×480 도 확인
- [ ] ≥ 640px 에서 전체 폭 420px 가운데 정렬, 원 360px
- [ ] 폰 세로 375×667 (비임베드)에서 header 포함 설정 summary 까지 스크롤 없이 보임

**테마·대비**
- [ ] 블로그에서 다크로 토글 → 앱 새 탭이 다크로 뜨고 플래시 없음(5회). 앱 토글 → 블로그 탭 따라감. 열린 앱 탭이 `storage` 이벤트로 즉시 전환
- [ ] 라이트/다크 실측(WCAG 상대 휘도): `--rest` on `--bg`, `--rest` on `--rest-soft`(휴식 pill), `--accent-contrast` on `--rest`(휴식 주 버튼), `--accent-contrast` on `--accent`(집중 주 버튼), `--text-muted` on `--bg`(오늘 n회) 전부 ≥ 4.5:1
- [ ] `style.css` 의 `#` 색상값이 `:root` / `[data-theme="dark"]` 변수 블록에만 있음

**키보드·접근성**
- [ ] `Space` 시작 → 일시정지 → 계속. 주 버튼에 포커스가 있을 때 `Space` 한 번에 **한 번만** 토글(두 번 토글되지 않음). `S` 건너뛰기, `R` 리셋. 설정 숫자 입력에 포커스 있을 때 `Space`·`S`·`R` 무시
- [ ] `read_page` 접근성 트리: `.digits` 와 SVG 가 트리에 없음(aria-hidden), `timer "집중, 남은 시간 25분"`, `img "오늘 0회 완료, 다음 긴 휴식까지 4회"`, 버튼 `"처음으로"` `"다음 세션으로 건너뛰기"` `"소리 켬"`, 주 버튼 텍스트가 상태에 따라 바뀜
- [ ] 라이브 영역(`role="status"`) 문구가 시작·정각·10초·완료 때만 바뀜 — 1분 타이머를 돌리며 `MutationObserver` 로 변경 로그: 시작 1회 + 10초 1회 + 완료 1회 = 3회(정각 없음)
- [ ] `prefers-reduced-motion: reduce` 에서 진행 원·색 transition 과 펄스 animation 이 꺼짐 — **코드 확인**(`@media` 블록 존재와 대상 선택자)
- [ ] `:focus-visible` outline 이 세션 색 2px

**기타**
- [ ] 콘솔 에러·경고 없음(로드, 3세션 완주, 설정 변경, 새로고침 ×5, 깨진 JSON 복원, 테마 토글, 소리 토글)
- [ ] 네트워크 요청 전부 200, 외부 도메인 요청 0
- [ ] 모든 경로 상대(`grep -n 'href="/\|src="/' apps/pomodoro/*.html` 결과 없음)
- [ ] `timer.js` 에 `document`·`window.localStorage`·`Date.now` 참조 없음(`grep -n "document\|localStorage\|Date.now" timer.js` 결과 없음 — `window.Pomodoro =` 대입만 허용)

---

## 13. 안 하는 것 (1차 제외)

- **Notification API**(권한 팝업), `navigator.vibrate`, 배지·PiP
- **자동 시작 옵션**(2절 근거). 다음 판에 넣을 땐 settings 에 불리언 하나 + `complete()` 뒤 `start()` 호출로 끝난다
- 통계·그래프·주간 기록, 세션 이력 목록. 오늘 완료 수만 센다
- 할 일 목록·작업 이름 입력, 여러 타이머, 커스텀 세션 순서
- 틱 소리·화이트노이즈·소리 종류 선택. 합성 알림음 두 가지만
- Service Worker/오프라인, PWA 설치
- URL 파라미터(`?focus=50`), 상태 공유 링크
- 길게 눌러 리셋, 원 탭으로 시작(8절 근거), 스와이프 제스처
- 단축키 도움말 오버레이(버튼 `title` 로 대신)
- 다국어(한국어만)
- 블로그 메인 카드·iframe 삽입 자체(Embed 단계의 블로그 쪽 작업. 이 앱은 임베드 모드로 준비만 한다)
