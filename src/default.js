(function () {
  "use strict";

  // Venetium package family (Chromium 150 port for W10M).
  // Both modern chess sites are broken on the built-in EdgeHTML WebView,
  // so this app just hands the URL to Venetium.
  var TARGET_FAMILY = "Venetium_7p434m16tbgc6";

  var statusEl = document.getElementById("status");

  function show(text) {
    statusEl.textContent = text;
  }

  function launchInTarget(url) {
    if (typeof Windows === "undefined" || !Windows.System || !Windows.System.Launcher) {
      show("WinRT Launcher unavailable");
      return;
    }
    var uri = new Windows.Foundation.Uri(url);
    try {
      var opts = new Windows.System.LauncherOptions();
      opts.targetApplicationPackageFamilyName = TARGET_FAMILY;
      Windows.System.Launcher.launchUriAsync(uri, opts).then(
        function (ok) {
          if (ok) { return; }
          show("Venetium did not take the link, opening default browser...");
          return Windows.System.Launcher.launchUriAsync(uri);
        },
        function (err) {
          show("targeted launch failed, opening default browser...");
          return Windows.System.Launcher.launchUriAsync(uri);
        }
      ).done(
        function (ok) {
          if (ok) { show(""); }
        },
        function (err2) {
          show("launch failed: " + (err2 && err2.message ? err2.message : "?"));
        }
      );
    } catch (e) {
      show("launch error: " + (e && e.message ? e.message : "?"));
    }
  }

  document.getElementById("btn-chesscom").addEventListener("click", function () {
    launchInTarget("https://www.chess.com/");
  });

  document.getElementById("btn-lichess").addEventListener("click", function () {
    launchInTarget("https://lichess.org/");
  });
})();
