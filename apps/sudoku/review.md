# 미니 스도쿠 Review

- 날짜: 2026-09-22
- 검증 환경: Claude Code Browser pane(Chromium 계열), 로컬 서버 `http://localhost:8000` (`python -m http.server 8000`), 확인 주소 `http://localhost:8000/apps/sudoku/`
- 검증자: Review 서브에이전트 (Build 와 분리). 코드는 전부 읽었고, 판정은 브라우저 실측값을 기준으로 했다. 실측이 불가능한 항목은 「코드 확인」으로 따로 표시.

## 요약

통과 28 / 28, 수정 0건, 미확인 0건 (단, 2항목은 환경 제약으로 "시뮬레이션·코드 확인" — 아래 표시)

## 체크리스트 결과

**생성·로직**
- ✅ `test.html` 전부 통과. 생성 시간 최대 < 100ms — 56/56 통과(경고 0), 120회 생성 평균 0.03ms · 최대 0.30ms
- ✅ 콘솔 `for (…20…) Sudoku.countSolutions(Sudoku.generate({size:6,difficulty:'hard'}).puzzle, 6)` 전부 `1` — 20/20 모두 1. 추가로 6×6 hard 200회 생성 최대 0.30ms, 200판 전부 blanks 24(목표 달성)
- ✅ 새 게임 20번 연속 — MutationObserver 로 20회 기록, 시드 20개 모두 다름, 퍼즐 문자열 20개 모두 다름, 콘솔 에러 없음

**화면·레이아웃**
- ✅ 375px 폭에서 가로 스크롤 없음 — `scrollWidth 375 / innerWidth 375`
- ✅ 375px 에서 6×6 칸과 모든 버튼 44×44 이상 — 칸 56.7×56.7, 숫자 패드 52.2×44.0, 세그먼트 55.0×44.0. `button, a` 전체 중 44 미만 0개
- ✅ 360×480 iframe — `data-embed` 붙음, header `display:none`, 여백 8px, 순서 board(1)→status(2)→numpad(3)→controls(4). 보드 top 8 / bottom 336, 숫자 패드 bottom 420 < innerHeight 479 → 스크롤 없이 보드+패드 한 줄 보임. 칸 54.1px. (블로그 `/` 문서 body 에 JS 로 iframe 을 넣어 확인 — 임시 파일은 만들지 않았다)
- ✅ ≥ 640px(800px) 에서 controls 한 줄 — 세그먼트 2개와 새 게임 버튼 top 이 모두 60px 줄, `.game` 폭 480 · left 152.5 / right 632.5 (clientWidth 785 기준 정확히 가운데), 보드 440px

**테마·대비**
- ✅ 블로그 탭에서 다크로 토글 → 앱 새로고침 5회 모두 `data-theme="dark"`, 토글 `aria-pressed="true"`. 플래시: `theme.js` 가 head 에서 동기 실행되어 body 파싱 전에 `data-theme` 를 붙이므로 구조상 없음(코드 확인 + 5회 육안 이상 없음). 덤으로 블로그 탭 토글 → 열려 있던 앱 탭이 `storage` 이벤트로 즉시 light/dark 따라감 확인
- ✅ 앱 토글로 라이트 전환 → `localStorage.theme = "light"`, 블로그 탭 새로고침 시 `data-theme="light"`
- ✅ 대비(getComputedStyle 로 실제 색을 읽어 WCAG 상대 휘도로 계산, transition 끄고 측정) —
  라이트: 충돌 칸 `#c8202a` on `#fbe9ea` **4.86**, 선택 칸 글자 14.94, 힌트 칸(`--text-muted` on `--bg`) 5.56, 보조 텍스트(status) 5.56, 흐린 패드 버튼 5.56, 세그먼트 미선택 5.06, 힌트+선택(`--text-muted` on `--accent-soft`) 4.96, 같은 숫자(`--accent` on `--bg-elevated`) 4.96
  다크: 충돌 칸 `#ff6b6e` on `#3a1e20` **5.47**, 선택 칸 글자 12.35, 힌트 칸 6.77, 보조 텍스트 6.77, 흐린 패드 6.77, 세그먼트 미선택 6.20, 힌트+선택 5.50, 같은 숫자 6.16
  → 전부 4.5:1 이상. 가장 낮은 것은 라이트 충돌 칸 4.86
- ✅ 하드코딩 색상값 — `grep -n "#[0-9a-fA-F]\{3,6\}" style.css` 결과 18건 전부 10~42행(`:root` / `[data-theme="dark"]` 변수 블록) 안. 컴포넌트 CSS 에는 없음

