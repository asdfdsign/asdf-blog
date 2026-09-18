# asdf-blog

## 프로젝트 개요

마크다운 파일을 읽어 블로그 웹사이트로 보여주는 두 번째 스터디 프로젝트.
이전 프로젝트(`../my-blog`)는 Node 빌드 스크립트로 HTML을 미리 생성했다. 이번에는 **빌드 단계 없이** 브라우저가 `.md`를 직접 fetch해서 JS 파서로 그 자리에서 렌더링한다.

- 프레임워크·번들러·npm 의존성 없음. **HTML, CSS, JavaScript만** 쓴다.
- 다크 모드 지원. 모바일 우선 반응형.
- 디자인은 깔끔하지만 감각적으로 — 여백과 타이포그래피로 승부하고, 포인트 컬러와 절제된 모션으로 인상을 남긴다.

## 핵심 규칙

- **의존성 금지.** `package.json`, `node_modules`, CDN 라이브러리(marked, highlight.js 등) 모두 쓰지 않는다. 마크다운 파서도 직접 만든다. 그게 이 스터디의 목적이다.
- **빌드 없음.** 저장소에 있는 파일이 곧 배포 파일이다. `dist/` 같은 산출물 폴더를 만들지 않는다.
- **글 목록은 `content/posts.json`이 진실이다.** 브라우저는 디렉터리를 읽을 수 없으므로 글을 추가하면 반드시 이 파일에도 항목을 넣는다. 파일만 넣고 목록에 없으면 존재하지 않는 글이다.
- **로컬 확인은 반드시 HTTP 서버로.** `file://`로 열면 `fetch`가 막혀 아무것도 안 나온다. `python -m http.server 8000` 또는 `npx serve .`로 띄우고 본다.
- 승인 없이 구현을 시작하지 않는다. 막히면 사용자에게 알린다.

## 디렉터리 구조

```
CLAUDE.md              # 이 파일
.claude/settings.json  # 이 프로젝트의 차단 규칙 (npm 설치 등). 목록과 설명은 .claude/permissions.md
.claude/permissions.md # 차단 규칙 전체 목록 — 공통(~/.claude/settings.json)과 프로젝트를 번호로. 규칙을 넣고 빼면 같이 고친다
.nojekyll              # GitHub Pages 의 Jekyll 을 끈다. 없으면 .md 가 404 (배포 절 참고)
.claude/launch.json    # 로컬 서버 설정 (python -m http.server 8000). Browser pane 의 preview_start 가 쓴다
index.html             # 유일한 HTML. 목록/글 화면 모두 여기서 라우팅
css/
  style.css            # 전체 스타일. 색·간격은 전부 CSS 변수로
js/
  app.js               # 진입점. 라우팅, posts.json 로드, 화면 전환
  markdown.js          # 마크다운 → HTML 파서 (직접 구현)
  theme.js             # 다크 모드 토글 + localStorage 저장
content/
  posts.json           # 글 메타데이터 목록 (slug, title, date, tags, summary)
  posts/*.md           # 글 본문. 파일명 = slug
test/
  markdown.test.html   # 파서 테스트. 브라우저에서 열면 표로 결과가 나온다
assets/                # 이미지, 폰트 등 (필요할 때 만든다)
```

## 동작 방식

- **라우팅**: 해시 라우터. `#/` 는 글 목록, `#/tag/{name}` 은 해당 카테고리 글만, `#/post/{slug}` 는 글 상세. 새로고침해도 같은 화면이 나와야 하고, GitHub Pages에서 서버 설정 없이 동작한다.
- **글 로드**: `posts.json` → 목록 렌더 → 클릭 시 `content/posts/{slug}.md` fetch → `markdown.js`로 변환 → 본문 영역에 삽입.
- **프런트매터**: `.md` 상단의 `---` 블록은 파싱해서 본문에서 제외한다. `posts.json`과 겹치는 값은 `posts.json`이 우선.
- **에러 처리**: 없는 slug, fetch 실패는 빈 화면이 아니라 안내 문구 + 목록으로 가는 링크를 보여준다.

