// head 에서 동기로 실행된다. 첫 페인트 전에 data-theme 를 결정해 플래시를 막는다.
// DOM 은 아직 없으므로 여기서는 버튼을 만지지 않는다 — 바인딩은 app.js 가 한다.
(function () {
  var KEY = 'theme';
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function apply(theme) {
    document.documentElement.dataset.theme = theme;
  }

  // 사용자가 고른 값 > 시스템 설정
  apply(stored() || (mq.matches ? 'dark' : 'light'));

  // 사용자가 직접 고른 적이 없을 때만 시스템 변경을 따라간다
  mq.addEventListener('change', function (e) {
    if (!stored()) apply(e.matches ? 'dark' : 'light');
  });

  window.__setTheme = function (theme) {
    apply(theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* 프라이빗 모드 등 */ }
  };
})();
