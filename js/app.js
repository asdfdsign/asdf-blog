// 진입점. 해시 라우터 + 화면 렌더링.
//   #/            → 글 목록 (전체)
//   #/cat/{name}  → 카테고리 (daystudy | essay | apps — 웹앱 목록)
//   #/tag/{name}  → Daystudy 안의 주제 하나만
//   #/post/{slug} → 글 상세
//   그 외          → 에러 화면
import { render, parseFrontmatter } from './markdown.js';

const SITE_TITLE = 'asdf';
const app = document.getElementById('app');

// 카테고리(큰 묶음)와 주제(Daystudy 안의 하위 카테고리). 표시 이름과 순서는 여기서 정한다.
// posts.json 의 category / tags 값이 키다. 여기 없는 값은 키 그대로 보여준다.
// Daystudy 글은 전부 part 번호를 갖고 "Daystudy #N" 라벨이 붙는다.
const CATEGORIES = { daystudy: 'Daystudy', essay: 'Essay', apps: '웹앱' };
const APPS = 'apps'; // 글이 아니라 content/apps.json 의 웹앱 목록을 보여주는 카테고리
const TOPICS = {
  git: 'git · 배포',
  web: '웹 기초',
  'claude-code': '클로드 코드',
  javascript: 'JavaScript',
  markdown: '마크다운',
};
const catLabel = c => CATEGORIES[c] || c;
const topicLabel = t => TOPICS[t] || t;

// 경로는 전부 상대 경로 — GitHub Pages 하위 경로(/asdf-blog/)에서도 깨지지 않게
const INDEX_URL = './content/posts.json';
const APPS_URL = './content/apps.json';
const postUrl = slug => `./content/posts/${encodeURIComponent(slug)}.md`;
const appUrl = slug => `./apps/${encodeURIComponent(slug)}/`;
// 카드 링크도 라우터와 같은 규칙으로 만든다. 한쪽만 인코딩이 빠지면 slug 에 / 나 % 가
// 들어간 날 링크가 라우터 정규식에 안 맞거나 디코딩에서 터진다.
const postHash = slug => `#/post/${encodeURIComponent(slug)}`;

// slug 는 주소이자 파일명이다. 영문 소문자·숫자·하이픈만 — CLAUDE.md 의 Daystudy 규칙과 같다.
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// 해시 조각 디코딩. 잘못 인코딩된 주소(#/tag/%)는 URIError 를 던지므로 null 로 받는다 —
// 그대로 두면 "URI malformed" 같은 내부 문장이 사용자 화면에 뜬다.
function decodeSegment(raw) {
  try { return decodeURIComponent(raw); } catch { return null; }
}

// 최신순 정렬. 같은 날짜면 Daystudy 번호가 큰 쪽이 먼저
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.part || 0) - (a.part || 0));

// ---------------------------------------------------------------- 목록 적재

// JSON 이 파싱된다는 것과 내용이 멀쩡하다는 것은 다른 얘기다. 매일 19:00 Daystudy 클라우드
// 루틴이 posts.json 을 PR 로 고치므로 필드가 빈 항목이 들어올 경로가 실제로 있다.
// 그때 사용자가 보는 것이 `posts.sort is not a function` 이어서는 안 된다.
const filled = v => typeof v === 'string' && v.trim() !== '';

function checkArray(value, what) {
  if (!Array.isArray(value)) throw new Error(`${what} 형식이 올바르지 않아요. 목록(배열)이어야 해요.`);
  return value;
}

function checkPosts(value) {
  for (const p of checkArray(value, '글 목록')) {
    if (!p || !filled(p.slug) || !filled(p.title) || !filled(p.date) || !filled(p.category)) {
      throw new Error('글 목록에 필수 정보(slug · title · date · category)가 빠진 항목이 있어요.');
    }
  }
  return value;
}

function checkApps(value) {
  for (const a of checkArray(value, '웹앱 목록')) {
    if (!a || !filled(a.slug) || !filled(a.title) || !filled(a.date)) {
      throw new Error('웹앱 목록에 필수 정보(slug · title · date)가 빠진 항목이 있어요.');
    }
  }
  return value;
}

// res.json() 이 던지는 SyntaxError 는 브라우저마다 문장이 다르고 사용자에게 뜻이 없다.
async function readJson(res, what) {
  try { return await res.json(); } catch { throw new Error(`${what} 파일이 깨졌어요. JSON 형식을 확인해 주세요.`); }
}

