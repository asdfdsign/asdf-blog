# 포모도로 타이머 Review

- 날짜: 2026-09-22
- 검증 환경: Claude Code Browser pane(Chromium 계열), 로컬 서버 `http://localhost:8000` (`python -m http.server 8000`), 확인 주소 `http://localhost:8000/apps/pomodoro/`, 임베드는 블로그 `/` 문서 body 에 JS 로 iframe(300×480, 360×480) 삽입, 두 문서 동기화는 블로그 탭의 iframe + 별도 앱 탭(백그라운드, `document.hidden === true`)
- 검증자: Review 서브에이전트 (Build 와 분리). 소스 전부 읽었고 판정은 DOM·`getComputedStyle` 실측값으로 했다. 실측 불가 항목은 「시뮬레이션·코드 확인」으로 표시.
- 시간 가속: 세션 흐름처럼 분 단위 대기가 필요한 항목은 `Date.now` 를 앞으로 덮어 다음 틱에서 끝나게 했다(타이머가 종료 시각 기준이라 결과가 같다). 1분 실측은 「정확도」 첫 항목에서 한 번 실시간으로 했다.

## 요약

통과 46 / 46 (spec 12절 항목 기준), 수정 2건(경미), 시뮬레이션·코드 확인 3건(탭 숨김, 주 버튼 위 Space, reduced-motion) + 부분 코드 확인 2건(테마 플래시, 접근성 트리의 `aria-hidden`)

수정 2건 중 하나(`is-empty`)는 체크리스트 항목이 첫 실측에서 ❌ 였고 고친 뒤 재실측으로 ✅, 다른 하나(틱마다 라벨 텍스트 노드 교체)는 체크리스트 밖에서 발견한 렌더 위생 문제. 그 외 45건은 첫 실측에서 통과. Build 가 따로 요청한 「두 문서 동기화」 2건도 통과.

## 체크리스트 결과

**로직**
- ✅ `test.html` 전부 통과(경고 0) — 119/119 통과, warn 0, 콘솔 0건
- ✅ 콘솔 `Pomodoro.nextSession({session:'focus', cyclePos:3}, {interval:4})` → `'long'`, `cyclePos:2` → `'short'`

**정확도**
- ✅ 집중 1분 실시간 완주 — 시작 클릭 캡처 `t0 = 1790044640731`, 세션 라벨이 `짧은 휴식` 으로 바뀐 MutationObserver 시각 `t1 = 1790044700739` → `t1 − t0 − 60000 = 8ms` (< 200)
- ✅ `Date.now` +30초 덮어쓰기 → 1초 뒤 `05:00 → 04:29`(실제 경과 1.0초, 표시 31초 감소), 복구 뒤 `04:58` 로 돌아옴 — 종료 시각 기준 계산 확인
- ✅ 탭 숨김 — `document.hidden`/`visibilityState` getter 를 덮고 `visibilitychange` 발송 → 20초 대기(`05:00 → 04:40`, 인터벌은 계속) → `Date.now` +600초 + `hidden=false` + `visibilitychange` → **동기적으로** `short running → focus idle`, 라벨 `집중`, 점 `●●○○` 유지, 라이브 `짧은 휴식 끝. 집중 1분. 시작을 누르세요`. 추가로 실제 백그라운드 탭(`document.hidden === true`)에서 1분 세션이 끝나는 것도 확인(아래 「두 문서 동기화」). **시뮬레이션·코드 확인**(`onVisible` 354~360행)
- ✅ 일시정지 20.0초 뒤 계속 — `remainingMs 286209` → 계속 직후 `endAt − now = 286196`(차 13ms), 숫자 `04:47` 동일, 일시정지 중 20초간 숫자·제목 불변