## 마크다운 파서 (`js/markdown.js`)

지원 범위를 먼저 정하고 그 안에서 확실하게 동작하게 한다. 한 번에 다 만들지 않는다.

1차: 제목(h1~h6), 문단, 굵게/기울임/취소선, 인라인 코드, 코드 블록(언어 표시), 링크, 이미지, 순서/비순서 목록, 인용, 수평선
2차: 중첩 목록, 표, 체크박스, 각주

- **HTML 이스케이프를 반드시 한다.** 코드 블록·인라인 코드 안의 `<`, `>`, `&`는 그대로 나와야 한다. `innerHTML`에 넣으므로 이스케이프 누락은 곧 XSS다.
- 파서는 순수 함수로 유지한다: 문자열 입력 → 문자열 출력. DOM에 의존하지 않는다.
- 테스트는 `test/markdown.test.html` 하나로 한다. 브라우저에서 열면 케이스별 통과/실패가 표로 나온다. 파서를 고치면 반드시 여기서 확인한다.

## 디자인 원칙

깔끔함은 기본이고, 감각적이라는 인상은 아래 세 가지에서 나온다.

- **타이포그래피가 주인공.** 본문은 가독성 좋은 산세리프(시스템 폰트 스택, 한글은 `Pretendard` 계열 우선), 제목은 크고 자간을 좁혀 대비를 준다. 본문 최대 폭 `65ch`, 줄간격 `1.7~1.8`.
- **색은 최소로.** 배경·본문·보조 텍스트·테두리·포인트 컬러 하나. 포인트 컬러는 링크, 태그, 활성 상태에만 쓴다. 회색을 남발하지 않는다.
- **모션은 짧고 목적이 있게.** 화면 전환 페이드(150~200ms), 호버 시 미세한 이동. `prefers-reduced-motion`이면 전부 끈다.

### 다크 모드

- 모든 색은 `:root`의 CSS 변수로만 정의한다. 하드코딩된 색상값이 컴포넌트 CSS에 있으면 안 된다.
- 기본값은 시스템 설정(`prefers-color-scheme`)을 따르고, 사용자가 토글하면 `localStorage`에 저장해 우선한다.
- 토글은 `<html data-theme="dark|light">` 속성으로 전환한다.
- **깜빡임 방지**: `theme.js`는 `<head>`에서 동기로 실행해 첫 페인트 전에 `data-theme`를 붙인다. `defer`나 `body` 끝에 두면 라이트로 켜졌다가 어두워지는 플래시가 생긴다.
- 다크 모드는 순수 검정(`#000`)이 아니라 살짝 톤이 있는 어두운 색을 쓰고, 텍스트도 순백이 아니라 살짝 낮춘다. 코드 블록 배경은 본문 배경과 구분되어야 한다.

### 모바일

- 모바일 우선으로 작성하고 `min-width` 미디어 쿼리로 넓힌다. 기준점은 `640px`, `960px`.
- 터치 타겟은 최소 44×44px. 링크·버튼 간격을 좁히지 않는다.
- 가로 스크롤은 절대 생기면 안 된다. 코드 블록과 표는 자체 `overflow-x: auto`로 감싼다.
- 이미지는 `max-width: 100%; height: auto`.
- 폰트 크기는 `rem` 기준, 본문 최소 `16px`. iOS 자동 확대를 막으려고 `user-scalable=no`를 쓰지 않는다.

## 검증 체크리스트

기능을 추가하거나 스타일을 바꾸면 아래를 브라우저에서 직접 확인한다. 코드만 보고 넘어가지 않는다.

