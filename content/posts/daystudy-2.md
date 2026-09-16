---
series: Daystudy
part: 2
title: git 프로젝트와 블로그 주소
date: 2026-09-16
tags: [study, git]
---

오늘은 블로그를 GitHub에 올리고 실제 주소로 배포했습니다. 그 과정에서 "이 폴더가 git 프로젝트가 된 게 정확히 언제지?", "블로그 주소는 누가 정한 거지?" 같은 질문이 생겨서 하나씩 짚어 봤습니다.

## git 프로젝트란 무엇인가

처음엔 "git 프로젝트 = GitHub에 올라간 것"이라고 생각했는데, 아니었습니다. 둘은 다른 것입니다.

폴더를 git 프로젝트로 만드는 명령은 이것 하나입니다.

```bash
git init -b main
```

이걸 실행하면 폴더 안에 `.git`이라는 숨김 폴더가 생깁니다. 그 순간부터 git이 파일 변경을 추적하기 시작합니다. **인터넷도, GitHub 계정도 필요 없습니다.** 내 PC 안에서만 존재하는 저장소입니다.

그다음 스냅샷을 찍는 게 커밋입니다.

```bash
git add -A
git commit -m "첫 커밋: 빌드 없는 마크다운 블로그"
```

여기까지도 전부 로컬입니다. 커밋, 브랜치, 되돌리기 — git의 핵심 기능은 GitHub 없이 다 됩니다.

GitHub가 등장하는 건 그다음입니다.

```bash
gh repo create asdfdsign/asdf-blog --private --source=. --remote=origin --push
```

GitHub에 빈 저장소를 만들고, 내 폴더를 그 저장소와 연결하고(`origin`이라는 이름으로), 로컬 커밋을 올렸습니다. 이때부터 내 PC와 GitHub에 **같은 저장소의 복사본이 둘** 존재합니다.

정리하면 이렇습니다.

- `git init` — 폴더가 git 프로젝트가 된다. 내 PC에만 있다.
- `git commit` — 스냅샷을 찍는다. 아직 내 PC에만 있다.
- `git push` — GitHub에 있는 복사본에 반영한다.

> git은 도구고, GitHub는 그 도구로 만든 저장소를 다른 곳과 공유하는 장소다.

클라우드 에이전트가 "저장소가 필요하다"고 한 것도 git이 아니라 **GitHub에 있는 복사본**이 필요하다는 뜻이었습니다. 에이전트는 내 PC를 못 보니까요.

## 블로그 주소는 어떻게 정해지나

배포하고 나니 주소가 `https://asdfdsign.github.io/asdf-blog/`였습니다. 제가 정한 게 아닙니다. GitHub Pages가 **계정 이름과 저장소 이름으로 자동으로** 만든 것입니다.

규칙은 하나입니다.

```
https://{계정}.github.io/{저장소}/
```

- 계정 `asdfdsign`, 저장소 `asdf-blog` → `asdfdsign.github.io/asdf-blog/`
- 저장소 이름을 `blog`로 지었다면 → `asdfdsign.github.io/blog/`

예외가 하나 있습니다. 저장소 이름을 정확히 `{계정}.github.io`로 지으면 하위 경로 없이 루트 주소가 됩니다.

- 저장소 `asdfdsign.github.io` → `https://asdfdsign.github.io/`

이건 계정당 하나만 됩니다. 나머지 저장소는 전부 하위 경로가 붙습니다.

여기서 중요한 결과가 하나 나옵니다. **저장소 이름을 바꾸면 주소도 바뀝니다.** 그리고 우리 사이트는 루트가 아니라 `/asdf-blog/` 밑에서 돌아갑니다.

이게 CLAUDE.md에 "경로는 전부 상대 경로로"라고 적어 둔 이유입니다.

```html
<!-- 이렇게 쓰면 asdfdsign.github.io/css/style.css 를 찾는다 → 없음 → 깨짐 -->
<link rel="stylesheet" href="/css/style.css">

<!-- 이렇게 써야 asdfdsign.github.io/asdf-blog/css/style.css 를 찾는다 -->
<link rel="stylesheet" href="./css/style.css">
```

`/`로 시작하는 절대 경로는 "사이트 루트부터"라는 뜻인데, 우리 사이트의 루트는 `asdfdsign.github.io`가 아니라 그 밑의 `asdf-blog/`입니다. `./`로 시작하는 상대 경로는 "지금 이 파일이 있는 곳부터"라서 어디에 올려도 따라갑니다.

## 주소를 GitHub에서 확인하는 방법

규칙을 외우지 않아도 확인할 수 있습니다.

**웹에서**: 저장소 페이지 → **Settings** → 왼쪽 메뉴 **Pages**. 맨 위에 "Your site is live at …" 라고 주소가 나옵니다. 어느 브랜치에서 배포하는지도 여기서 정합니다.

**터미널에서**: GitHub CLI(`gh`)가 있으면 한 줄입니다.

```bash
gh api repos/asdfdsign/asdf-blog/pages --jq .html_url
```

배포를 켤 때 GitHub가 돌려준 응답에도 같은 값이 들어 있었습니다. 이 블로그의 주소는 CLAUDE.md 배포 절에도 적어 뒀습니다.

## 오늘의 한 줄 정리

- `git init` 하는 순간 git 프로젝트다. GitHub는 그다음 이야기.
- git은 도구, GitHub는 저장소를 공유하는 장소. 내 PC와 GitHub에 복사본이 둘 있다.
- Pages 주소는 `{계정}.github.io/{저장소}/`. 저장소 이름이 곧 주소다.
- 하위 경로에서 돌아가므로 경로는 `./`로 시작하는 상대 경로만 쓴다.
- 주소가 궁금하면 Settings → Pages, 또는 `gh api …/pages`.