let indexCache = null;
let indexPending = null;
let appsCache = null;
let appsPending = null;

// 적재 중인 약속도 같이 들고 있는다. 완료된 배열만 캐시하면 첫 적재가 끝나기 전에 들어온
// 호출마다 fetch 가 새로 뜬다. 실패하면 약속을 비워 다음 시도가 다시 받게 한다.
function loadIndex() {
  if (indexCache) return Promise.resolve(indexCache);
  if (indexPending) return indexPending;
  indexPending = (async () => {
    const res = await fetch(INDEX_URL);
    if (!res.ok) throw new Error(`글 목록을 불러오지 못했어요 (${res.status}).`);
    const posts = checkPosts(await readJson(res, '글 목록'));
    posts.sort(byDateDesc);
    indexCache = posts;
    return posts;
  })().finally(() => { indexPending = null; });
  return indexPending;
}

// 웹앱 목록. 순서는 apps.json 에 적힌 대로(최신이 위)
function loadApps() {
  if (appsCache) return Promise.resolve(appsCache);
  if (appsPending) return appsPending;
  appsPending = (async () => {
    const res = await fetch(APPS_URL);
    if (!res.ok) throw new Error(`웹앱 목록을 불러오지 못했어요 (${res.status}).`);
    appsCache = checkApps(await readJson(res, '웹앱 목록'));
    return appsCache;
  })().finally(() => { appsPending = null; });
  return appsPending;
}

// ---------------------------------------------------------------- 조각

