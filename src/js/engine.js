/* Chess rules engine, ES5, Windows 10 Mobile EdgeHTML compatible.
   Board: 64 indices, 0 = a8 (top-left), 63 = h1 (bottom-right).
   Piece: {c:'w'|'b', t:'p'|'n'|'b'|'r'|'q'|'k'} or null.
   State: {board, turn, castling:{K,Q,k,q}, ep, half, full}. */
var CHESS = (function () {
  "use strict";

  function sq(f, r) { return r * 8 + f; }
  function fileOf(i) { return i % 8; }
  function rankOf(i) { return Math.floor(i / 8); }
  function onBoard(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }
  function other(c) { return c === "w" ? "b" : "w"; }

  var KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  var KING_D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  var ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var BISHOP_D = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

  function initialState() {
    var board = new Array(64);
    var back = ["r", "n", "b", "q", "k", "b", "n", "r"];
    var f;
    for (f = 0; f < 8; f++) {
      board[sq(f, 0)] = { c: "b", t: back[f] };
      board[sq(f, 1)] = { c: "b", t: "p" };
      board[sq(f, 6)] = { c: "w", t: "p" };
      board[sq(f, 7)] = { c: "w", t: back[f] };
    }
    return {
      board: board,
      turn: "w",
      castling: { K: true, Q: true, k: true, q: true },
      ep: null,
      half: 0,
      full: 1
    };
  }

  function loadFen(fen) {
    var parts = fen.split(/\s+/);
    var board = new Array(64);
    var rows = parts[0].split("/");
    var r, f, i, ch, piece;
    for (r = 0; r < 8; r++) {
      f = 0;
      for (i = 0; i < rows[r].length; i++) {
        ch = rows[r].charAt(i);
        if (ch >= "1" && ch <= "8") {
          f += parseInt(ch, 10);
        } else {
          piece = { c: (ch === ch.toUpperCase()) ? "w" : "b", t: ch.toLowerCase() };
          board[sq(f, r)] = piece;
          f++;
        }
      }
    }
    var castling = { K: false, Q: false, k: false, q: false };
    if (parts[2] && parts[2] !== "-") {
      for (i = 0; i < parts[2].length; i++) { castling[parts[2].charAt(i)] = true; }
    }
    var ep = null;
    if (parts[3] && parts[3] !== "-") {
      ep = (parts[3].charCodeAt(0) - 97) + (8 - parseInt(parts[3].charAt(1), 10)) * 8;
    }
    return {
      board: board,
      turn: parts[1] || "w",
      castling: castling,
      ep: ep,
      half: parts[4] ? parseInt(parts[4], 10) : 0,
      full: parts[5] ? parseInt(parts[5], 10) : 1
    };
  }

  function push(moves, from, to, promo, ep, castle, double) {
    moves.push({ from: from, to: to, promo: promo || null, ep: !!ep, castle: castle || null, double: !!double });
  }

  function addPawnMoves(moves, from, to, isPromo, isEp) {
    if (isPromo) {
      var ps = ["q", "r", "b", "n"];
      for (var k = 0; k < 4; k++) push(moves, from, to, ps[k], false, null, false);
    } else {
      push(moves, from, to, null, isEp, null, false);
    }
  }

  function attacked(st, i, by) {
    var b = st.board, f = fileOf(i), r = rankOf(i), d, nf, nr, p, to, tf, tr;
    // pawns (a white pawn on (nf, nr) attacks (nf-1, nr-1) and (nf+1, nr-1))
    if (by === "w") {
      nr = r + 1;
      nf = f - 1;
      if (onBoard(nf, nr)) { p = b[sq(nf, nr)]; if (p && p.c === "w" && p.t === "p") return true; }
      nf = f + 1;
      if (onBoard(nf, nr)) { p = b[sq(nf, nr)]; if (p && p.c === "w" && p.t === "p") return true; }
    } else {
      nr = r - 1;
      nf = f - 1;
      if (onBoard(nf, nr)) { p = b[sq(nf, nr)]; if (p && p.c === "b" && p.t === "p") return true; }
      nf = f + 1;
      if (onBoard(nf, nr)) { p = b[sq(nf, nr)]; if (p && p.c === "b" && p.t === "p") return true; }
    }
    // knights
    for (d = 0; d < 8; d++) {
      nf = f + KNIGHT_D[d][0]; nr = r + KNIGHT_D[d][1];
      if (onBoard(nf, nr)) { p = b[sq(nf, nr)]; if (p && p.c === by && p.t === "n") return true; }
    }
    // king
    for (d = 0; d < 8; d++) {
      nf = f + KING_D[d][0]; nr = r + KING_D[d][1];
      if (onBoard(nf, nr)) { p = b[sq(nf, nr)]; if (p && p.c === by && p.t === "k") return true; }
    }
    // rook/queen rays
    for (d = 0; d < 4; d++) {
      tf = ROOK_D[d][0]; tr = ROOK_D[d][1];
      nf = f + tf; nr = r + tr;
      while (onBoard(nf, nr)) {
        p = b[sq(nf, nr)];
        if (p) {
          if (p.c === by && (p.t === "r" || p.t === "q")) return true;
          break;
        }
        nf += tf; nr += tr;
      }
    }
    // bishop/queen rays
    for (d = 0; d < 4; d++) {
      tf = BISHOP_D[d][0]; tr = BISHOP_D[d][1];
      nf = f + tf; nr = r + tr;
      while (onBoard(nf, nr)) {
        p = b[sq(nf, nr)];
        if (p) {
          if (p.c === by && (p.t === "b" || p.t === "q")) return true;
          break;
        }
        nf += tf; nr += tr;
      }
    }
    return false;
  }

  function genPseudo(st) {
    var moves = [], b = st.board, me = st.turn;
    var i, f, r, p, d, df, dr, nf, nr, to, tp, dirs, tf, tr;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p || p.c !== me) continue;
      f = fileOf(i); r = rankOf(i);
      if (p.t === "p") {
        var dir = (me === "w") ? -1 : 1;
        var startRank = (me === "w") ? 6 : 1;
        var promoRank = (me === "w") ? 0 : 7;
        nr = r + dir;
        if (onBoard(f, nr)) {
          to = sq(f, nr);
          if (!b[to]) {
            addPawnMoves(moves, i, to, nr === promoRank, false);
            if (r === startRank && !b[sq(f, r + 2 * dir)]) {
              push(moves, i, sq(f, r + 2 * dir), null, false, null, true);
            }
          }
          for (df = -1; df <= 1; df += 2) {
            nf = f + df;
            if (!onBoard(nf, nr)) continue;
            to = sq(nf, nr);
            tp = b[to];
            if (tp && tp.c !== me) {
              addPawnMoves(moves, i, to, nr === promoRank, false);
            } else if (!tp && st.ep === to) {
              push(moves, i, to, null, true, null, false);
            }
          }
        }
      } else if (p.t === "n" || p.t === "k") {
        var deltas = (p.t === "n") ? KNIGHT_D : KING_D;
        for (d = 0; d < 8; d++) {
          nf = f + deltas[d][0]; nr = r + deltas[d][1];
          if (!onBoard(nf, nr)) continue;
          to = sq(nf, nr);
          tp = b[to];
          if (!tp || tp.c !== me) push(moves, i, to, null, false, null, false);
        }
        if (p.t === "k") {
          if (me === "w" && i === 60) {
            if (st.castling.K && !b[61] && !b[62] && b[63] && b[63].t === "r" && b[63].c === "w" &&
                !attacked(st, 60, "b") && !attacked(st, 61, "b")) {
              push(moves, 60, 62, null, false, "K", false);
            }
            if (st.castling.Q && !b[59] && !b[58] && !b[57] && b[56] && b[56].t === "r" && b[56].c === "w" &&
                !attacked(st, 60, "b") && !attacked(st, 59, "b")) {
              push(moves, 60, 58, null, false, "Q", false);
            }
          } else if (me === "b" && i === 4) {
            if (st.castling.k && !b[5] && !b[6] && b[7] && b[7].t === "r" && b[7].c === "b" &&
                !attacked(st, 4, "w") && !attacked(st, 5, "w")) {
              push(moves, 4, 6, null, false, "K", false);
            }
            if (st.castling.q && !b[3] && !b[2] && !b[1] && b[0] && b[0].t === "r" && b[0].c === "b" &&
                !attacked(st, 4, "w") && !attacked(st, 3, "w")) {
              push(moves, 4, 2, null, false, "Q", false);
            }
          }
        }
      } else {
        dirs = (p.t === "r") ? ROOK_D : (p.t === "b") ? BISHOP_D : ROOK_D.concat(BISHOP_D);
        for (d = 0; d < dirs.length; d++) {
          tf = dirs[d][0]; tr = dirs[d][1];
          nf = f + tf; nr = r + tr;
          while (onBoard(nf, nr)) {
            to = sq(nf, nr);
            tp = b[to];
            if (!tp) {
              push(moves, i, to, null, false, null, false);
            } else {
              if (tp.c !== me) push(moves, i, to, null, false, null, false);
              break;
            }
            nf += tf; nr += tr;
          }
        }
      }
    }
    return moves;
  }

  function make(st, m) {
    var b = st.board.slice();
    var me = st.turn;
    var p = b[m.from];
    var ns = {
      board: b,
      turn: other(me),
      castling: { K: st.castling.K, Q: st.castling.Q, k: st.castling.k, q: st.castling.q },
      ep: null,
      half: st.half + 1,
      full: (me === "b") ? st.full + 1 : st.full
    };
    var captured = b[m.to];
    b[m.from] = null;
    if (m.ep) {
      b[m.to] = p;
      if (me === "w") { b[m.to + 8] = null; } else { b[m.to - 8] = null; }
      captured = true;
    } else {
      b[m.to] = m.promo ? { c: me, t: m.promo } : p;
    }
    if (m.castle === "K") {
      if (me === "w") { b[61] = b[63]; b[63] = null; } else { b[5] = b[7]; b[7] = null; }
    } else if (m.castle === "Q") {
      if (me === "w") { b[59] = b[56]; b[56] = null; } else { b[3] = b[0]; b[0] = null; }
    }
    if (m.double) { ns.ep = (me === "w") ? m.from - 8 : m.from + 8; }
    if (p.t === "p" || captured) { ns.half = 0; }
    if (p.t === "k") {
      if (me === "w") { ns.castling.K = false; ns.castling.Q = false; }
      else { ns.castling.k = false; ns.castling.q = false; }
    }
    if (m.from === 63 || m.to === 63) ns.castling.K = false;
    if (m.from === 56 || m.to === 56) ns.castling.Q = false;
    if (m.from === 7 || m.to === 7) ns.castling.k = false;
    if (m.from === 0 || m.to === 0) ns.castling.q = false;
    return ns;
  }

  function kingSquare(st, color) {
    var b = st.board, i;
    for (i = 0; i < 64; i++) {
      if (b[i] && b[i].c === color && b[i].t === "k") return i;
    }
    return -1;
  }

  function inCheck(st, color) {
    var k = kingSquare(st, color);
    if (k < 0) return false;
    return attacked(st, k, other(color));
  }

  function legalMoves(st) {
    var pseudo = genPseudo(st), out = [], me = st.turn, i, ns, k;
    for (i = 0; i < pseudo.length; i++) {
      ns = make(st, pseudo[i]);
      k = kingSquare(ns, me);
      if (k >= 0 && !attacked(ns, k, other(me))) out.push(pseudo[i]);
    }
    return out;
  }

  function insufficientMaterial(st) {
    var b = st.board, minors = [], i, p;
    for (i = 0; i < 64; i++) {
      p = b[i];
      if (!p || p.t === "k") continue;
      if (p.t === "p" || p.t === "r" || p.t === "q") return false;
      minors.push(p);
    }
    if (minors.length === 0) return true;
    if (minors.length === 1) return true;
    return false;
  }

  function result(st) {
    var moves = legalMoves(st);
    if (moves.length === 0) {
      if (inCheck(st, st.turn)) return { over: true, type: "checkmate", winner: other(st.turn) };
      return { over: true, type: "stalemate" };
    }
    if (st.half >= 100) return { over: true, type: "draw50" };
    if (insufficientMaterial(st)) return { over: true, type: "material" };
    return { over: false, moves: moves };
  }

  return {
    initialState: initialState,
    loadFen: loadFen,
    genPseudo: genPseudo,
    legalMoves: legalMoves,
    make: make,
    attacked: attacked,
    inCheck: inCheck,
    kingSquare: kingSquare,
    result: result,
    fileOf: fileOf,
    rankOf: rankOf,
    other: other
  };
})();

if (typeof module !== "undefined" && module.exports) { module.exports = CHESS; }