**원 그래픽**
- ✅ `stroke-dasharray: 100px`, offset 실측 — 시작 직후 inline `0`; 23.3초 경과 시 inline `−38.78` vs 공식 `−38.85`; 42.0초 경과 `−70.0117` vs `−70.0117`(일치); 완료 순간 `0`. 컴퓨티드 값은 250ms transition 때문에 inline 보다 0.4 뒤에 온다(정상)
- ✅ 12시에서 시작해 시계 방향으로 빈다 — 38% 경과 스크린샷에서 12시~약 4시30분 구간이 트랙 색, 남은 호는 그 뒤 12시까지
- ✅ `stroke-linecap: round`, 트랙 `rgb(228,223,219)` = `--border`, 진행 색 집중 `rgb(200,32,42)` = `--accent` / 휴식 `rgb(43,111,158)` = `--rest` (다크: `rgb(255,107,110)` / `rgb(111,179,224)`)
- ✅ `transitionProperty: stroke-dashoffset, stroke`, `transitionDuration: 0.25s, 0.4s`. 완료 직후 offset `0`, stroke 는 동기 읽기에선 이전 색(휴식) → 500ms 뒤 새 색(집중) — 400ms 로 넘어감
- ✅ 남은 8초에서 `.timer.is-ending`, 숫자 색 `rgb(170,31,39)`(→ `--accent` 로 전환 중), 진행 원 `animation: ring-pulse 1s`. 남은 10초 정확히 `10초 남음` 안내. **0 에서 `is-empty` → `opacity 0`: 첫 실측 ❌ → 수정 → ✅**(아래 「발견한 문제」 1)
- ✅ 숫자 중심 − 원 중심 차이 `[0, 0]px`, `font-variant-numeric: tabular-nums`, 360px 원에서 72px

**세션 흐름** (1·1·1분, 간격 2, `오늘 기록 지우기` 뒤 시작)
- ✅ 집중 완료 → `짧은 휴식`·`휴식 시작`·`●○`·`오늘 1회`·idle(5초 뒤 숫자 `01:00` 불변) → 휴식 완료 → `집중`·`●○` 유지 → 집중 완료 → `긴 휴식`·`●●`·`오늘 2회`(`aria-label` "다음 긴 휴식까지 0회") → 긴 휴식 완료 → `집중`·`○○`·`오늘 2회`
- ✅ 집중 건너뛰기 → `짧은 휴식`, 점·횟수 불변(`○○`, `오늘 2회`). 긴 휴식 건너뛰기(`●●`) → `집중`, `○○`, `오늘 4회` 유지. 라이브 `건너뜀. 집중 1분`
- ✅ 리셋 — running 20초 지점(offset `−33.75`, `00:40`) → idle, offset `0`, `01:00`, 점 불변, `confirm` 없음(`window.confirm` 호출 없이 즉시), 라이브 `처음으로. 집중 1분`
- ✅ 세션이 끝나도 자동 시작 없음 — 완료 5초 뒤 `status idle`, 숫자 `01:00` 그대로

**소리**
- ✅ 로드 직후 `__pomodoro.getAudioCtx() === null`. 코드: `new Ctor()` 는 `ensureAudio()` 안에만, 호출은 `doToggle`(클릭·Space)과 `toggleSound`(켤 때)만(265·312행)
- ✅ 시작 클릭 뒤 `audioCtx.state === 'running'`, 완료 순간 `playChime('focus')` spy 1회(`ctxState: running`). `tone()` 이 `OscillatorNode.start` 호출(85행). 백그라운드 탭·iframe 동시 실행에서도 소리는 총 1회(먼저 끝낸 문서만)
- ✅ 토글 끔 → `aria-pressed="false"`, `aria-label="소리 끔"`, 빗금 아이콘 `display: block`, `pomodoro:settings.sound === false`, 그 상태로 집중 완주 → `playChime` 호출 0회. 다시 켬 → `playConfirm` 1회, `aria-pressed="true"`
- ✅ `pomodoro:state` 를 `running`·`endAt = now − 5000` 으로 바꾸고 로드 → 즉시 완료(`long idle`, `completed 5 → 6`, 제목 `(끝) 집중 끝 — 포모도로`, 라이브 문구 있음), `audioCtx === null`, 콘솔 0건(자동재생 경고 없음). ※ 변조 저장은 `pagehide` 저장에 덮이지 않도록 `test.html` 문서에서 써 넣었다

