(function () {
  "use strict";

  var wv = document.getElementById("webview");
  var splash = document.getElementById("splash");
  var statusEl = document.getElementById("splash-status");
  var refresh = document.getElementById("refresh");

  function hideSplash() {
    splash.style.display = "none";
  }

  function showSplash(text) {
    statusEl.textContent = text;
    splash.style.display = "-ms-flexbox";
    splash.style.display = "flex";
  }

  wv.addEventListener("MSWebViewContentLoading", hideSplash);
  wv.addEventListener("MSWebViewNavigationCompleted", hideSplash);

  wv.addEventListener("MSWebViewNavigationFailed", function () {
    showSplash("network error - tap reload");
  });

  wv.addEventListener("MSWebViewUnviewableContentIdentified", function () {
    showSplash("unsupported content");
  });

  refresh.addEventListener("click", function () {
    hideSplash();
    try {
      wv.refresh();
    } catch (err) {
      wv.navigate("https://www.chess.com/");
    }
  });

  window.onbackclick = function () {
    try {
      if (wv.canGoBack) {
        wv.goBack();
        return true;
      }
    } catch (err) { }
    return false;
  };
})();
