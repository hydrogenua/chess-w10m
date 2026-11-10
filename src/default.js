(function () {
  "use strict";

  var GLYPH = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" };

  var mode = "bot";       // 'bot' | '2p'
  var level = 2;          // 1..3
  var playerColor = "w";  // bot mode only
  var game = null;
  var hist = [];          // entries {st, last}
  var sel = -1;
  var lastMove = null;
  var over = false;
  var thinking = false;
  var flipped = false;
  var squares = [];       // 64 display divs
  var boardEl = null;
  var statusEl = null;

  function $(id) { return document.getElementById(id); }

  function segInit(segId, cb) {
    var seg = $(segId);
    var btns = seg.getElementsByTagName("button");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          for (var j = 0; j < btns.length; j++) { btns[j].className = ""; }
          btn.className = "on";
          cb(btn.getAttribute("data-v"));
        });
      })(btns[i]);
    }
  }

  function buildBoard() {
    boardEl = $("board");
    boardEl.innerHTML = "";
    squares = [];
    for (var d = 0; d < 64; d++) {
      var div = document.createElement("div");
      (function (dd) {
        div.addEventListener("click", function () { onSquare(dd); });
      })(d);
      var span = document.createElement("span");
      div.appendChild(span);
      boardEl.appendChild(div);
      squares.push(div);
    }
  }

  function dispToBoard(d) { return flipped ? 63 - d : d; }

  function sizeBoard() {
    var wrap = $("board-wrap");
    var s = Math.min(wrap.clientWidth, wrap.clientHeight);
    if (s <= 0) { return; }
    boardEl.style.width = s + "px";
    boardEl.style.height = s + "px";
    var fs = Math.floor(s / 8 * 0.8);
    var lh = Math.floor(s / 8);
    for (var d = 0; d < 64; d++) {
      var span = squares[d].firstChild;
      span.style.fontSize = fs + "px";
      span.style.lineHeight = lh + "px";
    }
  }

  function render() {
    var b = game.board;
    var legalTargets = {};
    var i, d;
    if (sel >= 0) {
      var ms = CHESS.legalMoves(game);
      for (i = 0; i < ms.length; i++) {
        if (ms[i].from === sel) { legalTargets[ms[i].to] = true; }
      }
    }
    for (d = 0; d < 64; d++) {
      var bi = dispToBoard(d);
      var div = squares[d];
      var p = b[bi];
      var cls = "sq " + (((CHESS.fileOf(bi) + CHESS.rankOf(bi)) % 2 === 0) ? "dark" : "light");
      if (p) { cls += " " + (p.c === "w" ? "wp" : "bp"); }
      if (sel === bi) { cls += " sel"; }
      if (lastMove && (lastMove.from === bi || lastMove.to === bi)) { cls += " last"; }
      if (legalTargets[bi]) { cls += " dot"; }
      div.className = cls;
      div.firstChild.textContent = p ? GLYPH[p.t] : "";
    }
    renderStatus();
  }

  function renderStatus() {
    var res = CHESS.result(game);
    var txt;
    if (res.over) {
      if (res.type === "checkmate") {
        txt = "Мат. Победа " + (res.winner === "w" ? "белых" : "чёрных") + "!";
      } else if (res.type === "stalemate") {
        txt = "Пат - ничья";
      } else {
        txt = "Ничья";
      }
    } else {
      txt = (mode === "bot") ? ((game.turn === playerColor) ? "Твой ход" : "Бот думает...") : (game.turn === "w" ? "Ход белых" : "Ход чёрных");
      if (CHESS.inCheck(game, game.turn)) { txt = "Шах! " + txt; }
    }
    statusEl.textContent = txt;
  }

  function onSquare(d) {
    if (over || thinking || !game) { return; }
    if (mode === "bot" && game.turn !== playerColor) { return; }
    var bi = dispToBoard(d);
    var p = game.board[bi];
    if (sel >= 0) {
      var ms = CHESS.legalMoves(game), m = null;
      for (var i = 0; i < ms.length; i++) {
        if (ms[i].from === sel && ms[i].to === bi) {
          m = ms[i];
          if (m.promo === "q") { break; }
        }
      }
      if (m) { applyMove(m); return; }
      if (p && p.c === game.turn) { sel = bi; render(); return; }
      sel = -1;
      render();
      return;
    }
    if (p && p.c === game.turn) { sel = bi; render(); }
  }

  function applyMove(m) {
    lastMove = m;
    game = CHESS.make(game, m);
    hist.push({ st: game, last: m });
    sel = -1;
    over = CHESS.result(game).over;
    render();
    if (over) { return; }
    if (mode === "bot" && game.turn !== playerColor) { scheduleBot(); }
  }

  function scheduleBot() {
    thinking = true;
    renderStatus();
    setTimeout(function () {
      var m = CHESSBOT.bestMove(game, level);
      thinking = false;
      if (!m) { render(); return; }
      applyMove(m);
    }, 80);
  }

  function startGame() {
    game = CHESS.initialState();
    hist = [{ st: game, last: null }];
    sel = -1; lastMove = null; over = false; thinking = false;
    flipped = (mode === "bot" && playerColor === "b");
    $("screen-menu").className = "screen hidden";
    $("screen-game").className = "screen";
    sizeBoard();
    render();
    if (mode === "bot" && playerColor === "b") { scheduleBot(); }
  }

  function goMenu() {
    thinking = false;
    $("screen-game").className = "screen hidden";
    $("screen-menu").className = "screen";
    $("menu-status").textContent = "";
  }

  function undo() {
    if (thinking || hist.length <= 1) { return; }
    hist.pop();
    if (mode === "bot") {
      while (hist.length > 1 && hist[hist.length - 1].st.turn !== playerColor) { hist.pop(); }
    }
    var top = hist[hist.length - 1];
    game = top.st;
    lastMove = top.last;
    sel = -1;
    over = CHESS.result(game).over;
    render();
    if (mode === "bot" && !over && game.turn !== playerColor) { scheduleBot(); }
  }

  function init() {
    statusEl = $("status");
    buildBoard();
    segInit("seg-mode", function (v) {
      mode = v;
      $("bot-options").className = (v === "bot") ? "" : "hidden";
    });
    segInit("seg-level", function (v) { level = parseInt(v, 10); });
    segInit("seg-color", function (v) { playerColor = v; });
    $("btn-start").addEventListener("click", startGame);
    $("btn-menu").addEventListener("click", goMenu);
    $("btn-undo").addEventListener("click", undo);
    boardEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    window.addEventListener("resize", sizeBoard);
    window.addEventListener("orientationchange", sizeBoard);
    sizeBoard();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