**탭 제목**
- ✅ running `(01:00) 집중 — 포모도로` → 60초 동안 `<title>` 변경 61회(초당 1회 + 마지막 `(끝) …`), 5초 구간 ≤ 6. paused `(일시정지 04:47) 짧은 휴식 — 포모도로`. idle `포모도로 타이머`. 완료 직후 `(끝) 집중 끝 — 포모도로`
- ✅ 임베드(300×480·360×480 iframe) 안에서 running 중에도 `document.title === '포모도로 타이머'` 불변

**설정·저장**
- ✅ 집중 30 입력 → `pomodoro:settings.focus 30`, idle 이라 숫자 즉시 `30:00`, `pomodoro:state.durationMs 1800000`. running(30분) 중 집중 1 로 바꾸면 `durationMs 1800000`·`endAt` 불변·숫자 `30:00` 유지, 리셋하면 `01:00`(다음부터 1분)
- ✅ `120 → 90`, `0 → 1`, `3.7 → 3`, 빈 값 → 이전 값 `3` 복원(저장도 3 유지), 간격 `9 → 8`(점 8개로 즉시)
- ✅ 기본값으로 → 입력칸 `25/5/15/4`, 저장 동일, 숫자 `25:00`, 점 4개. 오늘 기록 지우기 → `○○`, `오늘 0회`, `aria-label` "오늘 0회 완료, 다음 긴 휴식까지 2회"
- ✅ running 새로고침 — 전 `rem 60000`, 3167ms 뒤 로드 시 `rem 56833`(차 3167 = 실제 경과), `endAt` 동일, 로드 후 1.5초 뒤 `00:57 → 00:56`(인터벌 재가동). paused 새로고침 — `remainingMs 44329`·`00:45`·`계속` 그대로
- ✅ `'{broken'` → 에러 없이 새 상태(`focus idle`, 저장이 정상 스키마로 덮임). `session: 'nap'` + `completed 7` → 버리고 새 상태(`completed 0`)
- ✅ `date: '2026-09-21'`, `completed 7`, `cyclePos 2` → 로드 시 `completed 0`, `cyclePos 0`, `date 2026-09-22`, 점 `○○`, `오늘 0회`
- ✅ `Storage.prototype.setItem` spy — 1분 running 동안 호출 2회(시작 직후 `pomodoro:state`, 완료 순간 `pomodoro:state`), 틱 중 0회

**레이아웃**
- ✅ 375×667: `scrollWidth 375 / innerWidth 375`, `scrollHeight 667`(세로 스크롤도 없음)
- ✅ 375px 에서 `button, summary, a` 9개 전부 ≥ 44×44(뒤로 80.5×44, 테마·소리·리셋·건너뛰기 44×44, 설정 summary 342×44, 텍스트 버튼 104×44·145×44), 주 버튼 239.5×**56**
- ✅ 300×480 iframe: `data-embed` 붙음, header·settings `display: none`, `--gutter 8px`, 원 **278.9px**, 세션 줄 top 8 → 원 top 60 → 버튼 줄 bottom 403 → 점 bottom **432 < 479**, `scrollHeight 479`(스크롤 없음), 주 버튼 폭 179 ≥ 140. 360×480 도 원 278.9·점 bottom 432·스크롤 없음
- ✅ 780px: `.timer` 폭 420, 좌 180.1 / 우 600.1(중앙 오차 0.13px), 원 360px
- ✅ 375×667 비임베드: 설정 summary bottom **625 < 667**, header 포함 한 화면

