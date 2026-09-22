// head 에서 동기로 실행된다. 첫 페인트 전에 data-theme 와 data-embed 를 결정해 플래시를 막는다.
// 블로그 js/theme.js 의 복사본에 두 가지를 더했다 — storage 이벤트 동기화, iframe(임베드) 판정.
// 앱은 자체 완결이므로 ../../js/ 를 참조하지 않는다. DOM 은 아직 없으니 버튼은 app.js 가 바인딩한다.
(function () {
  var KEY = 'theme'; // 블로그와 같은 키 — 같은 출처라 테마를 공유한다
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
    // app.js 가 토글 버튼의 aria-pressed 를 맞추도록 알린다
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }

  function system() {
    return mq.matches ? 'dark' : 'light';
  }

  // iframe 안이면 header 를 숨기고 보드를 맨 위로 올린다 (style.css 의 [data-embed])
  try {
    if (window.self !== window.top) document.documentElement.setAttribute('data-embed', '');
  } catch (e) { /* 교차 출처 부모여도 비교 자체는 되지만, 혹시 몰라 */ }

  // 사용자가 고른 값 > 시스템 설정
  apply(stored() || system());

  // 사용자가 직접 고른 적이 없을 때만 시스템 변경을 따라간다
  mq.addEventListener('change', function (e) {
    if (!stored()) apply(e.matches ? 'dark' : 'light');
  });

  // 다른 탭·부모 페이지(블로그)에서 토글하면 즉시 따라간다. 키가 지워지면 시스템값으로.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY || e.key === null) apply(stored() || system());
  });

  window.__setTheme = function (theme) {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* 프라이빗 모드 등 */ }
  };
})();
