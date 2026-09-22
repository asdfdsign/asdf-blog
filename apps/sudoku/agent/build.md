# Build 지침 — 미니 스도쿠 (apps/sudoku)

당신은 구현만 한다. 명세는 `apps/sudoku/spec.md` 이고, 그 문서가 이 지침보다 우선한다. 먼저 `spec.md` 전체와 루트 `CLAUDE.md` 를 읽어라.

## 만들 파일 (이것만)

`apps/sudoku/` 아래:
- `index.html` — 유일한 HTML. head 에 `./theme.js` 동기 로드, body 끝에 `./sudoku.js` → `./app.js` 순서 classic script
- `style.css` — 전체 스타일. `:root` / `[data-theme="dark"]` 변수는 spec 4절·`agent/plan.md` 의 블로그 팔레트 그대로. `[data-embed]` 변형 포함
- `theme.js` — 블로그 `js/theme.js` 를 복사해 `storage` 이벤트 동기화와 `data-embed` 판정을 더한다. `../../js/` 를 참조하지 않는다 (앱은 자체 완결)
- `sudoku.js` — 생성·검증 순수 함수. DOM·localStorage 의존 없음. `window.Sudoku` 로 노출. 공개 함수는 spec 8절 표와 이름·시그니처·반환을 **정확히** 맞춘다
- `app.js` — UI 전부
- `test.html` — spec 8절 「test.html」의 케이스 9묶음. 브라우저에서 열면 맨 위 요약(n/m 통과, 생성 시간 평균·최대) + 케이스 표(이름·기대·실제·통과)

## 절대 하지 않는 것

- `apps/sudoku/` 밖의 파일을 만들거나 고치지 않는다. 블로그 `index.html`, `css/`, `js/`, `content/`, `CLAUDE.md` 모두 손대지 않는다.
- `spec.md`, `agent/` 를 고치지 않는다. 명세가 틀렸거나 모호하면 그 지점을 최종 보고에 적고, 가장 보수적인 해석으로 구현한다.
- 외부 라이브러리·CDN·웹폰트·`package.json` 없음. 빌드 없음.
- 절대 경로(`/apps/...`, `/css/...`) 금지. 전부 `./`, `../../` 상대 경로.
- 컴포넌트 CSS 에 색상 리터럴 금지. 변수 정의 블록에만 hex 가 있어야 한다.
- 절대 하지 않는 것: `innerHTML` 에 사용자 입력이나 저장소에서 읽은 값을 넣지 않는다 (숫자만 다루지만 습관으로). `textContent` 와 DOM API 를 쓴다.

## 구현 요령

- 코드 주석은 한국어, 블로그의 `js/app.js` 톤(짧고 이유를 적는 주석)을 따른다. 파일 상단에 그 파일이 하는 일 한두 줄.
- `sudoku.js`: 비트마스크 + MRV 백트래킹, `maxNodes` 상한, mulberry32. 함수는 입력 배열을 변형하지 않는다.
- `app.js`: 상태 객체 하나(`state`)에 모으고 `render()` 로 DOM 을 갱신하는 단순한 구조. 칸 버튼은 새 게임 때만 만들고 렌더에서는 속성·클래스만 바꾼다(매 입력마다 DOM 재생성 금지).
- 타이머는 `setInterval` 1초, `document.hidden` 이면 멈춘다. 저장은 spec 5절의 시점에만.
- 완성 애니메이션·transition 은 `prefers-reduced-motion: reduce` 에서 전부 끈다.
- 모든 버튼 `min-width/min-height: 44px`, `touch-action: manipulation`.

## 스스로 확인하고 끝내라 (Review 이전에 최소한)

로컬 서버는 이미 `http://localhost:8000` 에 떠 있을 수 있다. 없으면 `python -m http.server 8000` 을 저장소 루트에서 백그라운드로 띄운다. Browser pane 도구(`mcp__Claude_Browser__*`)로:
1. `http://localhost:8000/apps/sudoku/test.html` 전부 통과, 생성 시간 최대 < 100ms
2. `http://localhost:8000/apps/sudoku/` 콘솔 에러 없음, 6×6 새 게임 5회
3. 375px 에서 `document.documentElement.scrollWidth <= innerWidth`
4. 숫자 몇 개 입력 → 새로고침 → 이어짐

## 최종 보고

- 만든 파일 목록과 각 줄 수
- 위 4가지 자가 확인 결과 (실측 숫자 포함)
- 명세와 다르게 한 것 / 모호해서 해석한 것 (없으면 "없음")
- 알려진 미완·의심 지점 (Review 가 집중해서 볼 곳)