**테마·대비**
- ✅ 블로그 탭 토글 → `localStorage.theme = dark`, 열려 있던 앱 탭·카드 iframe 이 `storage` 로 즉시 `data-theme="dark"`(`aria-pressed="true"`). 앱 새로고침 5회 모두 로드 직후 `dark`. 플래시: `theme.js` 가 `<head>` 동기 스크립트(스크립트 순서 `theme.js → timer.js → app.js`, `document.head.contains` 확인)라 첫 페인트 전에 속성이 붙는다 — 코드 확인. 앱 토글 → 블로그 탭·iframe 따라감, 다시 토글 → `light`
- ✅ 대비 실측(변수값을 요소에 적용해 `getComputedStyle` → WCAG 상대 휘도, 그리고 실제 pill·주 버튼·`오늘 n회` 요소에서 재측정) —
  라이트: `--rest` on `--bg` **5.20**, `--rest` on `--rest-soft`(휴식 pill) **4.70**, `--accent-contrast` on `--rest`(휴식 주 버튼) **5.43**, `--accent-contrast` on `--accent`(집중 주 버튼) **5.68**, `--text-muted` on `--bg` **5.56**. 집중 pill(`--accent` on `--accent-soft`) 4.86
  다크: `--rest` on `--bg` **8.17**, `--rest` on `--rest-soft` **6.44**, `--accent-contrast` on `--rest` **8.17**, `--accent-contrast` on `--accent` **6.73**, `--text-muted` on `--bg` **6.77**. 집중 pill 5.47
  → 전부 4.5:1 이상. 가장 낮은 것은 라이트 휴식 pill 4.70(명세 예상 5.2 는 `--rest` on `--bg` 쪽 값이고 그것은 5.20 으로 일치)
- ✅ `grep -n "#[0-9a-fA-F]\{3,6\}" style.css` — 11~54행(`:root` / `[data-theme="dark"]`) 밖에는 0건

**키보드·접근성**
- ✅ `Space` 시작 → 일시정지 → 계속(`defaultPrevented: true` 셋 다), `S` 건너뛰기(라이브 `건너뜀. …`), `R` 리셋, 한글 자판 `ㄴ`(`code KeyS`)도 건너뛰기. 설정 입력에 포커스 → `Space`·`S`·`R` 전부 무시(상태 JSON 동일), `Ctrl+S` 무시. **주 버튼 포커스 + Space 는 시뮬레이션·코드 확인**: 버튼을 target 으로 한 keydown 은 핸들러가 `closest('button, summary, a')` 에서 조기 반환(`defaultPrevented: false`, 상태 불변) → 토글은 브라우저 기본 클릭 1회만. Browser pane 의 key 도구가 Space·Enter 를 `key: ""` 로 보내 실제 키로는 재현이 안 됐다(`s`, `Tab` 은 정상). `S` 는 실제 키 입력으로도 확인
- ✅ 접근성 트리(`read_page`): `timer "짧은 휴식, 남은 시간 1분"`, `status "…"`, `img "오늘 0회 완료, 다음 긴 휴식까지 2회"`, `button "처음으로"` `"다음 세션으로 건너뛰기"` `"소리 켬"` `"다크 모드 전환"`, 주 버튼 텍스트 `휴식 시작`/`집중 시작`/`일시정지`/`계속` 로 바뀜, 설정 입력 4개가 `label` 로 이름 붙음. SVG 11개 전부 `aria-hidden="true"`, `.digits` `aria-hidden="true"` — 단 `read_page` 도구는 `aria-hidden` 을 존중하지 않아 `generic "01:00"` 이 트리에 그대로 찍힌다(`role="img"` 의 자식도 찍힘). 판정은 속성값으로 했다
- ✅ 라이브 영역 변경 로그(1분 실시간) — `집중 1분 시작` → `10초 남음` → `집중 끝. 짧은 휴식 5분. 시작을 누르세요` **정확히 3회**, 정각 안내 없음. 시작·건너뛰기·리셋·완료 직후 첫 렌더에서 정각 안내가 새지 않음(`invalidateLabel` 로 `shown.minutes = -1` 이면 `announce` 가 false, 202행). 2분 이상 타이머에선 분이 줄어들 때 `남은 시간 n분` 1회(코드 확인)
- ✅ `prefers-reduced-motion: reduce` — Browser pane 에 에뮬레이션 수단이 없어 **코드 확인**: `style.css` 455~463행 `@media (prefers-reduced-motion: reduce)` 에서 `*, *::before, *::after { animation: none !important; transition: none !important }` + `.ring__progress`·`.timer.is-ending .ring__progress` 명시 + hover `transform: none`. 진행 원 dashoffset/stroke transition, 색 전환, 펄스 모두 대상
- ✅ `:focus-visible` — Tab 으로 리셋·주 버튼 포커스 시 `outline: solid 1.6px rgb(43,111,158)`(휴식 세션 = `--rest`), `outline-offset 1.6px`. 2px 가 뷰포트 축소로 1.6px 로 읽힘(스도쿠 리뷰와 같은 현상)

