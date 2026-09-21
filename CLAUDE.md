# asdf-blog

## 프로젝트 개요
마크다운 기반 블로그 + 미니 웹앱 포트폴리오. HTML, CSS, JavaScript만 사용.

## 작업 사이클
사용자가 웹앱 주제를 요청하면 다음 순서로 진행한다.
1. Plan — 서브에이전트를 만들어 계획을 작성한다. 어떤 웹앱을 만들지, 파일 구조는 어떻게 할지 정리한다. 작성한 계획은 spec.md로 저장하며, 사용자 승인을 받는다.
2. Build — 서브에이전트를 만들어 구현한다. 웹앱은 /apps/{앱이름}/ 폴더에 독립적으로 만든다. 블로그의 다른 파일을 건드리지 않는다.
3. Review — 별도 서브에이전트를 만들어 검증한다. 브라우저에서 정상 동작하는지, 코드에 문제가 없는지 확인하고 review.md를 작성한다. 문제가 있으면 수정한다.
4. Embed — 블로그 메인 페이지(index.html)에 웹앱 카드를 추가한다. 카드에는 제목, 설명, 미리보기 이미지 또는 iframe을 넣는다. 깃 커밋한다.

## 서브에이전트 규칙
- 서브에이전트에게 작업을 넘길 때 전용 지침 파일(.md)을 만들어 전달한다.
- Build 서브에이전트와 Review 서브에이전트는 반드시 분리한다.
- 서브에이전트는 지침 파일에 명시된 범위만 수정한다.

## 웹앱 규칙
- 모든 웹앱은 /apps/{앱이름}/ 폴더 안에 자체 완결된다.
- 외부 라이브러리 사용을 최소화한다. CDN은 허용한다.
- 모바일에서도 사용할 수 있어야 한다.

## 규칙
- 승인 없이 구현을 시작하지 않는다.
- 막히면 사용자에게 알린다.

## 블로그 유지 규칙
블로그 본체(`index.html`, `css/`, `js/`, `content/`)에는 이전 스터디의 규칙이 그대로 적용된다. 위 「웹앱 규칙」은 `/apps/` 안에서만 유효하다.

- **블로그 본체는 의존성·CDN 금지.** 마크다운 파서(`js/markdown.js`)는 직접 만든 것이고, 그게 스터디의 결과물이다. 라이브러리로 갈아치우지 않는다. 빌드 단계도 없다 — 저장소 파일이 곧 배포 파일.
- **글 목록은 `content/posts.json`이 진실이다.** 브라우저는 폴더를 읽을 수 없다. `content/posts/{slug}.md`를 만들면 반드시 `posts.json`에도 항목(`slug` `category` `title` `date` `tags` `summary`)을 넣는다. 목록에 없으면 존재하지 않는 글이다. 깨진 JSON이면 사이트 전체가 안 뜬다.
- **로컬 확인은 HTTP 서버로.** `file://`로 열면 `fetch`가 막혀 아무것도 안 나온다. `python -m http.server 8000`(`.claude/launch.json`에 설정됨)으로 띄우고 본다.
- **루트의 `.nojekyll`을 지우지 않는다.** GitHub Pages는 기본으로 Jekyll을 돌려 `.md`를 `.html`로 바꿔 버린다. 그러면 목록은 뜨는데 글마다 404. 빈 파일이지만 이름이 곧 설정이다.
- **경로는 전부 상대 경로**(`./css/style.css`). 절대 경로(`/css/...`)는 `asdfdsign.github.io/asdf-blog/` 아래에서 깨진다. `/apps/` 안의 웹앱도 같다.
- **배포:** https://asdfdsign.github.io/asdf-blog/ (저장소 `asdfdsign/asdf-blog`, main 루트, 공개). 확인은 `Ctrl+Shift+R` 강력 새로고침 — Pages 캐시가 10분이라 고쳐도 안 바뀐 것처럼 보일 수 있다.
- **Daystudy:** 학습 기록은 전부 여기. `category: daystudy`, `part: N`(이전 최대값 +1 — 카드와 글 상단에 `Daystudy #N` 라벨, 탭 제목이 `Daystudy #N — {title}`), 주제 태그 하나. slug 는 영문 소문자·숫자·하이픈으로 자유롭게. 매일의 학습 기록 글은 재료가 마지막 Daystudy 이후의 커밋뿐이다 — 지어내지 않는다. 형식은 `content/posts/daystudy.md`를 따른다. 클라우드 루틴 `asdf-blog Daystudy 매일 글쓰기`(`trig_019LU68vECuzPkPwcxFHLN7Y`)가 매일 19:00 KST에 PR로 올리고, 사람이 병합해야 반영된다. 루틴이 막히면 순서대로 확인: ① 저장소가 공개인가 → ② 클로드 계정에 GitHub이 연결됐나 (claude.ai/code 웹에서) → ③ Claude GitHub 앱이 이 저장소에 설치됐나 (`github.com/settings/installations`) → ④ 자동으로 붙은 커넥터(Gmail·Drive 등)를 뗐나 → ⑤ 어떤 경우에도 PushNotification이 오나. 자세한 사연은 Daystudy #6(`daystudy-3`).
- **옵시디언에서 가져오기:** 원본은 `D:\Documents\Obsidian Vault\블로그\*.md`, 프런트매터 `생성: false`인 글만. 본문은 고치지 않고 그대로 옮기고, 프런트매터와 `#정리중` 줄만 뗀다. `posts.json`에 넣고 **브라우저에서 확인한 뒤에** 원본의 `생성: false`를 `true`로 바꾼다. 볼트 안의 글은 그 한 단어 외에 절대 손대지 않는다.
- **카테고리와 주제는 두 층이다.** `posts.json`의 `category`가 큰 묶음(`daystudy` | `essay`)이고 카테고리 바에 나온다. `tags`는 Daystudy 안의 하위 카테고리이며 Daystudy를 클릭하면 카테고리 바 아래 주제 바로 나온다. 목록은 어디서나 최신순 한 줄이고 카테고리·주제는 거르기만 한다 — `git`(git · 배포) `web`(웹 기초) `claude-code`(클로드 코드) `javascript` `markdown`. 표시 이름과 순서는 `js/app.js`의 `CATEGORIES`/`TOPICS`에 있고, 새 주제를 추가하면 거기에도 넣는다. 글 하나에 주제 태그는 하나. Essay 에는 태그를 두지 않는다.