- [ ] 목록 → 글 → 뒤로가기 → 목록이 자연스럽게 오간다
- [ ] 글 URL을 새 탭에 붙여넣어도 그 글이 바로 뜬다
- [ ] 라이트/다크 양쪽에서 대비 4.5:1 이상 (링크·보조 텍스트·코드 블록 포함)
- [ ] 새로고침 시 테마 플래시 없음
- [ ] 375px 폭에서 가로 스크롤 없음, 긴 코드 블록도 잘림 없이 스크롤됨
- [ ] `test/markdown.test.html` 전부 통과
- [ ] 콘솔에 에러 없음

## 글 작성

`content/posts/{slug}.md`를 만들고 `content/posts.json`에 항목을 추가한다. slug는 영문 소문자·숫자·하이픈만.

```json
{
  "slug": "hello-world",
  "title": "첫 글",
  "date": "2026-09-15",
  "tags": ["study"],
  "summary": "목록에 보일 한 줄 요약"
}
```

시리즈 글이면 `"series": "Daystudy", "part": 2` 를 추가한다. 카드와 글 상단에 `Daystudy #2` 라벨이 붙고, 탭 제목이 `Daystudy — {title}` 이 된다.

목록은 `date` 내림차순. `posts.json`이 깨진 JSON이면 사이트 전체가 안 뜨므로 수정 후 반드시 브라우저에서 확인한다.

### 카테고리 (tags)

`tags`가 곧 카테고리다. 목록 위 카테고리 바와 `#/tag/{name}` 필터가 `posts.json`의 tags에서 자동으로 만들어지므로 **새 이름을 함부로 늘리지 않는다.** 글 하나에 1~2개.

| 태그 | 쓰는 곳 |
| --- | --- |
| `study` | 학습 기록. 배운 것을 정리한 글 대부분 |
| `web` | HTML·CSS·JS 기초 개념 |
| `javascript` | JS 동작·코드가 중심인 글 |
| `markdown` | 마크다운 문법·파서 관련 |
| `essay` | 단상·생각 정리. 옵시디언 `블로그/` 폴더에서 가져온 글 대부분 |
| `git` | git·GitHub·배포(Pages) 관련 |

새 카테고리가 정말 필요하면 이 표에 먼저 추가한다. 영문 소문자만 쓴다.

### Daystudy 시리즈

매일의 학습 기록. `series: Daystudy`, `part: N` (이전 최대값 +1). slug 는 `daystudy-{N}` (1편만 예외로 `daystudy`). 제목은 그날 배운 것의 핵심 한 가지 — `HTML·CSS·JS의 역할` 처럼 명사구로.

- **재료는 그날의 커밋뿐이다.** 마지막 Daystudy 글 이후 커밋에서 실제로 바뀐 것을 읽고, 거기서 배울 점을 초보자 눈높이로 설명한다. 커밋이 없으면 글을 쓰지 않는다. 지어내지 않는다.
- 형식은 1편(`content/posts/daystudy.md`)을 따른다: 도입 한 문단 → `##` 주제 2~4개 (비유 + 실제 코드 조각) → `## 오늘의 한 줄 정리` 불릿.
- 파서가 지원하는 문법만 쓴다 (표·중첩 목록 금지).
- 태그는 `study` + 내용에 맞는 하나.
- 클라우드 루틴 `asdf-blog Daystudy 매일 글쓰기`(`trig_019LU68vECuzPkPwcxFHLN7Y`)가 매일 19:00 KST(`0 10 * * *` UTC)에 PR 로 올린다. 사람이 읽고 병합해야 블로그에 반영된다. 글감이 없는 날도 PushNotification 은 온다.
- 루틴이 막히면 아래 「클라우드 루틴 체크리스트」 순서로 본다. 자세한 사연은 Daystudy #3.

### 클라우드 루틴 체크리스트

`/schedule` 로 만드는 루틴은 Anthropic 클라우드에서 매번 새 컴퓨터로 시작한다. 내 PC 를 못 보고, 재료는 GitHub 저장소뿐이다. 두 블로그에서 같은 자리에 막혔으니 순서대로 확인한다.