**기타**
- ✅ 콘솔 에러·경고 0건 — 로드, 1분 실시간 완주 + 가속 완주 12회, 설정 변경 8회, 새로고침 ×8, 깨진 JSON·변조·날짜 복원, 테마 토글 ×4, 소리 토글 ×2, 두 문서 동기화 전 과정
- ✅ 네트워크 — `index` `style.css` `theme.js` `timer.js` `app.js` 5개만, 전부 200/304, 외부 도메인 0
- ✅ `grep -n 'href="/\|src="/' apps/pomodoro/*.html` 결과 없음. `http` 문자열도 소스 어디에도 없음
- ✅ `grep -n "document\|localStorage\|Date.now" timer.js` 결과 0건(`window.Pomodoro =` 대입도 패턴에 안 걸림)

**두 문서 동기화** (Build 가 집중 요청)
- ✅ 블로그 `/` 의 300×480 iframe 에서 시작 → 백그라운드 앱 탭이 `storage` 1회 받고 `running`·같은 `endAt`·`일시정지` 라벨, 2초 뒤 숫자 줄어듦(인터벌 재가동). 앱 탭에서 일시정지 → iframe `paused`·`계속`·같은 `remainingMs`, 숫자 정지. iframe 에서 건너뛰기 → 앱 탭 `short idle`, 제목 `포모도로 타이머`
- ✅ 둘 다 running 으로 1분 완주(앱 탭은 `document.hidden === true` 실제 숨김) — iframe 이 먼저 끝내고 저장 → 숨김 탭이 `storage` 로 idle 을 받아 자기 완료 처리 없이 따라감. 결과 두 문서 모두 `focus idle`, `completed`·`cyclePos` 동일, **소리 1회**(iframe), `setInterval` 추적 Set 이 두 문서 모두 **0개**(인터벌 누수·잔존 없음), 완료 뒤 1.5초 숫자 불변

## 코드 리뷰 (브라우저와 별개)

- `timer.js`: 모든 전이가 `assign()` 으로 새 객체를 돌려주고 입력을 건드리지 않음(test.html 15번 그룹 + `complete(idle)` 참조 동일). `now` 는 전부 마지막 인자. `isValidState` 가 `settings.interval` 을 상한으로 `cyclePos` 검사.
- `app.js`: `localStorage` 는 `readJSON`/`writeJSON`(46~55행) 두 곳, 둘 다 try/catch. `AudioContext` 생성은 `ensureAudio` 안에서만, 호출은 제스처 핸들러 둘. 이벤트 리스너는 모듈 초기화 때 정적 요소에 한 번씩(385~425행)만 붙고 세션마다 재등록하는 코드가 없다 — 가속 12세션 뒤에도 동작 중복 없음. 단발 `setTimeout` 은 `stopTimers()` 가 `clearTimeout` 하고, `stopTimers` 는 일시정지(267)·건너뛰기(288)·리셋(299)·완료(252)·`startTimers` 진입(235)·`onStorage`(371) 모두에서 불린다. `finish()` 는 `status !== 'running'` 가드로 tick·알람·visible·storage 네 경로 중 한 번만(실측: `completed` 1 → 2, chime 1, 저장 1, 라이브 1).
- `theme.js`: head 에서 만지는 것은 `documentElement` 속성과 `document.dispatchEvent` 만. `storage` 리스너는 `e.key === 'theme' || e.key === null`(clear) 에만 반응. 스도쿠 `theme.js` 와 주석 두 줄만 다름.
- 접근성: `.digits`·SVG 11개 `aria-hidden`, `role="timer"` 라벨은 분이 바뀔 때만 갱신, `role="status" aria-live="polite" aria-atomic`, 세 아이콘 버튼 `aria-label` + `title`, `:focus-visible` 2px `--session`.

