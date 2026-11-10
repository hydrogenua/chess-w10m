(function () {
  "use strict";

  var GLYPH = { k: "\u265A", q: "\u265B", r: "\u265C", b: "\u265D", n: "\u265E", p: "\u265F" };
  var GLYPH_OUT = { k: "\u2654", q: "\u2655", r: "\u2656", b: "\u2657", n: "\u2658", p: "\u2659" };

  var THEMES = {
    green: { l: "#ebecd0", d: "#739552" },
    brown: { l: "#f0d9b5", d: "#b58863" },
    blue: { l: "#dee3e6", d: "#8ca2ad" },
    gray: { l: "#e8e8e8", d: "#7d7a7a" },
    purple: { l: "#e5dcf5", d: "#9a8cc0" }
  };

  var PIECE_STYLES = ["classic", "outline", "flat"];

  var mode = "bot";       // 'bot' | '2p'
  var level = 2;          // 1..3
  var playerColor = "w";  // bot mode only
  var theme = "green";
  var pieceStyle = "classic";
  var soundOn = true;
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

  /* ---- sound: tiny WebAudio synth, no assets ---- */
  var Sound = (function () {
    var ctx = null;
    function ensure() {
      if (ctx === null) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) { ctx = new AC(); }
        } catch (e) { ctx = false; }
      }
      if (ctx && ctx.state && ctx.state === "suspended") {
        try { ctx.resume(); } catch (e2) { }
      }
      return ctx || null;
    }
    function tone(freq, freqEnd, delay, dur, type, vol) {
      var c = ensure();
      if (!c) { return; }
      try {
        var t0 = c.currentTime + delay;
        var osc = c.createOscillator();
        var g = c.createGain();
        osc.type = type || "sine";
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd) { osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur); }
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(c.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
      } catch (e) { }
    }
    return {
      unlock: function () { ensure(); },
      move: function () { tone(210, 130, 0, 0.08, "sine", 0.3); },
      capture: function () { tone(160, 80, 0, 0.12, "sine", 0.45); },
      check: function () { tone(760, 0, 0, 0.09, "triangle", 0.3); tone(600, 0, 0.12, 0.12, "triangle", 0.3); },
      win: function () {
        tone(523, 0, 0, 0.12, "triangle", 0.3);
        tone(659, 0, 0.13, 0.12, "triangle", 0.3);
        tone(784, 0, 0.26, 0.12, "triangle", 0.3);
        tone(1046, 0, 0.39, 0.22, "triangle", 0.35);
      },
      lose: function () {
        tone(440, 0, 0, 0.14, "triangle", 0.3);
        tone(370, 0, 0.16, 0.14, "triangle", 0.3);
        tone(294, 0, 0.32, 0.24, "triangle", 0.3);
      },
      draw: function () { tone(494, 0, 0, 0.12, "triangle", 0.28); tone(494, 0, 0.16, 0.16, "triangle", 0.28); }
    };
  })();

  /* ---- prefs (validated localStorage) ---- */
  function loadPrefs() {
    try {
      var raw = localStorage.getItem("chess-prefs");
      if (!raw) { return; }
      var p = JSON.parse(raw);
      if (p && THEMES[p.theme]) { theme = p.theme; }
      if (p && PIECE_STYLES.indexOf(p.pieces) >= 0) { pieceStyle = p.pieces; }
      if (p && typeof p.sound === "boolean") { soundOn = p.sound; }
    } catch (e) { }
  }

  function savePrefs() {
    try {
      localStorage.setItem("chess-prefs", JSON.stringify({ theme: theme, pieces: pieceStyle, sound: soundOn }));
    } catch (e) { }
  }

  function applyPrefs() {
    document.body.className = "t-" + theme + " p-" + pieceStyle;
  }

  function setSegOn(segId, value) {
    var btns = $(segId).getElementsByTagName("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = (btns[i].getAttribute("data-v") === value) ? "on" : "";
    }
  }

  function segInit(segId, cb) {
    var seg = $(segId);
    var btns = seg.getElementsByTagName("button");
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener("click", function () {
          setSegOn(segId, btn.getAttribute("data-v"));
          cb(btn.getAttribute("data-v"));
        });
      })(btns[i]);
    }
  }

  function setSwatchOn(value) {
    var btns = $("seg-theme").getElementsByTagName("button");
    for (var i = 0; i < btns.length; i++) {
      btns[i].className = "sw" + ((btns[i].getAttribute("data-v") === value) ? " on" : "");
    }
  }

  function buildThemeSeg() {
    var seg = $("seg-theme");
    seg.innerHTML = "";
    for (var name in THEMES) {
      if (!THEMES.hasOwnProperty(name)) continue;
      (function (t) {
        var b = document.createElement("button");
        b.className = "sw";
        b.setAttribute("data-v", t);
        b.style.background = "linear-gradient(to right, " + THEMES[t].l + " 50%, " + THEMES[t].d + " 50%)";
        b.addEventListener("click", function () {
          theme = t;
          applyPrefs();
          savePrefs();
          setSwatchOn(t);
        });
        seg.appendChild(b);
      })(name);
    }
    setSwatchOn(theme);
  }

  /* ---- board ---- */
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
      var g = "";
      if (p) {
        g = (pieceStyle === "outline" && p.c === "w") ? GLYPH_OUT[p.t] : GLYPH[p.t];
      }
      div.firstChild.textContent = g;
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

  function playSoundFor(capture, res) {
    if (!soundOn) { return; }
    if (res.over) {
      if (res.type === "checkmate") {
        if (mode === "2p" || res.winner === playerColor) { Sound.win(); } else { Sound.lose(); }
      } else {
        Sound.draw();
      }
      return;
    }
    if (CHESS.inCheck(game, game.turn)) { Sound.check(); return; }
    if (capture) { Sound.capture(); } else { Sound.move(); }
  }

  function applyMove(m) {
    var capture = !!game.board[m.to] || m.ep;
    lastMove = m;
    game = CHESS.make(game, m);
    hist.push({ st: game, last: m });
    sel = -1;
    var res = CHESS.result(game);
    over = res.over;
    render();
    playSoundFor(capture, res);
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
    loadPrefs();
    applyPrefs();
    buildBoard();
    buildThemeSeg();
    segInit("seg-mode", function (v) {
      mode = v;
      $("bot-options").className = (v === "bot") ? "" : "hidden";
    });
    segInit("seg-level", function (v) { level = parseInt(v, 10); });
    segInit("seg-color", function (v) { playerColor = v; });
    segInit("seg-sound", function (v) { soundOn = (v === "on"); savePrefs(); });
    segInit("seg-pieces", function (v) {
      pieceStyle = (PIECE_STYLES.indexOf(v) >= 0) ? v : "classic";
      applyPrefs();
      savePrefs();
    });
    setSegOn("seg-sound", soundOn ? "on" : "off");
    setSegOn("seg-pieces", pieceStyle);
    $("btn-start").addEventListener("click", startGame);
    $("btn-menu").addEventListener("click", goMenu);
    $("btn-undo").addEventListener("click", undo);
    boardEl.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    // WebAudio needs a user gesture to come alive - resume on every tap
    document.addEventListener("click", function () { Sound.unlock(); }, true);
    window.addEventListener("resize", sizeBoard);
    window.addEventListener("orientationchange", sizeBoard);
    sizeBoard();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
