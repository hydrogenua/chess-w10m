var path = require('path');
var CHESS = require(path.join(__dirname, '..', 'src', 'js', 'engine.js'));
global.CHESS = CHESS; // bot.js resolves CHESS as a global at call time

function perft(st, d) {
  if (d === 0) return 1;
  var ms = CHESS.legalMoves(st), n = 0;
  for (var i = 0; i < ms.length; i++) n += perft(CHESS.make(st, ms[i]), d - 1);
  return n;
}

function check(name, fen, depth, expected) {
  var st = CHESS.loadFen(fen);
  var t0 = Date.now();
  var got = perft(st, depth);
  var ok = got === expected;
  console.log((ok ? "OK   " : "FAIL ") + name + " d" + depth + ": got " + got + ", want " + expected + " (" + (Date.now() - t0) + "ms)");
  if (!ok) process.exitCode = 1;
}

var START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
var KIWI = "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1";
var EPPOS = "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1";
var PROMO = "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1";
var POS5 = "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8";
var POS6 = "r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10";

check("startpos", START, 1, 20);
check("startpos", START, 2, 400);
check("startpos", START, 3, 8902);
check("kiwipete", KIWI, 1, 48);
check("kiwipete", KIWI, 2, 2039);
check("ep-pos", EPPOS, 1, 14);
check("ep-pos", EPPOS, 2, 191);
check("ep-pos", EPPOS, 3, 2812);
check("promo-pos", PROMO, 1, 6);
check("promo-pos", PROMO, 2, 264);
check("promo-pos", PROMO, 3, 9467);
check("pos5", POS5, 1, 44);
check("pos5", POS5, 2, 1486);
check("pos6", POS6, 1, 46);
check("pos6", POS6, 2, 2079);

// bot self-play sanity: legal moves only, no crashes, finishes
var CHESSBOT = require(path.join(__dirname, '..', 'src', 'js', 'bot.js'));
var st = CHESS.initialState();
var plies = 0, t0 = Date.now(), bad = false;
while (plies < 80) {
  var res = CHESS.result(st);
  if (res.over) { console.log("self-play ended: " + res.type); break; }
  var m = CHESSBOT.bestMove(st, 2);
  if (!m) break;
  var legal = CHESS.legalMoves(st), found = false;
  for (var i = 0; i < legal.length; i++) {
    if (legal[i].from === m.from && legal[i].to === m.to && (legal[i].promo || null) === (m.promo || null) && legal[i].ep === m.ep && legal[i].castle === m.castle) { found = true; break; }
  }
  if (!found) { console.log("FAIL bot made illegal move at ply " + plies); process.exitCode = 1; bad = true; break; }
  st = CHESS.make(st, m);
  plies++;
}
if (!bad) console.log("OK   bot self-play: " + plies + " plies in " + (Date.now() - t0) + "ms");
console.log("ALL TESTS DONE");