## Build 의 명세 이탈 판정

1. **`applySettings`·`complete` 가 `cyclePos` 를 `interval` 로 잘라 내림** — **타당(명세 보완)**. 간격을 `cyclePos` 보다 작게 줄이면 저장 상태가 `isValidState` 의 `cyclePos ≤ interval` 에 걸려 다음 로드 때 통째로 버려지는데, 그건 더 나쁜 결과다. 잘린 뒤에도 `nextSession` 이 `cyclePos + 1 ≥ interval` 이라 다음 휴식은 긴 휴식으로 가고, 점은 전부 채워져 의미가 유지된다. 실측: 간격 9→8 에서 `cyclePos 2` 유지, test.html 11번 "4 → 2" 통과.
2. **`normalizeSettings` 빈 값·NaN → 기본값, 이전 값 복원은 `onSettingChange` 담당** — **타당(명세 보완)**. 순수 함수는 "이전 값" 을 알 수 없으니 기본값으로 떨어뜨리고 UI 쪽에서 거르는 분담이 맞다. 실측: 빈 값 → 입력칸 `3` 복원, 저장도 `3` 유지. test.html 1번 `{short: '', long: NaN}` → 기본값 통과.
3. **설정 변경 시 `pomodoro:state` 도 저장, 로드 시 idle 이면 `applySettings` 한 번** — **타당(명세 보완)**. idle 의 `durationMs` 가 설정과 어긋난 채 저장되면 다음 로드에 옛 길이가 뜬다. 이 저장이 다른 문서에 `storage` 를 보내 카드 iframe 도 즉시 새 길이를 따라간다는 부수 효과도 좋다. 실측: 30 입력 → `durationMs 1800000` 저장, 로드 후 `30:00`.
4. **`isValidState` 가 `durationMs === 0` 거부** — **타당(명세 보완)**. `fraction = remaining / durationMs` 가 `NaN` 이 되어 offset 이 `NaN` 으로 써지는 걸 막는다. 정상 경로에선 `durationMs ≥ 60000` 이라 부작용 없음.
5. **정각 안내는 분 값이 줄어들 때만** — **타당(명세 보완)**. 명세 9절 "같은 문구를 연속으로 쓰지 않는다 / 분 값이 바뀔 때만" 의 취지가 "새 분에 진입했을 때" 이고, 늘어나는 경우(세션 전환·계속)는 이미 별도 문구가 나간다. 실측: 1분 완주 라이브 로그 정확히 3건.
6. **`dateKey` 가 `new Date(0); d.setTime(now)`** — **타당(무해)**. `new Date(now)` 를 쓰면 체크리스트의 `grep "Date.now"` 정규식(`.` 이 `(` 에 매치)에 `Date(now` 가 걸리는 오탐을 피하려는 것. 결과는 같고 test.html 2번 `dateKey` 통과. 다음 판에 grep 을 `Date\.now` 로 고치면 평범한 `new Date(now)` 로 돌아갈 수 있다(「명세에 대한 의견」 4).

## 발견한 문제와 수정

