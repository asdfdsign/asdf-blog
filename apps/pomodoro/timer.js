// 순수 타이머 로직. DOM·저장소·시계에 의존하지 않는다 — 시간이 필요한 함수는 now(epoch ms)를 마지막 인자로 받는다.
// 상태 객체는 변형하지 않고 항상 새 객체를 돌려준다. window.Pomodoro 로 노출해 콘솔·test.html 에서 바로 부른다.
(function () {
  'use strict';

  var DEFAULTS = { focus: 25, short: 5, long: 15, interval: 4, sound: true };
  var LIMITS = { minutes: [1, 90], interval: [1, 8] };
  var SESSIONS = ['focus', 'short', 'long'];
  var STATUSES = ['idle', 'running', 'paused'];
  var LABELS = { focus: '집중', short: '짧은 휴식', long: '긴 휴식' };

  /* ---------- 도우미 ---------- */

  // 얕은 병합. 입력을 건드리지 않는다
  function assign(base, patch) {
    var out = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) out[k] = patch[k];
    return out;
  }

  // 정수화 + 범위 자르기. 숫자로 읽을 수 없으면 fallback
  function clampInt(v, range, fallback) {
    var n = typeof v === 'string' ? parseFloat(v) : v;
    if (typeof n !== 'number' || !isFinite(n)) return fallback;
    n = Math.floor(n);
    return Math.min(range[1], Math.max(range[0], n));
  }

  function isNonNeg(n) {
    return typeof n === 'number' && isFinite(n) && n >= 0;
  }

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* ---------- 설정 ---------- */

  function normalizeSettings(raw) {
    var r = (raw && typeof raw === 'object') ? raw : {};
    return {
      focus: clampInt(r.focus, LIMITS.minutes, DEFAULTS.focus),
      short: clampInt(r.short, LIMITS.minutes, DEFAULTS.short),
      long: clampInt(r.long, LIMITS.minutes, DEFAULTS.long),
      interval: clampInt(r.interval, LIMITS.interval, DEFAULTS.interval),
      sound: typeof r.sound === 'boolean' ? r.sound : DEFAULTS.sound, // 불리언만 받는다
    };
  }

  function durationMs(settings, session) {
    return settings[session] * 60000;
  }

  /* ---------- 상태 ---------- */

  // 로컬 날짜. UTC 로 하면 밤 9시 이후 완료가 내일로 넘어간다
  function dateKey(now) {
    var d = new Date(0);
    d.setTime(now);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function createState(settings, now) {
    return {
      v: 1,
      session: 'focus',
      status: 'idle',
      durationMs: durationMs(settings, 'focus'),
      endAt: null,
      remainingMs: null,
      completed: 0,
      cyclePos: 0,
      date: dateKey(now),
    };
  }

  // 저장 복원용. 스키마가 조금이라도 어긋나면 false — 호출 쪽이 새 상태를 만든다
  function isValidState(obj, settings) {
    if (!obj || typeof obj !== 'object') return false;
    if (obj.v !== 1) return false;
    if (SESSIONS.indexOf(obj.session) === -1) return false;
    if (STATUSES.indexOf(obj.status) === -1) return false;
    if (!isNonNeg(obj.durationMs) || obj.durationMs === 0) return false; // 0 이면 fraction 이 NaN
    if (!isNonNeg(obj.completed) || !isNonNeg(obj.cyclePos)) return false;
    if (typeof obj.date !== 'string') return false;
    if (obj.status === 'running' && !isNonNeg(obj.endAt)) return false;
    if (obj.status === 'paused' && (!isNonNeg(obj.remainingMs) || obj.remainingMs > obj.durationMs)) return false;
    var maxPos = settings ? settings.interval : LIMITS.interval[1];
    if (obj.cyclePos > maxPos) return false;
    return true;
  }

  /* ---------- 시간 계산 (3절) ---------- */

  function remaining(state, now) {
    var r;
    if (state.status === 'running') r = state.endAt - now;
    else if (state.status === 'paused') r = state.remainingMs;
    else r = state.durationMs;
    return Math.max(0, Math.min(state.durationMs, r));
  }

  function fraction(state, now) {
    return remaining(state, now) / state.durationMs;
  }

  function isDone(state, now) {
    return state.status === 'running' && state.endAt <= now;
  }

  /* ---------- 전이 ---------- */

  function start(state, now) {
    if (state.status === 'running') return state;
    var left = state.status === 'paused' ? state.remainingMs : state.durationMs;
    return assign(state, { status: 'running', endAt: now + left, remainingMs: null });
  }

  function pause(state, now) {
    if (state.status !== 'running') return state;
    return assign(state, { status: 'paused', remainingMs: Math.max(0, state.endAt - now), endAt: null });
  }

  function toggle(state, now) {
    return state.status === 'running' ? pause(state, now) : start(state, now);
  }

  function nextSession(state, settings) {
    if (state.session === 'focus') return state.cyclePos + 1 >= settings.interval ? 'long' : 'short';
    return 'focus';
  }

  // 새 세션을 idle 로 연다. 길이는 지금 설정에서
  function enter(state, session, settings, patch) {
    return assign(state, assign({
      session: session,
      status: 'idle',
      durationMs: durationMs(settings, session),
      endAt: null,
      remainingMs: null,
    }, patch || {}));
  }

  // 자연 완료. running 이 아니면 그대로 — tick 과 알람이 둘 다 불러도 한 번만 처리된다.
  // now 는 시그니처 통일용(날짜 넘김은 호출 쪽 rollDate 가 맡는다)
  function complete(state, settings, now) {
    if (state.status !== 'running') return state;
    var next = nextSession(state, settings);
    var patch = {};
    if (state.session === 'focus') {
      patch.completed = state.completed + 1;
      patch.cyclePos = Math.min(state.cyclePos + 1, settings.interval); // 간격을 줄였어도 점 개수를 넘지 않게
    } else if (state.session === 'long') {
      patch.cyclePos = 0;
    }
    return enter(state, next, settings, patch);
  }

  // 건너뛰기. 완료로 세지 않는다. 긴 휴식을 건너뛰면 사이클은 처음으로
  function skip(state, settings, now) {
    var next = nextSession(state, settings);
    return enter(state, next, settings, state.session === 'long' ? { cyclePos: 0 } : {});
  }

  function reset(state, settings, now) {
    return enter(state, state.session, settings, {});
  }

  // idle 이면 길이를 즉시 반영. 진행 중이면 다음 세션부터(호 비율이 튀지 않게).
  // 간격을 cyclePos 보다 작게 줄이면 cyclePos 만 간격에 맞춰 내린다(저장 복원 검증을 통과하도록)
  function applySettings(state, settings) {
    var pos = Math.min(state.cyclePos, settings.interval);
    if (state.status !== 'idle') return pos === state.cyclePos ? state : assign(state, { cyclePos: pos });
    return assign(state, { durationMs: durationMs(settings, state.session), cyclePos: pos });
  }

  // 날짜가 바뀌면 오늘 기록만 비운다. 진행 중인 타이머는 그대로
  function rollDate(state, now) {
    var key = dateKey(now);
    if (state.date === key) return state;
    return assign(state, { completed: 0, cyclePos: 0, date: key });
  }

  function clearToday(state) {
    return assign(state, { completed: 0, cyclePos: 0 });
  }

  /* ---------- 표시 ---------- */

  // mm:ss. 올림이라 시작 직후 25:00, 00:00 은 정확히 끝났을 때만. 분은 60 을 넘어도 그대로(90:00)
  function format(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
  }

  function sessionLabel(session) {
    return LABELS[session];
  }

  function titleText(state, now) {
    if (state.status === 'idle') return '포모도로 타이머';
    var t = format(remaining(state, now));
    var head = state.status === 'paused' ? '(일시정지 ' + t + ') ' : '(' + t + ') ';
    return head + LABELS[state.session] + ' — 포모도로';
  }

  window.Pomodoro = {
    DEFAULTS: DEFAULTS,
    LIMITS: LIMITS,
    SESSIONS: SESSIONS,
    normalizeSettings: normalizeSettings,
    durationMs: durationMs,
    dateKey: dateKey,
    createState: createState,
    isValidState: isValidState,
    remaining: remaining,
    fraction: fraction,
    isDone: isDone,
    start: start,
    pause: pause,
    toggle: toggle,
    nextSession: nextSession,
    complete: complete,
    skip: skip,
    reset: reset,
    applySettings: applySettings,
    rollDate: rollDate,
    clearToday: clearToday,
    format: format,
    titleText: titleText,
    sessionLabel: sessionLabel,
  };
})();