1. **저장소가 GitHub 에 있고 공개인가.** 비공개면 루틴 생성부터 403 (`You don't have access to a repository this routine uses`). 공개로 바꾸면 생성은 통과한다.
2. **클로드 계정에 GitHub 이 연결됐는가.** 생성 시 401 (`Connect your GitHub account`)이면 여기. claude.ai/code **웹**(데스크톱 앱 아님)에서 `+ 레포 선택...` 을 눌러 연결한다. 안내 링크는 앱이 가로채니 크롬 주소창에 직접 붙여넣는다.
3. **Claude GitHub 앱이 이 저장소에 설치됐는가.** 실행은 되는데 푸시·PR 에서 403 (`Resource not accessible by integration`)이면 여기. Authorize(계정)와 Install(저장소)은 다르다. 공개 저장소는 읽기가 공짜라 쓰기 실패가 늦게 드러난다. → `https://github.com/settings/installations` → Claude → Configure → 저장소 추가. 없으면 `https://github.com/apps/claude/installations/new`.
4. **만들자마자 커넥터를 뗀다.** Gmail·Drive·Calendar·Notion 등이 자동으로 붙는다. `RemoteTrigger update` 에 `clear_mcp_connections: true`.
5. **어떤 경우에도 알림이 오는가.** 썼다 / 글감 없다 / 이미 있다 / 실패 — 네 경우 모두 PushNotification. 조용히 끝나는 루틴은 죽은 줄도 모른다.
6. 확인은 `RemoteTrigger run` 으로 한 번 돌려 `get_run_log` 를 본다. 글감이 없으면 (B) 로 끝나므로 쓰기 권한은 검증되지 않는다 — 쓰기까지 보려면 마지막 Daystudy 이후 커밋이 하나 있어야 한다.

### 옵시디언에서 가져오기

원본은 `D:\Documents\Obsidian Vault\블로그\*.md`. 프런트매터의 `생성` 이 발행 여부다 — `생성: false` 인 글만 가져온다.

1. 본문은 **고치지 않고 그대로** 옮긴다 (작성자의 글이다). 프런트매터와 `#정리중` 태그 줄만 떼고, 빈 줄 3개 이상으로 나뉜 덩어리는 `---` 로 구분한다.
2. `content/posts/{slug}.md` 에 title·date·tags·`source`(원본 경로) 프런트매터를 붙여 저장하고 `posts.json` 에 항목을 넣는다.
3. 브라우저에서 확인한 뒤 원본의 `생성: false` 를 `생성: true` 로 바꾼다. 확인 전에 바꾸지 않는다.

볼트 안의 글은 고치지 않는다. 플래그 한 단어 바꾸는 것은 공통 차단 규칙에 걸리므로 Bash 로 한다.

## 배포

GitHub Pages(루트 배포)를 전제로 한다. 모든 경로는 `./css/style.css`처럼 **상대 경로**로 쓴다. `/css/style.css` 같은 절대 경로는 `username.github.io/asdf-blog/` 아래에서 깨진다.
배포 주소: https://asdfdsign.github.io/asdf-blog/ (저장소 `asdfdsign/asdf-blog`, main 브랜치 루트, 공개).

- **루트의 `.nojekyll` 을 지우지 않는다.** GitHub Pages 는 기본으로 Jekyll 을 돌리는데, Jekyll 은 프런트매터가 있는 `.md` 를 전부 `.html` 로 바꿔 버리고 원본 `.md` 를 내주지 않는다. 그러면 목록은 뜨는데 글마다 404 가 난다. `.nojekyll` 이 그걸 끈다.
- 배포 확인은 브라우저 강력 새로고침(`Ctrl+Shift+R`)으로 한다 — Pages 캐시가 10분이라 `curl`과 화면이 다를 수 있다.
