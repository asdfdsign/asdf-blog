// UI 전부. state·settings 두 객체를 Pomodoro(timer.js) 의 순수 함수로 바꾸고 render() 가 DOM 을 맞춘다.
// 남은 시간은 항상 endAt 기준으로 다시 계산한다. 250ms 인터벌은 running 에서만 살아 있고, 저장은 전이 때만.
(function () {
  'use strict';

  var P = window.Pomodoro;
  var KEY_SETTINGS = 'pomodoro:settings';
  var KEY_STATE = 'pomodoro:state';
  var TICK_MS = 250;
  var embed = document.documentElement.hasAttribute('data-embed');

  var els = {
    timer: document.getElementById('timer'),
    sessionLabel: document.getElementById('session-label'),
    sound: document.getElementById('sound'),
    ringWrap: document.getElementById('ring-wrap'),
    progress: document.getElementById('progress'),
    digits: document.getElementById('digits'),
    live: document.getElementById('live'),
    reset: document.getElementById('reset'),
    main: document.getElementById('main'),
    mainLabel: document.getElementById('main-label'),
    skip: document.getElementById('skip'),
    dots: document.getElementById('dots'),
    dotsList: document.getElementById('dots-list'),
    dotsCount: document.getElementById('dots-count'),
    settings: document.getElementById('settings'),
    inputs: Array.prototype.slice.call(document.querySelectorAll('.settings__grid input[data-key]')),
    defaults: document.getElementById('defaults'),
    clearToday: document.getElementById('clear-today'),
    themeToggle: document.querySelector('.theme-toggle'),
  };

  var settings;          // { focus, short, long, interval, sound }
  var state;             // timer.js 의 state 객체
  var intervalId = null; // 250ms 화면 갱신
  var deadlineId = null; // 종료 시각 단발 알람
  var audioCtx = null;   // 첫 제스처 때 만든다
  var endedLabel = null; // 세션이 막 끝난 뒤 탭 제목용 "(끝) 집중 끝"

  // 렌더 캐시 — 바뀌었을 때만 DOM 에 쓴다(탭 제목·라이브 영역은 특히)
  var shown = { digits: '', title: '', minutes: -1, dotCount: -1, dotsLabel: '' };

  /* ---------- 저장소 — 전부 try/catch. 실패해도 타이머는 돈다 ---------- */

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 프라이빗 모드 등 */ }
  }

  function saveState() { writeJSON(KEY_STATE, state); }
  function saveSettings() { writeJSON(KEY_SETTINGS, settings); }

  /* ---------- 소리 — Web Audio 합성. 컨텍스트는 사용자 제스처 안에서만 만든다 ---------- */

  function ensureAudio() {
    var Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) {
      try { audioCtx = new Ctor(); } catch (e) { audioCtx = null; return null; }
    }
    if (audioCtx.state === 'suspended') {
      var p = audioCtx.resume();
      if (p && p.catch) p.catch(function () { /* 제스처가 아니면 거부될 수 있다 */ });
    }
    return audioCtx;
  }

  // sine 한 음. 게인 0.15 에서 지수 감쇠
  function tone(freq, at, dur) {
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  // 집중 끝 = 두 음 상승, 휴식 끝 = 한 음. 화면을 안 봐도 무엇이 끝났는지 안다
  function playChime(session) {
    if (!audioCtx) return false;
    var t = audioCtx.currentTime;
    if (session === 'focus') {
      tone(880, t, 0.12);
      tone(1175, t + 0.13, 0.18);
    } else {
      tone(660, t, 0.2);
    }
    return true;
  }

  // 소리를 켤 때 확인용 짧은 음
  function playConfirm() {
    if (!audioCtx) return false;
    tone(660, audioCtx.currentTime, 0.08);
    return true;
  }

  // Review 가 spy 를 걸 수 있는 디버그 핸들. complete 는 이 객체를 통해 재생 함수를 부른다
  var dbg = window.__pomodoro = {
    getAudioCtx: function () { return audioCtx; },
    ensureAudio: ensureAudio,
    playChime: playChime,
    playConfirm: playConfirm,
    getState: function () { return state; },
    getSettings: function () { return settings; },
  };

  /* ---------- 문구 ---------- */

  function minutesOf(ms) { return Math.round(ms / 60000); }

  // "12분 30초" — 라이브 영역용
  function human(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60), sec = s % 60;
    var parts = [];
    if (m) parts.push(m + '분');
    if (sec || !m) parts.push(sec + '초');
    return parts.join(' ');
  }

  // 라이브 영역. 같은 문구를 연속으로 쓰지 않는다
  function say(text) {
    if (els.live.textContent === text) return;
    els.live.textContent = text;
  }

  function mainLabel() {
    if (state.status === 'running') return '일시정지';
    if (state.status === 'paused') return '계속';
    return state.session === 'focus' ? '집중 시작' : '휴식 시작';
  }

  /* ---------- 렌더 ---------- */

  function renderDots() {
    var n = settings.interval;
    if (shown.dotCount !== n) {
      while (els.dotsList.firstChild) els.dotsList.removeChild(els.dotsList.firstChild);
      for (var i = 0; i < n; i++) {
        var dot = document.createElement('span');
        dot.className = 'dot';
        els.dotsList.appendChild(dot);
      }
      shown.dotCount = n;
    }
    var filled = Math.min(state.cyclePos, n);
    var dots = els.dotsList.children;
    for (var k = 0; k < dots.length; k++) dots[k].classList.toggle('is-filled', k < filled);
    var label = '오늘 ' + state.completed + '회 완료, 다음 긴 휴식까지 ' + Math.max(0, n - filled) + '회';
    if (label !== shown.dotsLabel) {
      shown.dotsLabel = label;
      els.dotsCount.textContent = '오늘 ' + state.completed + '회';
      els.dots.setAttribute('aria-label', label);
    }
  }

  function renderSound() {
    els.sound.setAttribute('aria-pressed', String(settings.sound));
    els.sound.setAttribute('aria-label', settings.sound ? '소리 켬' : '소리 끔');
  }

  function renderSettingsInputs() {
    els.inputs.forEach(function (input) { input.value = String(settings[input.dataset.key]); });
  }

  function render(now) {
    var left = P.remaining(state, now);
    var secs = Math.ceil(left / 1000);
    var pct = P.fraction(state, now) * 100;

    els.timer.dataset.session = state.session;
    els.timer.dataset.status = state.status;
    // textContent 대입은 같은 문자열이어도 텍스트 노드를 갈아 끼우므로(틱마다 DOM 변경) 바뀔 때만 쓴다
    var sessionText = P.sessionLabel(state.session);
    if (els.sessionLabel.textContent !== sessionText) els.sessionLabel.textContent = sessionText;
    var mainText = mainLabel();
    if (els.mainLabel.textContent !== mainText) els.mainLabel.textContent = mainText;

    // 호 — 남은 % 만큼 남기고 12시부터 시계 방향으로 비운다(4절 공식)
    els.progress.style.strokeDashoffset = String(-(100 - pct));
    els.progress.classList.toggle('is-empty', left === 0);
    els.timer.classList.toggle('is-ending', secs <= 10 && state.status !== 'idle');

    var text = P.format(left);
    if (text !== shown.digits) {
      shown.digits = text;
      els.digits.textContent = text;
    }

    // 분이 바뀔 때만 timer 라벨을 갱신하고, running 중이면 정각 안내
    var minutes = Math.ceil(secs / 60);
    if (minutes !== shown.minutes) {
      var announce = shown.minutes !== -1 && state.status === 'running' && minutes > 0 && minutes < shown.minutes;
      shown.minutes = minutes;
      els.ringWrap.setAttribute('aria-label', P.sessionLabel(state.session) + ', 남은 시간 ' + human(left));
      if (announce) say('남은 시간 ' + minutes + '분');
    }
    if (state.status === 'running' && secs === 10) say('10초 남음');

    renderDots();

    // 탭 제목 — 임베드에선 건드리지 않고, 문자열이 바뀔 때만 쓴다(초가 바뀔 때)
    if (!embed) {
      var title = (state.status === 'idle' && endedLabel)
        ? '(끝) ' + endedLabel + ' 끝 — 포모도로'
        : P.titleText(state, now);
      if (title !== shown.title) {
        shown.title = title;
        document.title = title;
      }
    }
  }

  // 세션·상태가 바뀐 뒤 라벨을 강제로 다시 쓰게 한다
  function invalidateLabel() { shown.minutes = -1; }

  /* ---------- 인터벌·알람 ---------- */

  function stopTimers() {
    if (intervalId !== null) { clearInterval(intervalId); intervalId = null; }
    if (deadlineId !== null) { clearTimeout(deadlineId); deadlineId = null; }
  }

  // 인터벌은 화면용, 단발 setTimeout 은 숨겨진 탭에서도 종료 순간을 잡기 위한 것
  function startTimers() {
    stopTimers();
    intervalId = setInterval(tick, TICK_MS);
    deadlineId = setTimeout(tick, P.remaining(state, Date.now()) + 20);
  }

  function tick() {
    var now = Date.now();
    if (P.isDone(state, now)) { finish(now, true); return; }
    render(now);
  }

  // 자연 완료. running 일 때만 한 번 처리된다
  function finish(now, withSound) {
    if (state.status !== 'running') return;
    var prev = state.session;
    state = P.rollDate(state, now);
    state = P.complete(state, settings, now);
    stopTimers();
    if (withSound && settings.sound && audioCtx) dbg.playChime(prev);
    endedLabel = P.sessionLabel(prev);
    invalidateLabel();
    say(P.sessionLabel(prev) + ' 끝. ' + P.sessionLabel(state.session) + ' ' + minutesOf(state.durationMs) + '분. 시작을 누르세요');
    saveState();
    render(now);
  }

  /* ---------- 동작 ---------- */

  function doToggle() {
    var now = Date.now();
    ensureAudio(); // 사용자 제스처 — 여기서만 컨텍스트를 만든다
    if (state.status === 'running') {
      state = P.pause(state, now);
      stopTimers();
      say('일시정지, 남은 시간 ' + human(state.remainingMs));
    } else {
      var wasIdle = state.status === 'idle';
      state = P.rollDate(state, now);
      state = P.start(state, now);
      endedLabel = null;
      startTimers();
      say(wasIdle
        ? P.sessionLabel(state.session) + ' ' + minutesOf(state.durationMs) + '분 시작'
        : '계속, 남은 시간 ' + human(P.remaining(state, now)));
    }
    invalidateLabel();
    saveState();
    render(now);
  }

  function doSkip() {
    var now = Date.now();
    state = P.skip(state, settings, now);
    stopTimers();
    endedLabel = null;
    invalidateLabel();
    say('건너뜀. ' + P.sessionLabel(state.session) + ' ' + minutesOf(state.durationMs) + '분');
    saveState();
    render(now);
  }

  function doReset() {
    var now = Date.now();
    state = P.reset(state, settings, now);
    stopTimers();
    endedLabel = null;
    invalidateLabel();
    say('처음으로. ' + P.sessionLabel(state.session) + ' ' + minutesOf(state.durationMs) + '분');
    saveState();
    render(now);
  }

  function toggleSound() {
    settings.sound = !settings.sound;
    saveSettings();
    renderSound();
    if (settings.sound) {
      ensureAudio(); // 제스처 직후라 재생된다
      dbg.playConfirm();
    }
  }

  // 설정 반영 공통 — 입력칸 되쓰기, 저장, idle 이면 길이 즉시 반영
  function commitSettings(next) {
    settings = next;
    saveSettings();
    renderSettingsInputs();
    state = P.applySettings(state, settings);
    invalidateLabel();
    saveState();
    render(Date.now());
  }

  function onSettingChange(e) {
    var input = e.target;
    var raw = input.value.trim();
    // 빈 값·NaN 은 이전 값을 유지한다(normalizeSettings 는 기본값으로 떨어뜨리므로 여기서 거른다)
    if (raw !== '' && isFinite(parseFloat(raw))) {
      var patch = {};
      patch[input.dataset.key] = raw;
      commitSettings(P.normalizeSettings(Object.assign({}, settings, patch)));
    } else {
      renderSettingsInputs();
    }
  }

  function restoreDefaults() {
    commitSettings(P.normalizeSettings(Object.assign({}, P.DEFAULTS, { sound: settings.sound })));
  }

  function clearToday() {
    state = P.clearToday(state);
    saveState();
    render(Date.now());
  }

  /* ---------- 다른 탭·복귀 동기화 ---------- */

  // 숨겨진 사이(또는 다른 탭에서) 상태가 바뀌었을 수 있다 — 즉시 다시 계산
  function onVisible() {
    var now = Date.now();
    var rolled = P.rollDate(state, now);
    if (rolled !== state) { state = rolled; saveState(); }
    if (P.isDone(state, now)) { finish(now, true); return; }
    render(now);
  }

  // 같은 출처의 다른 문서(블로그 카드 iframe ↔ 새 탭)가 상태를 바꾸면 따라간다
  function onStorage(e) {
    var now = Date.now();
    if (e.key === KEY_STATE) {
      var saved = readJSON(KEY_STATE);
      if (!P.isValidState(saved, settings)) return;
      state = saved;
      endedLabel = null;
      invalidateLabel();
      if (state.status === 'running' && !P.isDone(state, now)) startTimers(); else stopTimers();
      if (P.isDone(state, now)) { finish(now, false); return; }
      render(now);
    } else if (e.key === KEY_SETTINGS) {
      settings = P.normalizeSettings(readJSON(KEY_SETTINGS));
      renderSettingsInputs();
      renderSound();
      state = P.applySettings(state, settings);
      render(now);
    }
  }

  /* ---------- 입력 바인딩 ---------- */

  els.main.addEventListener('click', doToggle);
  els.skip.addEventListener('click', doSkip);
  els.reset.addEventListener('click', doReset);
  els.sound.addEventListener('click', toggleSound);
  els.inputs.forEach(function (input) { input.addEventListener('change', onSettingChange); });
  els.defaults.addEventListener('click', restoreDefaults);
  els.clearToday.addEventListener('click', clearToday);

  // 단축키: Space 시작/일시정지, S 건너뛰기, R 리셋. 입력칸·버튼 위에서는 그 요소의 기본 동작에 맡긴다
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return;
    var t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable]')) return;
    if (e.key === ' ' || e.code === 'Space') {
      if (t && t.closest && t.closest('button, summary, a')) return; // 그 요소가 이미 클릭으로 처리한다
      e.preventDefault();
      doToggle();
    } else if (e.code === 'KeyS' || e.key === 's' || e.key === 'S') {
      doSkip();
    } else if (e.code === 'KeyR' || e.key === 'r' || e.key === 'R') {
      doReset();
    }
  });

  // 테마 토글 — theme.js 의 __setTheme 를 쓰고, 다른 탭에서 바뀌어도 themechange 로 버튼을 맞춘다
  function syncThemeButton() {
    els.themeToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  }
  els.themeToggle.addEventListener('click', function () {
    window.__setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  document.addEventListener('themechange', syncThemeButton);
  syncThemeButton();

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) onVisible();
  });
  window.addEventListener('pageshow', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('storage', onStorage);
  window.addEventListener('pagehide', saveState);

  /* ---------- 시작 ---------- */

  (function init() {
    var now = Date.now();
    settings = P.normalizeSettings(readJSON(KEY_SETTINGS));
    var saved = readJSON(KEY_STATE);
    state = P.isValidState(saved, settings) ? saved : P.createState(settings, now);
    state = P.rollDate(state, now);
    if (state.status === 'idle') state = P.applySettings(state, settings); // idle 길이는 항상 지금 설정과 같게

    renderSettingsInputs();
    renderSound();

    if (P.isDone(state, now)) {
      finish(now, false); // 자리를 비운 사이 끝났다 — 제스처가 없으니 소리는 없이
      return;
    }
    if (state.status === 'running') startTimers();
    saveState();
    render(now);
  })();
})();
