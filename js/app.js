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

let indexCache = null;
let appsCache = null;

async function loadIndex() {
  if (indexCache) return indexCache;
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`posts.json 을 불러오지 못했어요 (${res.status})`);
  const posts = await res.json();
  // 최신순. 같은 날짜면 Daystudy 번호가 큰 쪽이 먼저
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.part || 0) - (a.part || 0)));
  indexCache = posts;
  return posts;
}

// 웹앱 목록. 순서는 apps.json 에 적힌 대로(최신이 위)
async function loadApps() {
  if (appsCache) return appsCache;
  const res = await fetch(APPS_URL);
  if (!res.ok) throw new Error(`apps.json 을 불러오지 못했어요 (${res.status})`);
  appsCache = await res.json();
  return appsCache;
}

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

function show(node, title) {
  // 히어로는 목록 화면에서만
  document.getElementById('hero').hidden = !node.classList.contains('view--list');
  app.replaceChildren(node);
  document.title = title ? `${title} — ${SITE_TITLE}` : SITE_TITLE;
  window.scrollTo({ top: 0, behavior: 'instant' });
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
  card.querySelector('.post-card__link').href = `#/post/${post.slug}`;
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
async function syncNav(current) {
  const [posts, apps] = await Promise.all([loadIndex(), loadApps()]);
  fillCats(document.querySelector('.site-nav .cats'), posts, apps, current);
}

// 최신순 정렬. 같은 날짜면 Daystudy 번호가 큰 쪽이 먼저
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.part || 0) - (a.part || 0));

// 목록은 언제나 최신순 한 줄. 전체는 글과 웹앱을 섞고, 카테고리·주제는 거르기만 한다.
async function renderList({ category = null, tag = null } = {}) {
  const [posts, apps] = await Promise.all([loadIndex(), loadApps()]);
  const view = tpl('tpl-list');
  const list = view.querySelector('.post-list');

  // 주제는 Daystudy 안의 것이므로, 주제로 걸러도 카테고리 바에서는 Daystudy 가 선택된 상태
  if (tag) category = 'daystudy';
  await syncNav(category);

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

  show(view, title);
}

async function renderPost(slug) {
  const posts = await loadIndex();
  const meta = posts.find(p => p.slug === slug);
  await syncNav(meta ? meta.category : null);
  if (!meta) return renderError(`"${slug}" 라는 글은 목록에 없어요.`);

  const res = await fetch(postUrl(slug));
  if (!res.ok) return renderError(`글 파일을 불러오지 못했어요 (${res.status}).`);
  const src = await res.text();

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
  show(view, kicker ? `${kicker} — ${title}` : title);
}

function renderError(message) {
  const view = tpl('tpl-error');
  view.querySelector('.error__message').textContent = message;
  show(view, '찾을 수 없음');
}

// ---------------------------------------------------------------- 라우터

async function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const post = hash.match(/^\/post\/([^/]+)\/?$/);
  const cat = hash.match(/^\/cat\/([^/]+)\/?$/);
  const tag = hash.match(/^\/tag\/([^/]+)\/?$/);

  showLoading();
  try {
    if (hash === '/') return await renderList();
    if (cat) return await renderList({ category: decodeURIComponent(cat[1]) });
    if (tag) return await renderList({ tag: decodeURIComponent(tag[1]) });
    if (post) return await renderPost(decodeURIComponent(post[1]));
    await syncNav(null);
    renderError('주소가 올바르지 않아요.');
  } catch (err) {
    console.error(err);
    renderError(err.message || '알 수 없는 오류가 났어요.');
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
