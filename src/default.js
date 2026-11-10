(function () {
  "use strict";

  // Modern chess sites are unusable in the built-in EdgeHTML WebView and
  // Chromium/Gecko engines cannot be embedded into a UWP WebView, so this app
  // hands the URL straight to Venetium (Chromium 150 port for W10M) and closes.
  var VENETIUM = "Venetium_7p434m16tbgc6";
  var GECKO = "Gecko_7p434m16tbgc6";

  var statusEl = document.getElementById("status");

  function show(text) {
    statusEl.textContent = text;
  }

  function launchWith(family, url) {
    var uri = new Windows.Foundation.Uri(url);
    var opts = new Windows.System.LauncherOptions();
    opts.targetApplicationPackageFamilyName = family;
    return Windows.System.Launcher.launchUriAsync(uri, opts);
  }

  function launchDefault(url) {
    return Windows.System.Launcher.launchUriAsync(new Windows.Foundation.Uri(url));
  }

  function launchAndClose(url, family) {
    launchWith(family, url).then(
      function (ok) {
        if (ok) {
          // let the target activation settle, then leave the stage to it
          setTimeout(function () { window.close(); }, 1500);
        } else {
          show("target did not take the link, use the buttons");
        }
      },
      function () {
        launchDefault(url).then(
          function (ok) {
            if (ok) { setTimeout(function () { window.close(); }, 1500); }
            else { show("no app took the link"); }
          },
          function (e) {
            show("launch failed: " + (e && e.message ? e.message : "?"));
          }
        );
      }
    );
  }

  // auto-launch chess.com right from the tile tap, no hub interaction needed
  if (typeof Windows !== "undefined" && Windows.System && Windows.System.Launcher) {
    launchAndClose("https://www.chess.com/", VENETIUM);
  } else {
    show("WinRT Launcher unavailable");
  }

  // hub buttons stay as manual fallback
  document.getElementById("btn-chesscom").addEventListener("click", function () {
    launchAndClose("https://www.chess.com/", VENETIUM);
  });

  document.getElementById("btn-chesscom-gecko").addEventListener("click", function () {
    launchAndClose("https://www.chess.com/", GECKO);
  });

  document.getElementById("btn-lichess").addEventListener("click", function () {
    launchAndClose("https://lichess.org/", VENETIUM);
  });
})();
