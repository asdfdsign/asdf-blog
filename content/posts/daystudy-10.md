---
series: Daystudy
part: 10
title: 데이터와 화면을 가르는 이유
date: 2026-11-02
tags: [study, javascript]
---

웹앱을 하나둘 늘리다 보니 블로그 메인 화면이 이상해지기 시작했습니다. `index.html` 안에 포모도로 카드, 스도쿠 카드를 하나씩 손으로 적어 넣고 있었거든요. 앱을 하나 더 만들면 또 그 파일을 열어 똑같은 모양의 블록을 복사해 붙여야 했습니다. 이번에 그 방식을 걷어내고 글 목록과 같은 틀로 바꿨습니다.

## 전에는 화면 코드에 내용이 박혀 있었다

처음에는 `index.html` 안에 앱마다 카드 하나, iframe 하나를 직접 썼습니다. 미리보기가 바로 보인다는 장점은 있었지만, 글은 `content/posts.json`이라는 데이터 파일을 읽어서 자동으로 카드를 만드는데 앱은 전혀 다른 방식으로 움직이고 있었습니다. 같은 블로그 안에 두 가지 규칙이 있는 셈이었습니다.

## 글 목록이 하던 일을 그대로 가져왔다

글 목록은 이미 "데이터 파일을 읽고 → 템플릿에 채워서 → 화면에 붙인다"는 흐름으로 되어 있었습니다. 그래서 앱도 `content/apps.json`이라는 파일 하나를 만들어 같은 흐름을 타게 했습니다.

```json
{
  "slug": "pomodoro",
  "title": "포모도로 타이머",
  "date": "2026-09-22",
  "summary": "25분 집중, 5분 휴식. 줄어드는 원을 보며 한 번에 하나만."
}
```

`js/app.js`에는 이 파일을 읽는 함수를 글 목록 읽는 함수 옆에 그대로 나란히 추가했습니다.

```js
async function loadApps() {
  if (appsCache) return appsCache;
  const res = await fetch('./content/apps.json');
  appsCache = await res.json();
  return appsCache;
}
```

카드를 만드는 쪽도 마찬가지입니다. `index.html`에는 빈 틀(`<template>`)만 하나 있고, JS가 그 틀을 복제해서 제목·날짜·요약을 채워 넣습니다.

```html
<template id="tpl-app-card">
  <li class="post-card">
    <a class="post-card__link" href="#">
      <time class="post-card__date"></time>
      <h2 class="post-card__title"></h2>
      <p class="post-card__summary"></p>
    </a>
  </li>
</template>
```

틀은 코드에 있고, 내용은 데이터에 있습니다. 이렇게 나눠 두면 앱을 새로 추가할 때 `index.html`을 열 일이 없어집니다. `apps.json`에 한 줄 추가하는 것으로 끝입니다.

## 카테고리 바에도 같은 수를 센다

앱 목록은 "웹앱"이라는 카테고리 하나로 들어갔습니다. 카테고리 바가 몇 개씩 보여주는 숫자도 글과 같은 방식으로 셉니다.

```js
const counts = new Map(Object.keys(CATEGORIES).map(c => [c, 0]));
for (const p of posts) if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
counts.set('apps', apps.length);
```

글은 `category` 값을 세어 올리고, 앱은 `apps.json` 배열의 길이를 그 자리에 끼워 넣습니다. 두 가지가 서로 다른 데이터인데도 카테고리 바 입장에서는 "묶음별 개수"라는 같은 모양이라 자연스럽게 섞입니다.

## 오늘의 한 줄 정리

- 화면에 보이는 모양(틀)과 그 안에 들어갈 내용(데이터)을 나누면, 내용을 바꿀 때 코드를 건드리지 않아도 됩니다.
- `posts.json`이 글의 진실이듯 `apps.json`이 앱의 진실입니다 — 폴더만 만들고 여기 안 적으면 블로그에는 없는 앱입니다.
- 같은 모양(개수 세기, 카드 만들기)이면 서로 다른 데이터라도 같은 함수를 나눠 쓸 수 있습니다.

## 확인이 필요한 부분

- 이번 Daystudy는 커밋이 쌓인 지 오래된 뒤에 처음 돌았습니다. `apps.json` 전환 외에도 카테고리를 Daystudy·Essay 두 층으로 정리한 것, 스도쿠·포모도로 두 앱을 만든 것, 웹앱 색상·사용법 규칙을 추가한 것, 코덱스 리뷰로 블로그 본체를 처음 점검한 것까지 다루지 못한 글감이 남아 있습니다. 다음 Daystudy들에서 나눠 다루면 좋을 것 같습니다.
- `apps.json` 전환 이후에도 `[data-embed]` 임베드 모드 코드는 그대로 남아 있습니다(지금은 카드에 iframe을 안 쓰지만 앱 폴더가 자체 완결이라 남겨 둔 것). 이 설명이 맞는지, 앞으로도 필요한 코드인지는 다시 봐야 합니다.
