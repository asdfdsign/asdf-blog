# Build 지침 — 포모도로 타이머 (apps/pomodoro)

당신은 구현만 한다. 명세는 `apps/pomodoro/spec.md` 이고, 그 문서가 이 지침보다 우선한다. 먼저 `spec.md` 전체와 루트 `CLAUDE.md` 를 읽어라. 첫 앱 `apps/sudoku/` 의 `theme.js`, `style.css` 변수 블록, `index.html` header 구조, `test.html` 형식은 **참고해서 같은 톤으로** 만들되, 파일을 그대로 복사하지 말고 `apps/pomodoro/` 안에 자체 완결로 둔다(`../../` 나 `../sudoku/` 참조 금지).

## 만들 파일 (이것만)

`apps/pomodoro/` 아래:
- `index.html` — head 에 `./theme.js` 동기 로드, body 끝에 `./timer.js` → `./app.js` 순서 classic script. 인라인 SVG 9개는 spec 10절 목록대로
- `style.css` — 블로그 팔레트 + `--rest`/`--rest-soft`. 컴포넌트는 `--session`/`--session-soft` 만 참조. `[data-embed]` 변형, `prefers-reduced-motion` 블록
- `theme.js` — 스도쿠와 같은 내용(블로그 theme.js + `storage` 동기화 + `data-embed` 판정)
- `timer.js` — 순수 로직. **`document`·`localStorage`·`Date.now` 참조 금지, `now` 는 인자로.** `window.Pomodoro` 로 spec 11절 함수 전부를 이름·시그니처·반환 그대로 노출
- `app.js` — UI 전부. `audioCtx` 와 재생 함수는 Review 가 spy 를 걸 수 있게 `window.__pomodoro = { getAudioCtx, playChime, ... }` 식으로 디버그 핸들을 하나 노출한다(spec 12절이 그걸 전제한다)
- `test.html` — spec 11절 테스트 케이스. 가짜 시계(`now` 인자)로. 맨 위 요약 + 표

## 절대 하지 않는 것

- `apps/pomodoro/` 밖의 파일을 만들거나 고치지 않는다. 블로그 `index.html`, `css/`, `js/`, `content/`, `CLAUDE.md`, `apps/sudoku/` 모두.
- `spec.md`, `agent/` 를 고치지 않는다. 명세가 틀렸거나 모호하면 최종 보고에 적고 보수적으로 구현한다.
- 외부 라이브러리·CDN·웹폰트·오디오 파일 없음. 소리는 Web Audio 합성.
- 절대 경로 금지. 컴포넌트 CSS 에 색상 리터럴 금지.
- `innerHTML` 에 동적 값을 넣지 않는다. `textContent` 와 DOM API.
- `AudioContext` 를 사용자 제스처 전에 만들지 않는다.

## 구현 요령

- 주석은 한국어, 짧고 이유를 적는 톤. 파일 상단에 그 파일이 하는 일 한두 줄.
- `app.js` 는 `state`·`settings` 두 객체 + `render()` 하나. 250ms 인터벌은 `running` 에서만 살아 있고, 저장은 spec 7절 시점에만(틱마다 금지).
- 원의 `stroke-dashoffset` 은 spec 4절 공식 그대로(`-(100 - remaining%)`), Review 가 실측한다.
- 라이브 영역 문구는 spec 9절의 순간에만 바꾼다. 같은 문구 연속 쓰기 금지.

## 스스로 확인하고 끝내라

로컬 서버는 `http://localhost:8000` 에 떠 있다(없으면 저장소 루트에서 `python -m http.server 8000` 백그라운드). Browser pane(`mcp__Claude_Browser__*`)으로:
1. `http://localhost:8000/apps/pomodoro/test.html` 전부 통과
2. `http://localhost:8000/apps/pomodoro/` 콘솔 에러·경고 0. 설정에서 집중 1분으로 바꾸고 시작 → 1분 뒤 휴식으로 넘어가며 `idle` 로 멈추는지, 원이 12시부터 시계 방향으로 비는지(스크린샷 1장)
3. 375px 에서 `scrollWidth <= innerWidth`, 버튼 전부 44px 이상
4. running 중 새로고침 → 이어짐

## 최종 보고

- 만든 파일 목록과 줄 수
- 자가 확인 4항목 결과(실측값)
- 명세와 다르게 한 것 / 해석한 것 (없으면 "없음")
- Review 가 집중해서 볼 곳