1. **남은 시간 0 에서 `is-empty` 가 펄스에 밀려 `opacity 0` 이 안 됨** (`style.css`)
   - 발견: paused·`remainingMs 0` 상태(다른 문서에서 `pomodoro:state` 로 주입)에서 `.ring__progress.is-empty` 인데 `getComputedStyle().opacity` 가 `0.5589`, `animationName` 이 `ring-pulse`.
   - 원인: `style.css` 271행 `.ring__progress.is-empty { opacity: 0; animation: none }`(클래스 2개) 보다 294행 `.timer.is-ending .ring__progress { animation: ring-pulse … }`(클래스 3개) 가 특이도가 높아 애니메이션이 살아 있고, 애니메이션이 `opacity` 를 덮어쓴다. 0 초에서 `is-ending`(status ≠ idle) 과 `is-empty` 가 항상 같이 붙으므로 "0 에서 opacity 0" 이 실제로는 한 번도 이길 수 없는 규칙이었다. running 은 0 에 닿기 전에 `finish()` 가 idle 로 보내 화면엔 거의 안 보이지만, 종료 순간에 일시정지를 누르면(`remainingMs = max(0, …) = 0`) 둥근 캡 점이 깜빡이는 상태로 남는다.
   - 수정: 규칙을 펄스 규칙 **뒤로** 옮기고 선택자를 `.ring__progress.is-empty, .timer.is-ending .ring__progress.is-empty` 로 늘렸다.
   - 재확인: 같은 주입에서 `opacity "0"`, `animationName "none"`, `is-ending true` 인 채로. 리셋 뒤 `is-empty false`, `opacity 1`.

2. **`render()` 가 틱마다 세션 라벨·주 버튼 라벨 텍스트 노드를 갈아 끼움** (`app.js`)
   - 발견: 완료 시각을 잡으려고 `#session-label` 에 MutationObserver 를 달았더니 1분 동안 `집중 → 집중` 변경이 240회(250ms 마다) 기록됐다. `#main-label` 도 같다.
   - 원인: `app.js` 185~186행 `els.sessionLabel.textContent = …`, `els.mainLabel.textContent = …` 가 값이 같아도 매 렌더에 대입 — `textContent` 대입은 기존 텍스트 노드를 제거하고 새로 만들기 때문에 DOM 변경·레이아웃 작업이 틱마다 생긴다. 숫자·제목·라이브 영역은 `shown` 캐시로 잘 막아 두었는데 이 둘만 빠졌다. 화면상 문제는 없지만 "250ms 마다 `stroke-dashoffset` 하나만 바꾼다" 는 4절의 의도와 어긋나고, DOM 변경을 감시하는 보조 기술에 불필요한 갱신을 준다.
   - 수정: 현재 `textContent` 와 다를 때만 대입(같은 방식의 두 줄 가드).
   - 재확인: running 2.1초(약 8틱) 동안 `#session-label` 변경 **0회**, `#main-label` 변경 1회(시작 순간 `집중 시작 → 일시정지`), 일시정지 때 1회 더(`계속`). 세션 전환·라벨 갱신은 그대로 동작(가속 완주 재확인).

## 명세에 대한 의견