**입력·게임 흐름**
- ✅ 키보드만으로 4×4 완주 — Tab×3 → 크기 라디오에서 ArrowLeft 로 4×4(즉시 새 게임) → Tab×3 → 보드 첫 칸(자동 선택) → 화살표·숫자로 8칸 채움(중간에 틀린 1 넣어 충돌 3칸 확인 → Backspace 로 해제) → 마지막 숫자에 `완성! 00:34 · 힌트 0회`, 보드 `is-complete`, `document.activeElement.id === "new-game"`, 패드·지우기·힌트 `disabled`, 타이머 4초 뒤에도 00:34 고정, 완성 후 숫자 키 무시
- ✅ 충돌 — 1행1열에 같은 행 given 과 같은 4 입력 → 두 칸 모두 `aria-invalid="true"`, 라벨 끝 `, 충돌`, `text-decoration: underline wavy`, 배경 `--accent-soft`. Backspace → 충돌 0개, 라벨 `1행 1열, 빈 칸`
- ✅ given 칸 — 선택 후 `5` `Backspace` `Delete` `0` 지우기 버튼 모두 무시, 저장 board 도 변화 없음. 힌트로 채운 칸도 `1` `Backspace` 무시(라벨 `1행 2열, 1, 힌트` 유지)
- ✅ 힌트 — 새 게임 직후(선택 없음) 힌트 클릭 → 행 우선 첫 빈칸(인덱스 1) 채워지고 `aria-selected="true"`, `aria-readonly="true"`, `is-hinted`, 상태줄 `힌트 1 · 남은 19`, 저장 `hinted: [1]`
- ✅ 숫자 N 개 완료 — 1 을 6개째 놓자 패드 `1` 에 `is-done` + `aria-disabled="true"`, 색 `--text-muted`, 점선 테두리. 빈칸 선택 후 패드 클릭·키보드 `1` 모두 무시. `9` `7` 도 무시
- ✅ 크기·난이도 변경 — 클릭·화살표 모두 확인 없이 즉시 새 게임, `sudoku:prefs` 가 `{"v":1,"size":6,"difficulty":"hard"}` 로 갱신

**저장·복원**
- ✅ 입력 → 새로고침 — board 문자열 동일, 힌트 칸 유지, `00:55` → 3초 뒤 새로고침 → `00:58` 부터 이어짐(pagehide 저장 확인)
- ✅ 완성 후 새로고침 — 저장 `complete: true` → 새 판(빈칸 8, 00:00, `is-complete` 없음)
- ✅ `localStorage.setItem('sudoku:game', '{broken')` 후 새로고침 — 콘솔 에러 없이 새 게임, 저장이 정상 스키마로 덮어써짐. 추가: given 칸 값을 변조한 저장 → 조용히 버리고 새 게임(given 은 puzzle 이 진실)
- ✅ 숨김 타이머 — Browser pane 은 뒤 탭을 `document.hidden=true` 로 만들지 않아(10초 뒤 탭에 두어도 `visibilityState: "visible"`) 실제 탭 전환으로는 측정 불가. 대신 `document.hidden` getter 를 `true` 로 덮고 `visibilitychange` 를 쏴서 시뮬레이션: 4초 동안 `02:29` 고정 + hidden 시점 `elapsed` 저장(149) → 복구 후 2초 뒤 `02:31`. 코드(`tick`: `if (document.hidden || state.complete) return`)와 일치 — **시뮬레이션·코드 확인**

**기타**
- ✅ 콘솔 에러·경고 없음 — 로드, 20판 생성, 4×4 완성, 테마 토글, 새로고침 ×7, 깨진 JSON 복원 전 과정에서 `read_console_messages` 결과 0건. 네트워크 요청 전부 200
- ✅ `prefers-reduced-motion: reduce` — Browser pane 에 에뮬레이션 수단이 없어 **코드 확인**: `style.css` 347~353행 `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } .btn:hover, .back-link:hover { transform: none; } }` — 완성 stagger(`cell-pop`)와 모든 transition 이 꺼진다
- ✅ 스크린리더 라벨 — `read_page` 접근성 트리: `grid "스도쿠 6×6 보드"` > `row` > `gridcell "1행 2열, 4, 주어진 숫자"`, `"1행 1열, 빈 칸"`, `"1행 2열, 1, 힌트"`, `"1행 4열, 1, 충돌"`, `"1행 1열, 1, 주어진 숫자, 충돌"` — spec 6절 형식 그대로. 패드 `button "숫자 5 입력"`, 라디오그룹 `"판 크기"` / `"난이도"`. `:focus-visible` outline 2px `--accent` 실측(뷰포트 축소 때문에 1.6px 로 읽힘)
- ✅ 상대 경로 — `grep -n 'href="/\|src="/' apps/sudoku/*.html` 결과 없음. 로드된 요청 5개 전부 `./` 상대 경로

## 코드 리뷰 (브라우저와 별개)

