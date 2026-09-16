// 진입점. 해시 라우터 + 화면 렌더링.
//   #/            → 글 목록
//   #/tag/{name}  → 해당 카테고리 글만
//   #/post/{slug} → 글 상세
//   그 외          → 에러 화면
import { render, parseFrontmatter } from './markdown.js';

const SITE_TITLE = 'asdf';
const app = document.getElementById('app');

// 경로는 전부 상대 경로 — GitHub Pages 하위 경로(/asdf-blog/)에서도 깨지지 않게
const INDEX_URL = './content/posts.json';
const postUrl = slug => `./content/posts/${encodeURIComponent(slug)}.md`;

let indexCache = null;

async function loadIndex() {
  if (indexCache) return indexCache;
  const res = await fetch(INDEX_URL);
  if (!res.ok) throw new Error(`posts.json 을 불러오지 못했어요 (${res.status})`);
  const posts = await res.json();
  posts.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  indexCache = posts;
  return posts;
}

function tpl(id) {
  return document.getElementById(id).content.firstElementChild.cloneNode(true);
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 태그는 카테고리 링크다. 카드에서는 제목 링크 밖에 두어 <a> 가 겹치지 않게 한다.
function fillTags(ul, tags) {
  ul.replaceChildren();
  for (const t of tags || []) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#/tag/${encodeURIComponent(t)}`;
    a.textContent = t;
    li.append(a);
    ul.append(li);
  }
  if (!ul.children.length) ul.remove();
}

// 카테고리 바: 전체 + 태그별 글 수. 현재 선택된 것은 aria-current 로 표시.
function fillCats(nav, posts, current) {
  const counts = new Map();
  for (const p of posts) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
  const cats = [['전체', null, posts.length], ...[...counts].map(([t, n]) => [t, t, n])];

  nav.replaceChildren();
  for (const [label, tag, n] of cats) {
    const a = document.createElement('a');
    a.className = 'cat';
    a.href = tag ? `#/tag/${encodeURIComponent(tag)}` : '#/';
    if (tag === current) a.setAttribute('aria-current', 'true');
    a.append(label, Object.assign(document.createElement('span'), { className: 'cat__count', textContent: n }));
    nav.append(a);
  }
}

// 시리즈 글이면 "Daystudy #1" 같은 라벨을 제목 위에 단다
function fillKicker(el, post) {
  if (!post.series) return;
  el.textContent = post.part ? `${post.series} #${post.part}` : post.series;
  el.hidden = false;
}

function show(node, title) {
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

async function renderList(tag = null) {
  const posts = await loadIndex();
  const view = tpl('tpl-list');
  const list = view.querySelector('.post-list');

  fillCats(view.querySelector('.cats'), posts, tag);

  const shown = tag ? posts.filter(p => (p.tags || []).includes(tag)) : posts;
  view.querySelector('.post-list__empty').hidden = shown.length > 0;

  for (const post of shown) {
    const card = tpl('tpl-card');
    card.querySelector('.post-card__link').href = `#/post/${post.slug}`;
    const time = card.querySelector('.post-card__date');
    time.dateTime = post.date;
    time.textContent = formatDate(post.date);
    fillKicker(card.querySelector('.post-card__kicker'), post);
    card.querySelector('.post-card__title').textContent = post.title;
    card.querySelector('.post-card__summary').textContent = post.summary || '';
    fillTags(card.querySelector('.tags'), post.tags);
    list.append(card);
  }

  show(view, tag);
}

async function renderPost(slug) {
  const posts = await loadIndex();
  const meta = posts.find(p => p.slug === slug);
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

  show(view, meta.series ? `${meta.series} — ${title}` : title);
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
  const tag = hash.match(/^\/tag\/([^/]+)\/?$/);

  showLoading();
  try {
    if (hash === '/') return await renderList();
    if (tag) return await renderList(decodeURIComponent(tag[1]));
    if (post) return await renderPost(decodeURIComponent(post[1]));
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