function tpl(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 태그는 주제 링크다. 카드에서는 제목 링크 밖에 두어 <a> 가 겹치지 않게 한다.
function fillTags(ul, tags) {
  ul.replaceChildren();
  for (const t of tags || []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#/tag/${encodeURIComponent(t)}`;
    a.textContent = topicLabel(t);
    li.append(a);
    ul.append(li);
  }
  if (!ul.children.length) ul.remove();
}

// 카테고리 바(헤더): 전체(글 + 웹앱) + 카테고리별 수. CATEGORIES 순서, 거기 없는 것은 뒤에. 현재 선택은 aria-current.
function fillCats(nav, posts, apps, current) {
  const counts = new Map(Object.keys(CATEGORIES).map(c => [c, 0]));
  for (const p of posts) if (p.category) counts.set(p.category, (counts.get(p.category) || 0) + 1);
  counts.set(APPS, apps.length);
  const cats = [['전체', null, posts.length + apps.length], ...[...counts].filter(([, n]) => n > 0).map(([c, n]) => [catLabel(c), c, n])];

  nav.replaceChildren();
  for (const [label, cat, n] of cats) {
    const a = document.createElement('a');
    a.className = 'cat';
    a.href = cat ? `#/cat/${encodeURIComponent(cat)}` : '#/';
    if (cat === current) a.setAttribute('aria-current', 'true');
    a.append(label, Object.assign(document.createElement('span'), { className: 'cat__count', textContent: n }));
    nav.append(a);
  }
}

// 주제 바: Daystudy 를 보고 있을 때 카테고리 바 아래에. 전체 + 주제별 글 수, TOPICS 순.
function fillTopics(nav, posts, current) {
  const counts = new Map(Object.keys(TOPICS).map(t => [t, 0]));
  for (const p of posts) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  const topics = [['전체', null, posts.length], ...[...counts].filter(([, n]) => n > 0).map(([t, n]) => [topicLabel(t), t, n])];

  nav.replaceChildren();
  for (const [label, topic, n] of topics) {
    const a = document.createElement('a');
    a.className = 'cat cat--sub';
    a.href = topic ? `#/tag/${encodeURIComponent(topic)}` : '#/cat/daystudy';
    if (topic === current) a.setAttribute('aria-current', 'true');
    a.append(label, Object.assign(document.createElement('span'), { className: 'cat__count', textContent: n }));
    nav.append(a);
  }
  nav.hidden = false;
}

// Daystudy 글이면 "Daystudy #4" 라벨. 다른 카테고리는 라벨 없음.
const kickerOf = post => (post.category === 'daystudy' && post.part ? `${catLabel(post.category)} #${post.part}` : null);

function fillKicker(el, post) {
  const text = kickerOf(post);
  if (!text) return;
  el.textContent = text;
  el.hidden = false;
}

// ---------------------------------------------------------------- 라우팅 세대

// 해시가 빨리 바뀌면 먼저 시작한 적재가 나중에 끝날 수 있다. 그때 늦게 온 쪽이 화면을
// 덮으면 주소와 내용이 어긋난다 — 세대 번호를 들고 다니며 현재 것만 화면을 건드린다.
let routeVersion = 0;
const stale = version => version !== routeVersion;

function show(node, title, version) {
  if (stale(version)) return;
  // 히어로는 목록 화면에서만
  document.getElementById('hero').hidden = !node.classList.contains('view--list');
  app.replaceChildren(node);
  document.title = title ? `${title} — ${SITE_TITLE}` : SITE_TITLE;
  window.scrollTo({ top: 0, behavior: 'instant' });
  // 화면을 통째로 바꿨으니 포커스도 새 화면으로 옮긴다. 안 그러면 키보드로 카드를 눌러
  // 들어간 사람의 포커스가 사라진 요소에 남고, 스크린 리더는 전환을 알리지 못한다.
  // 대상은 화면 제목으로 한정한다 — `h1, h2` 로 찾으면 목록에서 첫 카드 제목을 집어
  // 맨 위가 아니라 글 하나에 포커스가 얹힌다. 목록은 제목이 없으니 화면 자체로.
  const target = node.querySelector('.post-header__title, .error__title') || node;
  target.tabIndex = -1;
  target.focus({ preventScroll: true });
}

function showLoading() {
  const p = document.createElement('p');
  p.className = 'loading';
  p.textContent = '불러오는 중…';
  app.replaceChildren(p);
}

// ---------------------------------------------------------------- 화면

function makeCard(post) {
  const card = tpl('tpl-card');
  card.querySelector('.post-card__link').href = postHash(post.slug);
  const time = card.querySelector('.post-card__date');
  time.dateTime = post.date;
  time.textContent = formatDate(post.date);
  fillKicker(card.querySelector('.post-card__kicker'), post);
  card.querySelector('.post-card__title').textContent = post.title;
  card.querySelector('.post-card__summary').textContent = post.summary || '';
  fillTags(card.querySelector('.tags'), post.tags);
  return card;
}

function makeAppCard(app) {
  const card = tpl('tpl-app-card');
  card.querySelector('.post-card__link').href = appUrl(app.slug);
  const time = card.querySelector('.post-card__date');
  time.dateTime = app.date;
  time.textContent = formatDate(app.date);
  card.querySelector('.post-card__title').textContent = app.title;
  card.querySelector('.post-card__summary').textContent = app.summary || '';
  return card;
}

// 헤더의 카테고리 바를 현재 화면에 맞춰 다시 채운다. 어느 화면에서든 보인다.
async function syncNav(current, version) {
  const [posts, apps] = await Promise.all([loadIndex(), loadApps()]);
  if (stale(version)) return;
  fillCats(document.querySelector('.site-nav .cats'), posts, apps, current);
}

// 목록은 언제나 최신순 한 줄. 전체는 글과 웹앱을 섞고, 카테고리·주제는 거르기만 한다.
async function renderList({ category = null, tag = null, version } = {}) {
  const [posts, apps] = await Promise.all([loadIndex(), loadApps()]);
  if (stale(version)) return;

  // 주제는 Daystudy 안의 것이므로, 주제로 걸러도 카테고리 바에서는 Daystudy 가 선택된 상태
  if (tag) category = 'daystudy';

  // 없는 카테고리·주제는 빈 목록이 아니라 오류로 알린다. 기준은 「표시 이름 표에 있나」가
  // 아니라 「데이터에 실제로 쓰이나」다 — CATEGORIES 에 없는 값도 posts.json 에 있으면
  // 보여주는 것이 의도이므로(위 주석), 표가 아니라 글을 보고 판단한다.
  if (category && category !== APPS && !posts.some(p => p.category === category)) {
    await syncNav(null, version);
    return renderError('그런 카테고리는 없어요.', version);
  }
  if (tag && !posts.some(p => (p.tags || []).includes(tag))) {
    await syncNav(null, version);
    return renderError('그런 주제는 없어요.', version);
  }

  const view = tpl('tpl-list');
  const list = view.querySelector('.post-list');
  await syncNav(category, version);
  if (stale(version)) return;

  // 글과 앱을 한 목록에. 앱은 kind 로 구분해 카드 모양을 고른다
  let shown = [
    ...posts.map(p => ({ kind: 'post', ...p })),
    ...apps.map(a => ({ kind: 'app', ...a })),
  ].sort(byDateDesc);
  let title = null;
  if (category === APPS) {
    shown = shown.filter(x => x.kind === 'app');
    title = catLabel(APPS);
  } else if (category) {
    shown = shown.filter(x => x.kind === 'post' && x.category === category);
    title = catLabel(category);
  }
  if (category === 'daystudy') fillTopics(view.querySelector('.topics'), shown, tag);
  if (tag) {
    shown = shown.filter(p => (p.tags || []).includes(tag));
    title = `${topicLabel(tag)} — ${title}`;
  }
  view.querySelector('.post-list__empty').hidden = shown.length > 0;

  for (const item of shown) list.append(item.kind === 'app' ? makeAppCard(item) : makeCard(item));

  show(view, title, version);
}

async function renderPost(slug, version) {
  const posts = await loadIndex();
  if (stale(version)) return;
  const meta = posts.find(p => p.slug === slug);
  await syncNav(meta ? meta.category : null, version);
  if (stale(version)) return;
  if (!meta) return renderError(`"${slug}" 라는 글은 목록에 없어요.`, version);

  const res = await fetch(postUrl(slug));
  if (stale(version)) return;
  if (!res.ok) return renderError(`글 파일을 불러오지 못했어요 (${res.status}).`, version);
  const src = await res.text();
  if (stale(version)) return;

  // 프런트매터에 있는 값은 posts.json 이 우선한다
  const { meta: fm } = parseFrontmatter(src);
  const title = meta.title || fm.title || slug;

  const view = tpl('tpl-post');
  const time = view.querySelector('.post-header__date');
  time.dateTime = meta.date;
  time.textContent = formatDate(meta.date);
  fillKicker(view.querySelector('.post-header__kicker'), meta);
  view.querySelector('.post-header__title').textContent = title;
  fillTags(view.querySelector('.post-header .tags'), meta.tags || fm.tags);
  view.querySelector('.prose').innerHTML = render(src);

  const kicker = kickerOf(meta);
  show(view, kicker ? `${kicker} — ${title}` : title, version);
}

function renderError(message, version) {
  const view = tpl('tpl-error');
  view.querySelector('.error__message').textContent = message;
  show(view, '찾을 수 없음', version);
}

// ---------------------------------------------------------------- 라우터

async function badAddress(version) {
  await syncNav(null, version);
  renderError('주소가 올바르지 않아요.', version);
}

async function route() {
  const version = ++routeVersion;
  const hash = location.hash.replace(/^#/, '') || '/';
  const post = hash.match(/^\/post\/([^/]+)\/?$/);
  const cat = hash.match(/^\/cat\/([^/]+)\/?$/);
  const tag = hash.match(/^\/tag\/([^/]+)\/?$/);

  showLoading();
  try {
    if (hash === '/') return await renderList({ version });
    if (cat) {
      const name = decodeSegment(cat[1]);
      return name === null ? await badAddress(version) : await renderList({ category: name, version });
    }
    if (tag) {
      const name = decodeSegment(tag[1]);
      return name === null ? await badAddress(version) : await renderList({ tag: name, version });
    }
    if (post) {
      const slug = decodeSegment(post[1]);
      // slug 는 파일 경로가 된다. 문법을 여기서 막으면 잘못된 목록 항목도 같이 걸린다.
      if (slug === null || !SLUG_RE.test(slug)) return await badAddress(version);
      return await renderPost(slug, version);
    }
    await badAddress(version);
  } catch (err) {
    console.error(err);
    if (stale(version)) return;
    renderError(err.message || '알 수 없는 오류가 났어요.', version);
  }
}


// ---------------------------------------------------------------- 테마 토글

function initThemeToggle() {
  const btn = document.querySelector('.theme-toggle');
  const sync = () => {
    btn.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  };
  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    window.__setTheme(next);
    sync();
  });
  sync();
}

initThemeToggle();
window.addEventListener('hashchange', route);
route();