1. **다른 문서가 끝낸 세션은 `(끝)` 제목이 안 뜬다.** `onStorage` 가 `endedLabel = null` 로 초기화하므로, 숨김 탭이 카드 iframe 의 완료를 `storage` 로 받으면 제목이 `포모도로 타이머` 로 간다(실측). 사용자가 그 탭으로 돌아왔을 때 "끝났다" 는 단서가 제목엔 없다(화면엔 있다). 5절이 두 문서 상황을 정하지 않아 고치지 않았다. 다음 판에 `onStorage` 에서 "이전 상태 running, 새 상태 idle, 세션이 바뀜" 이면 `endedLabel` 을 이전 세션으로 두는 한 줄이면 된다.
2. **체크리스트 「Space 한 번에 한 번만 토글」 은 Browser pane 에서 실제 키로 재현이 안 된다.** key 도구가 Space·Enter 를 `key: ""`, `code: ""` 로 보내 버튼 기본 동작도 앱 핸들러도 반응하지 않는다(`s`·`Tab` 은 정상). 이번엔 합성 `KeyboardEvent` 로 핸들러 분기만 확인했다. 다음 Review 가 헤매지 않도록 12절에 "Space 는 합성 이벤트 + 코드 확인" 을 적어 두면 좋다.
3. **`read_page` 는 `aria-hidden` 을 무시한다.** 체크리스트 "`.digits` 와 SVG 가 트리에 없음" 은 이 도구로는 판정이 안 되고(SVG 는 원래 안 찍고, `.digits` 는 찍힌다) 속성값으로 확인해야 한다. 12절 문구를 "`aria-hidden="true"` 속성 확인" 으로 바꾸는 편이 정확하다.
4. **`grep "Date.now"` 는 `new Date(now)` 에 오탐한다.** Build 가 그걸 피하려고 `new Date(0); d.setTime(now)` 를 썼다(이탈 6). 체크리스트를 `grep -n "document\|localStorage\|Date\.now"` 로 이스케이프하면 순수 함수 쪽 코드를 평범하게 쓸 수 있다.
5. **라이트 휴식 pill(`--rest` on `--rest-soft`) 4.70:1** 은 통과지만 여유가 0.2. `--rest-soft` 는 이 앱만의 변수라 블로그와 무관하게 조금 더 밝게(`#edf4f9` 정도) 해도 된다. 취향·여유 문제라 고치지 않았다.
6. 4절 "`-dashoffset === 100 − remaining%` 오차 ±0.5" 는 **inline style** 기준으로만 맞다. 컴퓨티드 값은 250ms transition 중이라 최대 약 0.4 뒤에 온다(실측 `−38.78` vs `−38.41`). 판정 기준을 "inline `style.strokeDashoffset`" 으로 적어 두면 헷갈리지 않는다.

## 남은 위험

- **카드 iframe 과 새 탭은 한 타이머다.** 카드에서 시작하면 새 탭도 같은 `endAt` 을 보고 돈다(의도). 둘 다 앞에 있으면 각자 소리를 낸다(명세가 감수한 것). 이번 실측처럼 한쪽이 백그라운드면 앞쪽이 먼저 끝내고 뒤쪽은 `storage` 로 따라가 소리는 1회였다 — 다만 이건 보장이 아니라 타이머 스로틀링의 결과다.
- **iframe 높이 480 은 딱 맞는다.** 점 bottom 432 / 479 로 여유 47px. 카드 CSS 가 iframe 안쪽에 padding 을 주거나 `height` 를 줄이면 점 줄이 잘린다. `loading="lazy"` 는 문제 없음(`theme.js` 가 로드 시점에 `data-embed` 를 붙인다).
- **임베드에서 소리는 iframe 안 제스처가 있어야 난다.** 카드에서 시작 버튼을 눌렀다면 그 문서에 `AudioContext` 가 생겨 카드가 화면에 없어도(스크롤로 내려가도) 울린다. 사용자가 새 탭에서 시작했고 카드는 보고만 있다면 카드는 조용하다. 명세대로지만 Embed 설명에 적어 두면 좋다.
- **Browser pane 특성 3가지**(다음 Review 용): ① 백그라운드 탭은 CSS transition 이 진행되지 않아 `getComputedStyle` 색이 중간값에 멈춘다 — 대비 측정은 전면 탭에서. ② `navigate` 로 새로고침하면 `pagehide` 저장이 내가 써 넣은 `localStorage` 를 덮는다 — 변조 테스트는 `test.html` 문서에서 써 넣고 이동. ③ key 도구의 Space·Enter 미전달(위 의견 2).
- **`100dvh`·`container-type`·`aspect-ratio`·`pathLength`** 를 모르는 오래된 브라우저에선 원 크기 계산이 `min(100%, 360px)` 로 떨어지거나 숫자 크기가 `clamp` 하한/상한으로 간다. 배포 대상(최신 Chromium·Safari·Firefox)에선 문제 없음.
- 테스트로 바꾼 `localStorage`(`pomodoro:settings`, `pomodoro:state`, `theme`) 는 원래 값으로 되돌렸고(`theme` 은 원래 없었으므로 제거), 뷰포트 에뮬레이션도 해제했다.
