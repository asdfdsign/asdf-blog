# Review 지침 — 미니 스도쿠 (apps/sudoku)

당신은 검증 담당이다. Build 를 한 에이전트와 다른 사람이라고 생각하고, 코드를 믿지 말고 브라우저에서 실측하라. 산출물은 `apps/sudoku/review.md` 이며, 발견한 문제는 `apps/sudoku/` 안에서 직접 고친 뒤 재확인한다.

## 먼저 읽을 것

1. `apps/sudoku/spec.md` — 특히 **9절 검증 체크리스트** 28항목. 이것이 검증의 기준이다.
2. 루트 `CLAUDE.md`
3. `apps/sudoku/` 의 소스 전체 (`index.html`, `style.css`, `theme.js`, `sudoku.js`, `app.js`, `test.html`)

## Build 의 보고에서 미확인으로 남긴 것 (반드시 실측)

- `--accent` 위 `--accent-soft`(선택 칸·충돌 칸 글자/배경) 대비를 라이트·다크 양쪽에서 실측. 계산은 `getComputedStyle` 로 실제 색을 읽어 WCAG 상대 휘도 공식으로 직접 한다. 보조 텍스트, 흐린 패드 버튼(`--text-muted` on `--bg`)도.
- 블로그 탭에서 테마 토글 → 앱 탭이 `storage` 이벤트로 따라가는지 (`tabs_create` 로 탭 두 개).
- `prefers-reduced-motion: reduce` — `resize_window` 로는 못 하므로 `matchMedia('(prefers-reduced-motion: reduce)')` 를 흉내낼 수 없다면, CSS 를 읽어 `@media (prefers-reduced-motion: reduce)` 블록이 모든 animation/transition 을 끄는지 확인하고 review.md 에 "코드 확인" 으로 표시.
- 숨겨진 탭에서 타이머 정지 — `document.hidden` 을 직접 못 바꾸니 `visibilitychange` 핸들러를 읽어 논리를 검증하고, 가능하면 다른 탭을 앞에 두고 10초 뒤 돌아와 타이머 값을 본다.
- 칸의 `aria-label` 이 spec 6절 형식(`"n행 m열, 값|빈 칸(, 주어진 숫자|힌트)(, 충돌)"`)인지 `read_page` 로 확인.

## 코드 리뷰 관점 (브라우저 확인과 별개로)

- `sudoku.js`: 입력 배열을 변형하는 곳이 없는지. `countSolutions` 의 `maxNodes` 초과가 정말 `2` 를 돌려주는지. `generate` 가 목표 빈칸에 못 미쳤을 때 `blanks` 가 실제 값인지.
- `app.js`: `localStorage` 접근이 전부 try/catch 인지. 저장된 `board` 가 `puzzle` 의 given 과 다르면(변조) 어떻게 되는지 — given 은 puzzle 을 진실로 삼아야 한다. `innerHTML` 사용 없음. 이벤트 리스너 중복 등록 없음(새 게임 반복 후).
- `theme.js`: head 동기 실행에서 DOM 을 만지지 않는지. `storage` 이벤트에서 `key === 'theme'` 만 반응하는지.
- 접근성: `role="grid"/"row"/"gridcell"`, roving tabindex, `aria-selected`/`aria-readonly`/`aria-invalid`, `:focus-visible` 링.
- 하드코딩 색상값: `grep -n "#[0-9a-fA-F]\{3,6\}" apps/sudoku/style.css` 가 변수 정의 블록 밖에서 걸리면 문제.
- 절대 경로: `grep -n 'href="/\|src="/' apps/sudoku/*.html` 결과 없음.

## 문제를 찾았을 때

- `apps/sudoku/` 안의 파일만 고친다. `spec.md` 와 `agent/` 는 고치지 않는다. 밖의 파일은 절대.
- 고치면 해당 항목을 다시 실측한다. review.md 에 "발견 → 수정 → 재확인" 을 남긴다.
- 명세 자체가 잘못됐다고 판단되면 고치지 말고 review.md 「명세에 대한 의견」 에 적는다.
- 취향 차이(변수명, 스타일)는 고치지 않는다. 동작·접근성·안전·명세 위반만.

## review.md 형식

```
# 미니 스도쿠 Review

날짜, 검증 환경(브라우저, 로컬 서버 주소)

## 요약
통과 n / 28, 수정 m건, 미확인 k건 (이유)

## 체크리스트 결과
spec 9절 28항목을 그대로 옮기고 각 항목에 ✅/❌/⚠️ + 실측값 한 줄.
(예: ✅ 375px scrollWidth 375 / innerWidth 375)

## 발견한 문제와 수정
번호. 증상 → 원인(파일:줄) → 수정 → 재확인 결과

## 명세에 대한 의견
(없으면 "없음")

## 남은 위험
Embed 단계나 다음 스터디에서 알아야 할 것
```

## 최종 보고

review.md 경로, 요약 줄(통과/수정/미확인), 수정한 파일 목록. 수정이 있으면 한 줄씩 무엇을 왜 고쳤는지.