- `sudoku.js`: 입력 배열 변형 없음 — 콘솔에서 `generate` 결과 puzzle 에 `countSolutions` `solve` `findConflicts` `isComplete` `digitCounts` 를 돌린 뒤 문자열 비교 동일. `peers()` 는 캐시의 `slice()` 를 돌려 주므로 호출자가 `push` 해도 캐시 길이 12 유지. `countSolutions(빈 6×6, 6, 2, maxNodes=5)` → `2`(상한 초과 시 2 확인). `carve` 의 `blanks` 는 실제로 뺀 칸 수이며 test.html 에서 120회 모두 `puzzle` 의 0 개수와 일치.
- `app.js`: `localStorage` 접근은 `readJSON`/`writeJSON` 두 곳에만 있고 둘 다 try/catch. `innerHTML` 사용 없음(`textContent`/`createElement` 만). 이벤트 리스너는 정적 컨테이너(`board` `digits` `controls` `document` `window`)에 모듈 초기화 때 한 번만 붙고 칸·패드 버튼은 새 게임마다 재생성만 하므로 중복 등록 없음. 변조된 저장(given ≠ puzzle)은 `restoreGame` 95행에서 거부 → 새 게임.
- `theme.js`: head 단계에서 만지는 DOM 은 `document.documentElement` 의 속성만. `storage` 리스너는 `e.key === 'theme' || e.key === null`(clear) 에만 반응.
- 접근성: `role="grid"/"row"/"gridcell"`, roving tabindex(선택 칸만 0, 없으면 첫 칸), `aria-selected`/`aria-readonly`/`aria-invalid` 매 렌더 갱신, 세그먼트도 roving tabindex + 화살표.

## 발견한 문제와 수정

없음. 28항목 모두 첫 실측에서 통과해 `apps/sudoku/` 안의 파일을 고치지 않았다.

## 명세에 대한 의견

1. **status 의 `aria-live` 와 "남은 m" 이 서로 어긋난다.** 4절은 상태줄에 `힌트 n · 남은 m` 을 두고, 6절은 "완성·힌트 사용 때만 문구가 바뀌게 해서 매초 시끄럽지 않게" 라고 한다. 타이머는 `aria-hidden` 별도 span 이라 조용하지만, "남은 m" 은 칸을 채우거나 지울 때마다 바뀌므로 스크린리더가 입력마다 `힌트 0 · 남은 19` 를 읽는다. 매초는 아니어서 6절의 취지(타이머 소음 방지)는 지켜졌지만, 문장 그대로는 위반. 구현은 4절을 따랐고 동작상 합리적이라 고치지 않았다. 다음 판에서 `남은 m` 을 `aria-live` 밖으로 빼거나 6절 문구를 "타이머는 읽지 않는다" 로 바꾸면 정리된다.
2. 9절 "숨겨진 탭 타이머" 와 "reduced-motion" 은 이 리뷰 환경(Browser pane)에서 직접 재현할 방법이 없다. 체크리스트에 "재현 불가 시 코드 확인으로 대체" 를 명시해 두면 다음 Review 가 헤매지 않는다.
3. 라이트 테마 충돌 칸(`--accent` on `--accent-soft`) 4.86:1 은 통과지만 여유가 0.36 뿐이다. 팔레트는 블로그와 공유하므로 여기서 바꾸지 않았다. 블로그 팔레트를 손볼 일이 있으면 `--accent-soft` 를 조금 더 밝게 하는 쪽이 안전하다.

## 남은 위험

- **localStorage 공유**: 블로그 카드의 iframe 과 새 탭에서 연 앱이 같은 출처라 `sudoku:game` 을 공유한다. 카드에서 몇 칸 두고 새 탭에서 열면 같은 판이 이어지고, 어느 한쪽에서 새 게임을 누르면 다른 쪽은 다음 로드 때 그 판을 따라간다. 의도된 동작(이어하기)이지만 Embed 단계에서 "카드와 전체 화면이 한 판" 이라는 걸 알고 있어야 한다.
- **iframe 높이 480 에서 controls 는 스크롤 아래**: 명세대로 board→status→numpad 까지만 첫 화면에 들어오고(bottom 420 / 479) 크기·난이도·새 게임은 iframe 안 스크롤로 내려가야 보인다. 카드에 "새 게임" 이 바로 보이길 원하면 iframe 높이를 ~560 이상으로 잡아야 한다(controls 두 줄 ≈ 110px).
- **Browser pane 은 스크린샷이 한 프레임 늦게 잡힌다**: 이번 검증에서 클릭 직후 스크린샷이 이전 상태를 보여 준 적이 두 번 있었다. 판정은 전부 DOM/`getComputedStyle` 값으로 했으므로 결과에는 영향 없지만, 다음 Review 가 스크린샷만 보고 "안 바뀌었다" 고 오판하지 않도록 남긴다.
- **테마 sync 는 같은 출처에서만**: `storage` 이벤트는 같은 출처의 다른 문서에서만 온다. 배포(`asdfdsign.github.io/asdf-blog/`)에서는 블로그와 앱이 같은 출처라 문제 없지만, 다른 도메인에 임베드하면 부모 페이지 테마를 따라가지 않는다(그때는 시스템 설정만).
- `100dvh` 를 모르는 오래된 브라우저에서는 `[data-embed] .board` 의 `width: min(100%, 440px, calc(100dvh − 120px))` 선언 전체가 무효가 되어 `min(100%, 440px)` 로 떨어진다. 폭 360 iframe 에선 결과가 같아 체감 차이는 없다.
