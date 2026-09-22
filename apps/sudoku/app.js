// UI 전부. 상태는 state 하나에 모으고 render() 가 DOM 을 맞춘다.
// 칸 버튼은 새 게임 때만 만들고, 입력마다 속성·클래스만 바꾼다.
(function () {
  'use strict';

  var S = window.Sudoku;
  var KEY_PREFS = 'sudoku:prefs';
  var KEY_GAME = 'sudoku:game';

  var els = {
    board: document.getElementById('board'),
    time: document.getElementById('time'),
    info: document.getElementById('info'),
    status: document.querySelector('.status'),
    digits: document.getElementById('digits'),
    erase: document.getElementById('erase'),
    hint: document.getElementById('hint'),
    newGame: document.getElementById('new-game'),
    controls: document.querySelector('.controls'),
    themeToggle: document.querySelector('.theme-toggle'),
  };

  var state = {
    size: 6,
    difficulty: 'normal',
    seed: 0,
    puzzle: [],    // 0 = 빈칸. 주어진 칸 판별용
    solution: [],
    board: [],     // 현재 상태 (given 포함)
    hinted: [],    // 힌트로 채운 인덱스
    hints: 0,
    elapsed: 0,    // 초
    complete: false,
    selected: -1,
    conflicts: [],
  };

  var cells = [];     // 칸 버튼 (행 우선)
  var digitBtns = []; // 숫자 패드 버튼 (인덱스 = 숫자)
  var timerId = null;

  /* ---------- 저장소 — 전부 try/catch. 실패해도 게임은 된다 ---------- */

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 프라이빗 모드 등 */ }
  }

  function savePrefs() {
    writeJSON(KEY_PREFS, { v: 1, size: state.size, difficulty: state.difficulty });
  }

  function saveGame() {
    writeJSON(KEY_GAME, {
      v: 1,
      size: state.size,
      difficulty: state.difficulty,
      seed: state.seed,
      puzzle: S.encode(state.puzzle),
      solution: S.encode(state.solution),
      board: S.encode(state.board),
      hinted: state.hinted.slice(),
      hints: state.hints,
      elapsed: state.elapsed,
      complete: state.complete,
    });
  }

  function loadPrefs() {
    var p = readJSON(KEY_PREFS);
    if (p && p.v === 1 && S.SIZES.indexOf(p.size) !== -1 && S.DIFFICULTY[p.size][p.difficulty]) {
      state.size = p.size;
      state.difficulty = p.difficulty;
    }
  }

  // 스키마가 조금이라도 어긋나면 조용히 false — 콘솔 에러를 내지 않는다
  function restoreGame() {
    var g = readJSON(KEY_GAME);
    if (!g || g.v !== 1 || g.complete !== false) return false;
    if (S.SIZES.indexOf(g.size) === -1 || !S.DIFFICULTY[g.size][g.difficulty]) return false;
    if (typeof g.puzzle !== 'string' || typeof g.solution !== 'string' || typeof g.board !== 'string') return false;

    var n = g.size;
    var puzzle = S.decode(g.puzzle), solution = S.decode(g.solution), board = S.decode(g.board);
    if (!S.isValidBoard(puzzle, n) || !S.isValidBoard(solution, n) || !S.isValidBoard(board, n)) return false;
    if (!S.isComplete(solution, n)) return false;
    for (var i = 0; i < puzzle.length; i++) {
      if (puzzle[i] && (puzzle[i] !== solution[i] || board[i] !== puzzle[i])) return false;
    }
    var hinted = Array.isArray(g.hinted) ? g.hinted.filter(function (idx) {
      return typeof idx === 'number' && idx === Math.floor(idx) && idx >= 0 && idx < puzzle.length
        && !puzzle[idx] && board[idx] === solution[idx];
    }) : [];

    state.size = n;
    state.difficulty = g.difficulty;
    state.seed = typeof g.seed === 'number' ? g.seed : 0;
    state.puzzle = puzzle;
    state.solution = solution;
    state.board = board;
    state.hinted = hinted;
    state.hints = (typeof g.hints === 'number' && g.hints >= 0) ? Math.floor(g.hints) : hinted.length;
    state.elapsed = (typeof g.elapsed === 'number' && g.elapsed >= 0 && isFinite(g.elapsed)) ? Math.floor(g.elapsed) : 0;
    state.complete = false;
    state.selected = -1;
    state.conflicts = S.findConflicts(board, n);
    return true;
  }

  /* ---------- 게임 흐름 ---------- */

  function newGame() {
    var seed = (Date.now() ^ (Math.random() * 2147483648)) >>> 0;
    var g = S.generate({ size: state.size, difficulty: state.difficulty, seed: seed });
    state.seed = g.seed;
    state.puzzle = g.puzzle;
    state.solution = g.solution;
    state.board = g.puzzle.slice();
    state.hinted = [];
    state.hints = 0;
    state.elapsed = 0;
    state.complete = false;
    state.selected = -1;
    state.conflicts = [];
    buildBoard();
    render();
    saveGame(); // 이전 판이 남아 새로고침 때 되살아나지 않게
    startTimer();
  }

  function editable(i) {
    return i >= 0 && !state.complete && state.puzzle[i] === 0 && state.hinted.indexOf(i) === -1;
  }

  // 숫자 d 가 충돌 없이 N 개 다 놓였는가 (패드 흐리게 + 입력 무시)
  function digitDone(d, counts) {
    if (counts[d] < state.size) return false;
    for (var k = 0; k < state.conflicts.length; k++) {
      if (state.board[state.conflicts[k]] === d) return false;
    }
    return true;
  }

  // 입력·지우기·힌트 직후 공통: 충돌 재계산 → 완성 판정 → 저장 → 렌더
  function afterInput() {
    state.conflicts = S.findConflicts(state.board, state.size);
    if (S.isComplete(state.board, state.size)) {
      state.complete = true;
      state.selected = -1;
      stopTimer();
    }
    saveGame();
    render();
    if (state.complete) els.newGame.focus();
  }

  function inputDigit(d) {
    var i = state.selected;
    if (!editable(i) || d < 1 || d > state.size) return;
    if (state.board[i] === d) { state.board[i] = 0; afterInput(); return; } // 같은 숫자 다시 → 지우기(토글)
    if (digitDone(d, S.digitCounts(state.board, state.size))) return;
    state.board[i] = d;
    afterInput();
  }

  function eraseCell() {
    var i = state.selected;
    if (!editable(i) || state.board[i] === 0) return;
    state.board[i] = 0;
    afterInput();
  }

  // 선택 칸이 빈칸이면 거기, 아니면 행 우선 첫 빈칸을 골라 선택한 뒤 채운다
  function useHint() {
    if (state.complete) return;
    var t = state.selected;
    if (!(t >= 0 && state.board[t] === 0)) {
      t = state.board.indexOf(0);
      if (t === -1) return;
    }
    state.board[t] = state.solution[t];
    state.hinted.push(t);
    state.hints++;
    state.selected = t;
    afterInput();
  }

  function select(i, focus) {
    if (i < 0 || i >= cells.length) return;
    state.selected = i;
    render();
    if (focus) cells[i].focus();
  }

  function moveSelection(dr, dc) {
    var n = state.size;
    var i = state.selected >= 0 ? state.selected : 0;
    var r = (Math.floor(i / n) + dr + n) % n; // 끝에서 반대편으로 감김
    var c = (i % n + dc + n) % n;
    select(r * n + c, true);
  }

  /* ---------- 타이머 — 1초 간격, 숨겨진 탭에선 세지 않는다 ---------- */

  function startTimer() {
    stopTimer();
    timerId = setInterval(tick, 1000);
  }

  function stopTimer() {
    if (timerId !== null) { clearInterval(timerId); timerId = null; }
  }

  function tick() {
    if (document.hidden || state.complete) return;
    state.elapsed++;
    renderTime();
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- DOM 생성 — 새 게임 때만 ---------- */

  function buildBoard() {
    var n = state.size;
    var d = S.boxDims(n);
    els.board.textContent = '';
    els.board.dataset.size = String(n);
    els.board.style.setProperty('--n', String(n));
    els.board.setAttribute('aria-label', '스도쿠 ' + n + '×' + n + ' 보드');
    cells = [];
    for (var r = 0; r < n; r++) {
      var row = document.createElement('div');
      row.className = 'row';
      row.setAttribute('role', 'row');
      for (var c = 0; c < n; c++) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell';
        cell.setAttribute('role', 'gridcell');
        cell.dataset.index = String(r * n + c);
        cell.tabIndex = -1;
        if ((c + 1) % d.cols === 0 && c !== n - 1) cell.classList.add('box-r');
        if ((r + 1) % d.rows === 0 && r !== n - 1) cell.classList.add('box-b');
        cell.style.setProperty('--i', String(r + c)); // 완성 애니메이션 대각선 순서
        row.appendChild(cell);
        cells.push(cell);
      }
      els.board.appendChild(row);
    }

    els.digits.textContent = '';
    els.digits.style.setProperty('--n', String(n));
    digitBtns = [];
    for (var v = 1; v <= n; v++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn';
      btn.dataset.digit = String(v);
      btn.textContent = String(v);
      btn.setAttribute('aria-label', '숫자 ' + v + ' 입력');
      els.digits.appendChild(btn);
      digitBtns[v] = btn;
    }
  }

  /* ---------- 렌더 — 속성·클래스만 바꾼다 ---------- */

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text; // aria-live 가 같은 문구를 다시 읽지 않게
  }

  function renderTime() {
    setText(els.time, formatTime(state.elapsed));
  }

  function render() {
    var n = state.size;
    var b = state.board;
    var sel = state.selected;
    var selVal = sel >= 0 ? b[sel] : 0;
    var peerSet = {}, conflictSet = {}, hintedSet = {};
    var k;
    if (sel >= 0) { var ps = S.peers(n, sel); for (k = 0; k < ps.length; k++) peerSet[ps[k]] = true; }
    for (k = 0; k < state.conflicts.length; k++) conflictSet[state.conflicts[k]] = true;
    for (k = 0; k < state.hinted.length; k++) hintedSet[state.hinted[k]] = true;
    var focusIdx = sel >= 0 ? sel : 0; // roving tabindex — 선택이 없으면 첫 칸으로 들어온다
    var remaining = 0;

    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var v = b[i];
      var given = state.puzzle[i] !== 0;
      var hinted = !!hintedSet[i];
      var conflict = !!conflictSet[i];
      if (!v) remaining++;

      setText(cell, v ? String(v) : '');
      cell.classList.toggle('is-given', given);
      cell.classList.toggle('is-hinted', hinted);
      cell.classList.toggle('is-peer', !!peerSet[i]);
      cell.classList.toggle('is-same', selVal > 0 && v === selVal && i !== sel);
      cell.classList.toggle('is-selected', i === sel);
      cell.classList.toggle('is-conflict', conflict);
      cell.tabIndex = i === focusIdx ? 0 : -1;
      cell.setAttribute('aria-selected', i === sel ? 'true' : 'false');
      if (given || hinted) cell.setAttribute('aria-readonly', 'true'); else cell.removeAttribute('aria-readonly');
      if (conflict) cell.setAttribute('aria-invalid', 'true'); else cell.removeAttribute('aria-invalid');

      var label = (Math.floor(i / n) + 1) + '행 ' + (i % n + 1) + '열, ' + (v ? v : '빈 칸');
      if (given) label += ', 주어진 숫자';
      else if (hinted) label += ', 힌트';
      if (conflict) label += ', 충돌';
      cell.setAttribute('aria-label', label);
    }

    var counts = S.digitCounts(b, n);
    for (var dgt = 1; dgt <= n; dgt++) {
      var done = digitDone(dgt, counts);
      digitBtns[dgt].classList.toggle('is-done', done);
      digitBtns[dgt].setAttribute('aria-disabled', done ? 'true' : 'false');
      digitBtns[dgt].disabled = state.complete;
    }
    els.erase.disabled = state.complete;
    els.hint.disabled = state.complete;

    renderTime();
    setText(els.info, state.complete
      ? '완성! ' + formatTime(state.elapsed) + ' · 힌트 ' + state.hints + '회'
      : '힌트 ' + state.hints + ' · 남은 ' + remaining);
    els.status.classList.toggle('is-complete', state.complete);
    els.board.classList.toggle('is-complete', state.complete);

    var radios = els.controls.querySelectorAll('.segment button');
    for (k = 0; k < radios.length; k++) {
      var radio = radios[k];
      var pref = radio.parentNode.dataset.pref;
      var on = String(state[pref]) === radio.dataset.value;
      radio.setAttribute('aria-checked', on ? 'true' : 'false');
      radio.tabIndex = on ? 0 : -1;
    }
  }

  /* ---------- 이벤트 ---------- */

  // 보드: 탭/클릭·포커스 진입은 선택, 화살표는 이동
  els.board.addEventListener('click', function (e) {
    var cell = e.target.closest('.cell');
    if (cell) select(Number(cell.dataset.index), true);
  });
  els.board.addEventListener('focusin', function (e) {
    var cell = e.target.closest('.cell');
    if (cell && Number(cell.dataset.index) !== state.selected) select(Number(cell.dataset.index), false);
  });

  var ARROWS = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var inBoard = els.board.contains(document.activeElement);
    if (inBoard && ARROWS[e.key]) {
      e.preventDefault();
      moveSelection(ARROWS[e.key][0], ARROWS[e.key][1]);
      return;
    }
    if (/^[0-9]$/.test(e.key)) {
      if (e.key === '0') eraseCell(); else inputDigit(Number(e.key)); // N 초과는 inputDigit 이 무시
      if (inBoard) e.preventDefault();
      return;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      eraseCell();
      if (inBoard) e.preventDefault();
    }
  });

  // 숫자 패드
  els.digits.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-digit]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    inputDigit(Number(btn.dataset.digit));
  });
  els.erase.addEventListener('click', eraseCell);
  els.hint.addEventListener('click', useHint);

  // 컨트롤: 크기·난이도는 확인 없이 즉시 새 게임
  function setPref(pref, value) {
    var next = pref === 'size' ? Number(value) : value;
    if (state[pref] === next) return;
    state[pref] = next;
    savePrefs();
    newGame();
  }
  els.controls.addEventListener('click', function (e) {
    var radio = e.target.closest('.segment button');
    if (radio) setPref(radio.parentNode.dataset.pref, radio.dataset.value);
  });
  // 라디오그룹 관례: 화살표로 옆 항목을 고른다
  els.controls.addEventListener('keydown', function (e) {
    var radio = e.target.closest('.segment button');
    if (!radio || !ARROWS[e.key]) return;
    e.preventDefault();
    var list = Array.prototype.slice.call(radio.parentNode.children);
    var dir = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    var next = list[(list.indexOf(radio) + dir + list.length) % list.length];
    setPref(next.parentNode.dataset.pref, next.dataset.value);
    next.focus();
  });
  els.newGame.addEventListener('click', newGame);

  // 테마 토글 — theme.js 의 __setTheme 를 쓰고, 다른 탭에서 바뀌어도 themechange 로 버튼을 맞춘다
  function syncThemeButton() {
    els.themeToggle.setAttribute('aria-pressed', String(document.documentElement.dataset.theme === 'dark'));
  }
  els.themeToggle.addEventListener('click', function () {
    window.__setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
  document.addEventListener('themechange', syncThemeButton);
  syncThemeButton();

  // 숨겨지거나 떠날 때 elapsed 를 반영해 저장. 틱마다는 저장하지 않는다
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) saveGame();
  });
  window.addEventListener('pagehide', saveGame);

  /* ---------- 시작 ---------- */

  loadPrefs();
  if (restoreGame()) {
    buildBoard();
    render();
    startTimer();
  } else {
    newGame();
  }
})();
