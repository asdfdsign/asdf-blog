// 마크다운 → HTML. 순수 함수만 있다: 문자열이 들어가서 문자열이 나온다. DOM 을 만지지 않는다.
//
// 1차 지원 문법:
//   블록  — 제목(#~######), 문단, 코드 블록(```lang), 인용(>), 목록(-, *, 1.), 수평선(---)
//   인라인 — `코드`, **굵게**, *기울임*, ~~취소~~, [링크](url), ![이미지](src)
//
// 결과는 innerHTML 로 들어가므로 사용자 텍스트는 반드시 escapeHtml 을 거친다.

export function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// 파일 상단의 --- 블록을 분리한다. 없으면 meta 는 빈 객체.
export function parseFrontmatter(src) {
  const text = src.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: text };

  const meta = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    // [a, b] 형태는 배열로, 따옴표는 벗긴다
    if (/^\[.*\]$/.test(val)) {
      val = val.slice(1, -1).split(',').map(v => v.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, '');
    }
    meta[key] = val;
  }
  return { meta, body: text.slice(m[0].length) };
}

// javascript: 같은 위험한 스킴은 막는다. 상대 경로·http(s)·mailto·# 는 통과.
function safeUrl(url) {
  const u = url.trim();
  if (/^\s*(javascript|data|vbscript):/i.test(u)) return '#';
  return u;
}

// 강조. 굵게를 먼저 처리해야 ** 가 * 두 개로 쪼개지지 않는다.
function renderEmphasis(s) {
  s = s.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');
}

// 인라인 문법. 입력은 아직 이스케이프되지 않은 원문이다.
// 순서가 중요하다: 코드 → 이미지 → 링크 → 강조.
//
// 코드·이미지·링크는 만든 즉시 자리표시자로 **치워 둔다.** 그러지 않으면 뒤에 오는 강조
// 정규식이 이미 만들어진 href="..." 안쪽까지 훑어서 URL 을 망가뜨린다 —
// [배포 노트](https://example.com/*release*) 의 *release* 가 <em>release</em> 로 바뀌어
// 링크가 엉뚱한 주소로 간다. 큰따옴표는 이미 이스케이프돼 있어 XSS 는 아니지만
// 아무 경고 없이 조용히 깨진다.
export function renderInline(text) {
  const parts = [];
  const hold = (html) => {
    parts.push(html);
    return `\u0000${parts.length - 1}\u0000`;
  };

  // 자리표시자에 쓰는 NUL 이 원문에 있으면 복원 단계가 엉킨다. 글에 쓸 문자가 아니므로 떼어낸다.
  let s = text.replace(/\u0000/g, '');

  // 1) 인라인 코드. 코드 안은 다른 문법을 적용하지 않는다.
  s = s.replace(/`([^`\n]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));

  s = escapeHtml(s);

  // 2) 이미지 — 링크보다 먼저 (같은 [..](..) 모양이라 ! 유무로 구분)
  s = s.replace(/!\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, title) => {
    const t = title ? ` title="${title}"` : '';
    return hold(`<img src="${safeUrl(src)}" alt="${alt}"${t}>`);
  });

  // 3) 링크. 라벨에는 강조를 먹여야 하므로 라벨만 따로 돌리고, 완성된 태그를 치워 둔다.
  s = s.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g, (_, label, href) => {
    const h = safeUrl(href);
    const ext = /^https?:\/\//i.test(h) ? ' target="_blank" rel="noopener"' : '';
    return hold(`<a href="${h}"${ext}>${renderEmphasis(label)}</a>`);
  });

  // 4) 남은 본문의 강조
  s = renderEmphasis(s);

  // 5) 자리표시자 복원. 치워 둔 조각 안에 또 자리표시자가 있을 수 있어(링크 라벨 안의
  //    인라인 코드 등) 남지 않을 때까지 돈다. 중첩이 깊어도 몇 번이면 끝나고, 상한을 둬서
  //    어떤 입력에도 멈추지 않는 일이 없게 한다.
  for (let pass = 0; pass < 5 && s.includes('\u0000'); pass++) {
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => parts[Number(i)] ?? '');
  }
  return s;
}

const RE = {
  fence: /^```\s*([\w+-]*)\s*$/,
  heading: /^(#{1,6})\s+(.+?)\s*#*\s*$/,
  hr: /^(?:-{3,}|\*{3,}|_{3,})\s*$/,
  quote: /^>\s?(.*)$/,
  ul: /^[-*+]\s+(.+)$/,
  ol: /^\d+[.)]\s+(.+)$/,
};

// 블록 파싱. 줄 단위로 훑으면서 상태를 바꾼다.
export function renderBlocks(body) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;

  // 연속된 줄을 조건이 맞는 동안 모은다
  const collect = (test) => {
    const buf = [];
    while (i < lines.length && test(lines[i])) buf.push(lines[i++]);
    return buf;
  };

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i++; continue; }

    // 코드 블록: 닫는 ``` 까지 원문 그대로. 이스케이프만 한다.
    const fence = line.match(RE.fence);
    if (fence) {
      i++;
      const buf = [];
      while (i < lines.length && !/^```\s*$/.test(lines[i])) buf.push(lines[i++]);
      i++; // 닫는 펜스 (없으면 파일 끝)
      const lang = fence[1];
      const attrs = lang ? ` class="language-${lang}" data-lang="${lang}"` : '';
      const pre = lang ? ` data-lang="${lang}"` : '';
      out.push(`<pre${pre}><code${attrs}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(RE.heading);
    if (h) {
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      i++;
      continue;
    }

    if (RE.hr.test(line)) { out.push('<hr>'); i++; continue; }

    if (RE.quote.test(line)) {
      const buf = collect(l => RE.quote.test(l)).map(l => l.match(RE.quote)[1]);
      // 인용 안은 다시 블록 파싱 (문단·목록 등이 들어갈 수 있다)
      out.push(`<blockquote>${renderBlocks(buf.join('\n'))}</blockquote>`);
      continue;
    }

    if (RE.ul.test(line)) {
      const items = collect(l => RE.ul.test(l)).map(l => `<li>${renderInline(l.match(RE.ul)[1])}</li>`);
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (RE.ol.test(line)) {
      const items = collect(l => RE.ol.test(l)).map(l => `<li>${renderInline(l.match(RE.ol)[1])}</li>`);
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    // 문단: 빈 줄이나 다른 블록이 시작되기 전까지의 줄을 하나로 합친다
    const isBlockStart = l =>
      l.trim() === '' || RE.fence.test(l) || RE.heading.test(l) || RE.hr.test(l) ||
      RE.quote.test(l) || RE.ul.test(l) || RE.ol.test(l);
    const para = collect(l => !isBlockStart(l));
    out.push(`<p>${renderInline(para.join('\n').trim())}</p>`);
  }

  return out.join('\n');
}

// 진입점. 프런트매터를 떼고 본문을 HTML 로.
export function render(src) {
  const { body } = parseFrontmatter(src);
  return renderBlocks(body);
}
