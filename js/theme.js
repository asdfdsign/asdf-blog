// head 에서 동기로 실행된다. 첫 페인트 전에 data-theme 를 결정해 플래시를 막는다.
// DOM 은 아직 없으므로 여기서는 버튼을 만지지 않는다 — 바인딩은 app.js 가 한다.
(function () {
  var KEY = 'theme';
  var mq = window.matchMedia('(prefers-color-scheme: dark)');

  // 저장값은 'dark' / 'light' 둘만 인정한다. 다른 값이 들어 있으면 "고른 적 없음"으로 본다 —
  // 그러지 않으면 data-theme 에 쓰레기가 박히고, stored() 가 계속 참이라 시스템 테마 변경도
  // 더는 따라가지 않는다. 두 웹앱이 같은 키를 쓰므로 한 곳이 쓰레기를 쓰면 전부 번진다.
  function normalize(theme) {
    return theme === 'dark' || theme === 'light' ? theme : null;
  }

  function stored() {
    try { return normalize(localStorage.getItem(KEY)); } catch (e) { return null; }
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
    var next = normalize(theme) || (mq.matches ? 'dark' : 'light');
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* 프라이빗 모드 등 */ }
  };
})();
