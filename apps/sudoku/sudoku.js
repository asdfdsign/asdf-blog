// 스도쿠 생성·검증 순수 함수 모음. DOM 과 localStorage 를 모른다.
// 보드는 길이 N² 의 평탄한 배열(index = row * N + col, 0 = 빈칸). 어떤 함수도 입력 배열을 바꾸지 않는다.
// classic script 로 window.Sudoku 에 노출한다 — 콘솔과 test.html 에서 바로 부르기 위해서다.
(function (global) {
  'use strict';

  var SIZES = [4, 6];

  // 목표 빈칸 수. 유일해를 지키며 뺄 수 있는 만큼만 빼므로 실제 빈칸은 이보다 적을 수 있다.
  var DIFFICULTY = {
    4: { easy: 6, normal: 8, hard: 10 },
    6: { easy: 16, normal: 20, hard: 24 },
  };

  // 박스 크기 표. 9 는 UI 에 없지만 2차 대비로 값만 둔다.
  var BOX = {
    4: { rows: 2, cols: 2 },
    6: { rows: 2, cols: 3 },
    9: { rows: 3, cols: 3 },
  };

  var MAX_NODES = 20000;   // countSolutions 노드 상한. 넘기면 "확신 못 함"(2)
  var TIME_LIMIT_MS = 200; // generate 한 판 예산. 넘기면 새 시드로 재시도 → 난이도 한 단계 하향

  function boxDims(size) {
    var d = BOX[size];
    if (!d) throw new Error('지원하지 않는 판 크기: ' + size);
    return { rows: d.rows, cols: d.cols };
  }

  function boxIndex(size, r, c) {
    var d = BOX[size];
    return Math.floor(r / d.rows) * (size / d.cols) + Math.floor(c / d.cols);
  }

  // 같은 행·열·박스 인덱스(자기 자신 제외). 크기별로 한 번만 계산해 캐시한다.
  var peerCache = {};
  function peers(size, index) {
    boxDims(size);
    var key = size + ':' + index;
    if (!peerCache[key]) {
      var r = Math.floor(index / size), c = index % size, b = boxIndex(size, r, c);
      var list = [];
      for (var i = 0; i < size * size; i++) {
        if (i === index) continue;
        var rr = Math.floor(i / size), cc = i % size;
        if (rr === r || cc === c || boxIndex(size, rr, cc) === b) list.push(i);
      }
      peerCache[key] = list;
    }
    return peerCache[key].slice(); // 호출자가 캐시를 건드리지 못하게 복사본
  }

  // mulberry32 — 같은 시드면 같은 수열. 테스트·버그 재현용.
  function createRng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 복사본을 섞어서 돌려준다 (Fisher–Yates)
  function shuffled(arr, rng) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = out[i]; out[i] = out[j]; out[j] = tmp;
    }
    return out;
  }

  function popcount(x) {
    var n = 0;
    while (x) { x &= x - 1; n++; }
    return n;
  }

  // 행·열·박스 사용 비트마스크(1 << v). 주어진 값끼리 이미 충돌하면 null.
  function makeMasks(grid, size) {
    var rows = [], cols = [], boxes = [];
    for (var i = 0; i < size; i++) { rows[i] = 0; cols[i] = 0; boxes[i] = 0; }
    for (var idx = 0; idx < size * size; idx++) {
      var v = grid[idx];
      if (!v) continue;
      var r = Math.floor(idx / size), c = idx % size, b = boxIndex(size, r, c), bit = 1 << v;
      if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) return null;
      rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
    }
    return { rows: rows, cols: cols, boxes: boxes };
  }

  // 1) 완성판. 행 우선으로 빈칸을 돌며 후보를 섞어 넣고 백트래킹. 빈 판은 항상 해가 있어 실패하지 않는다.
  function generateSolution(size, rng) {
    boxDims(size);
    rng = rng || Math.random;
    var n = size * size;
    var grid = new Array(n);
    for (var i = 0; i < n; i++) grid[i] = 0;
    var m = makeMasks(grid, size);
    var full = ((1 << (size + 1)) - 1) & ~1; // 1..N 비트
    var digits = [];
    for (var v = 1; v <= size; v++) digits.push(v);

    function fill(idx) {
      if (idx === n) return true;
      var r = Math.floor(idx / size), c = idx % size, b = boxIndex(size, r, c);
      var cand = full & ~(m.rows[r] | m.cols[c] | m.boxes[b]);
      if (!cand) return false;
      var order = shuffled(digits, rng);
      for (var k = 0; k < order.length; k++) {
        var bit = 1 << order[k];
        if (!(cand & bit)) continue;
        grid[idx] = order[k];
        m.rows[r] |= bit; m.cols[c] |= bit; m.boxes[b] |= bit;
        if (fill(idx + 1)) return true;
        m.rows[r] &= ~bit; m.cols[c] &= ~bit; m.boxes[b] &= ~bit;
        grid[idx] = 0;
      }
      return false;
    }
    fill(0);
    return grid;
  }

  // countSolutions 와 solve 가 함께 쓰는 탐색기. MRV(후보가 가장 적은 빈칸부터) + 비트마스크.
  // limit 개를 찾거나 maxNodes 를 넘기면 멈춘다. onSolution 은 해를 찾을 때마다 작업 배열을 받는다.
  function search(grid, size, limit, maxNodes, onSolution) {
    boxDims(size);
    var m = makeMasks(grid, size);
    if (!m) return { count: 0, aborted: false };
    var n = size * size;
    var full = ((1 << (size + 1)) - 1) & ~1;
    var work = grid.slice();
    var empties = [];
    for (var i = 0; i < n; i++) if (!work[i]) empties.push(i);
    var count = 0, nodes = 0, aborted = false;

    function step() {
      if (++nodes > maxNodes) { aborted = true; return true; }
      var best = -1, bestMask = 0, bestCount = 99;
      for (var k = 0; k < empties.length; k++) {
        var idx = empties[k];
        if (work[idx]) continue;
        var r = Math.floor(idx / size), c = idx % size, b = boxIndex(size, r, c);
        var cand = full & ~(m.rows[r] | m.cols[c] | m.boxes[b]);
        var cnt = popcount(cand);
        if (cnt < bestCount) {
          best = idx; bestMask = cand; bestCount = cnt;
          if (cnt <= 1) break; // 0 이면 막다른 길, 1 이면 더 좋은 칸이 없다
        }
      }
      if (best === -1) {
        count++;
        if (onSolution) onSolution(work);
        return count >= limit;
      }
      if (bestCount === 0) return false;
      var r2 = Math.floor(best / size), c2 = best % size, b2 = boxIndex(size, r2, c2);
      for (var v = 1; v <= size; v++) {
        var bit = 1 << v;
        if (!(bestMask & bit)) continue;
        work[best] = v;
        m.rows[r2] |= bit; m.cols[c2] |= bit; m.boxes[b2] |= bit;
        var stop = step();
        m.rows[r2] &= ~bit; m.cols[c2] &= ~bit; m.boxes[b2] &= ~bit;
        work[best] = 0;
        if (stop) return true;
      }
      return false;
    }
    step();
    return { count: count, aborted: aborted };
  }

  // 3) 유일해 검증. 0 | 1 | 2. 노드 상한을 넘기면 2 = "유일하다고 확신 못 함".
  function countSolutions(grid, size, limit, maxNodes) {
    if (limit == null) limit = 2;
    if (maxNodes == null) maxNodes = MAX_NODES;
    var res = search(grid, size, limit, maxNodes, null);
    return res.aborted ? 2 : res.count;
  }

  // 첫 해. 없으면 null. 테스트·디버그용이라 노드 상한이 없다.
  function solve(grid, size) {
    var found = null;
    search(grid, size, 1, Infinity, function (work) { found = work.slice(); });
    return found;
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  // 2) 완성판에서 섞은 순서로 칸을 빼며 유일해가 깨지면 되돌린다. 목표에 못 미쳐도 그 상태로 돌려준다.
  function carve(size, target, seed) {
    var t0 = now();
    var rng = createRng(seed);
    var solution = generateSolution(size, rng);
    var puzzle = solution.slice();
    var n = size * size;
    var order = [];
    for (var i = 0; i < n; i++) order.push(i);
    order = shuffled(order, rng);
    var blanks = 0;
    for (var k = 0; k < order.length && blanks < target; k++) {
      var idx = order[k];
      var keep = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, size, 2) === 1) blanks++;
      else puzzle[idx] = keep;
    }
    return { puzzle: puzzle, solution: solution, blanks: blanks, ms: now() - t0 };
  }

  var LEVELS = ['easy', 'normal', 'hard'];

  // 3절 절차 전체. 200ms 를 넘기면 새 시드로 1회 재시도, 그래도 넘기면 목표를 한 단계 낮춘다.
  // 6×6 에선 사실상 타지 않는 경로지만 코드로 남겨 둔다.
  function generate(opts) {
    opts = opts || {};
    var size = opts.size || 6;
    var difficulty = opts.difficulty || 'normal';
    if (SIZES.indexOf(size) === -1) throw new Error('지원하지 않는 판 크기: ' + size);
    if (!DIFFICULTY[size][difficulty]) throw new Error('알 수 없는 난이도: ' + difficulty);
    var seed = (opts.seed == null) ? ((Date.now() ^ (Math.random() * 2147483648)) >>> 0) : opts.seed >>> 0;

    var target = DIFFICULTY[size][difficulty];
    var res = carve(size, target, seed);
    if (res.ms > TIME_LIMIT_MS) {
      seed = (seed + 0x9E3779B9) >>> 0; // 새 시드로 1회 재시도
      res = carve(size, target, seed);
      if (res.ms > TIME_LIMIT_MS) {
        var lower = LEVELS[Math.max(0, LEVELS.indexOf(difficulty) - 1)];
        res = carve(size, DIFFICULTY[size][lower], seed);
      }
    }
    return {
      size: size,
      difficulty: difficulty,
      seed: seed,
      puzzle: res.puzzle,
      solution: res.solution,
      blanks: res.blanks,
    };
  }

  // 같은 행·열·박스에 같은 숫자가 둘 이상인 칸. 빈칸은 무시. 중복 없이 오름차순.
  function findConflicts(board, size) {
    var n = size * size;
    var hit = {};
    for (var i = 0; i < n; i++) {
      var v = board[i];
      if (!v) continue;
      var ps = peers(size, i);
      for (var k = 0; k < ps.length; k++) {
        if (board[ps[k]] === v) { hit[i] = true; hit[ps[k]] = true; }
      }
    }
    var out = [];
    for (var j = 0; j < n; j++) if (hit[j]) out.push(j);
    return out;
  }

  // 저장 복원용: 길이와 값 범위(0..N 정수)만 본다
  function isValidBoard(board, size) {
    if (!BOX[size] || !Array.isArray(board) || board.length !== size * size) return false;
    for (var i = 0; i < board.length; i++) {
      var v = board[i];
      if (typeof v !== 'number' || !isFinite(v) || v !== Math.floor(v) || v < 0 || v > size) return false;
    }
    return true;
  }

  function isComplete(board, size) {
    for (var i = 0; i < board.length; i++) if (!board[i]) return false;
    return findConflicts(board, size).length === 0;
  }

  // 인덱스 1..N 에 각 숫자 개수. 0 번은 쓰지 않는다(빈칸 수는 넣지 않는다).
  function digitCounts(board, size) {
    var counts = [];
    for (var v = 0; v <= size; v++) counts[v] = 0;
    for (var i = 0; i < board.length; i++) if (board[i] > 0 && board[i] <= size) counts[board[i]]++;
    counts[0] = 0;
    return counts;
  }

  function encode(board) {
    return board.join('');
  }

  // 숫자가 아닌 글자는 NaN 이 되고, isValidBoard 가 걸러낸다
  function decode(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) out.push(parseInt(str.charAt(i), 10));
    return out;
  }

  global.Sudoku = {
    SIZES: SIZES,
    DIFFICULTY: DIFFICULTY,
    boxDims: boxDims,
    peers: peers,
    createRng: createRng,
    generateSolution: generateSolution,
    countSolutions: countSolutions,
    solve: solve,
    generate: generate,
    findConflicts: findConflicts,
    isValidBoard: isValidBoard,
    isComplete: isComplete,
    digitCounts: digitCounts,
    encode: encode,
    decode: decode,
  };
})(window);
