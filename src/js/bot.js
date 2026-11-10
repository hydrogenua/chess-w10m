/* Simple negamax bot with alpha-beta, ES5. Depends on CHESS. */
var CHESSBOT = (function () {
  "use strict";

  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  // piece-square tables, white's point of view, index 0 = a8
  var PST = {
    p: [
      0, 0, 0, 0, 0, 0, 0, 0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
      5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0,
      5, -5, -10, 0, 0, -10, -5, 5,
      5, 10, 10, -20, -20, 10, 10, 5,
      0, 0, 0, 0, 0, 0, 0, 0
    ],
    n: [
      -50, -40, -30, -30, -30, -30, -40, -50,
      -40, -20, 0, 0, 0, 0, -20, -40,
      -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30,
      -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40,
      -50, -40, -30, -30, -30, -30, -40, -50
    ],
    b: [
      -20, -10, -10, -10, -10, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10,
      -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10,
      -20, -10, -10, -10, -10, -10, -10, -20
    ],
    r: [
      0, 0, 0, 0, 0, 0, 0, 0,
      5, 10, 10, 10, 10, 10, 10, 5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5,
      0, 0, 0, 5, 5, 0, 0, 0
    ],
    q: [
      -20, -10, -10, -5, -5, -10, -10, -20,
      -10, 0, 0, 0, 0, 0, 0, -10,
      -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5,
      -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10,
      -20, -10, -10, -5, -5, -10, -10, -20
    ],
    k: [
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30,
      -20, -30, -30, -40, -40, -30, -30, -20,
      -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20,
      20, 30, 10, 0, 0, 10, 30, 20
    ]
  };

  function evaluate(st) {
    var b = st.board, score = 0, i, p, v;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p) continue;
      v = VAL[p.t] + PST[p.t][i];
      if (p.c === "w") { score += v; } else { score -= v; }
    }
    return score;
  }

  function moveScore(st, m) {
    // cheap ordering: captures first, bigger victim first
    var victim = st.board[m.to];
    if (victim) { return 10 + (VAL[victim.t] || 0) - (VAL[st.board[m.from].t] || 0) / 10; }
    if (m.ep) { return 10; }
    if (m.promo) { return 9; }
    return 0;
  }

  function negamax(st, depth, alpha, beta) {
    if (depth === 0) { return (st.turn === "w" ? 1 : -1) * evaluate(st); }
    var moves = CHESS.legalMoves(st);
    if (moves.length === 0) {
      return CHESS.inCheck(st, st.turn) ? -100000 - depth : 0;
    }
    moves.sort(function (a, b) {
      var sa = moveScore(st, a), sb = moveScore(st, b);
      return sb - sa;
    });
    var best = -1000000;
    for (var i = 0; i < moves.length; i++) {
      var v = -negamax(CHESS.make(st, moves[i]), depth - 1, -beta, -alpha);
      if (v > best) { best = v; }
      if (v > alpha) { alpha = v; }
      if (alpha >= beta) { break; }
    }
    return best;
  }

  function bestMove(st, depth) {
    var moves = CHESS.legalMoves(st);
    if (moves.length === 0) { return null; }
    // shuffle for variety
    for (var i = moves.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = moves[i]; moves[i] = moves[j]; moves[j] = t;
    }
    var scored = [], best = -1000000;
    for (i = 0; i < moves.length; i++) {
      var v = -negamax(CHESS.make(st, moves[i]), depth - 1, -1000000, 1000000);
      if (v > best) { best = v; }
      scored.push({ m: moves[i], v: v });
    }
    // pick randomly among near-best moves so games differ
    var pool = [];
    for (i = 0; i < scored.length; i++) {
      if (scored[i].v >= best - 15) { pool.push(scored[i].m); }
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  return { bestMove: bestMove, evaluate: evaluate };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = CHESSBOT; }
